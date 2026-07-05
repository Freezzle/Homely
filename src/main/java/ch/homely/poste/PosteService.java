package ch.homely.poste;

import ch.homely.categorie.Categorie;
import ch.homely.categorie.CategorieRepository;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.compte.Compte;
import ch.homely.compte.CompteRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.membre.Membre;
import ch.homely.membre.MembreRepository;
import ch.homely.moteur.MoteurCalcul;
import ch.homely.moteur.PosteCalcul;
import ch.homely.moteur.RepartitionCalcul;
import ch.homely.poste.dto.PosteDto;
import ch.homely.poste.dto.PosteRequest;
import ch.homely.projection.ProjectionService;
import ch.homely.scenario.Scenario;
import ch.homely.scenario.ScenarioRepository;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** T7.2 — CRUD Poste + RepartitionPoste + VentilationCompte. */
@Service
@Transactional
public class PosteService {

    private final PosteRepository posteRepo;
    private final ScenarioRepository scenarioRepo;
    private final MembreRepository membreRepo;
    private final CategorieRepository categorieRepo;
    private final CompteRepository compteRepo;
    private final MultiTenantService multiTenant;
    private final ProjectionService projectionService;

    public PosteService(PosteRepository posteRepo, ScenarioRepository scenarioRepo,
                        MembreRepository membreRepo, CategorieRepository categorieRepo,
                        CompteRepository compteRepo, MultiTenantService multiTenant,
                        ProjectionService projectionService) {
        this.posteRepo         = posteRepo;
        this.scenarioRepo      = scenarioRepo;
        this.membreRepo        = membreRepo;
        this.categorieRepo     = categorieRepo;
        this.compteRepo        = compteRepo;
        this.multiTenant       = multiTenant;
        this.projectionService = projectionService;
    }

    @Transactional(readOnly = true)
    public List<PosteDto> lister(UUID foyerId, UUID scenarioId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        verifierScenario(foyerId, scenarioId);
        return posteRepo.findAllByScenarioIdOrderByOrdre(scenarioId).stream()
                .map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public PosteDto obtenir(UUID foyerId, UUID scenarioId, UUID posteId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return toDto(trouver(scenarioId, posteId));
    }

    public PosteDto creer(UUID foyerId, UUID scenarioId, PosteRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Scenario scenario = verifierScenario(foyerId, scenarioId);

        validerRepartition(req.repartitions(), foyerId);

        Poste p = new Poste();
        p.setScenario(scenario);
        appliquer(p, req, foyerId);
        PosteDto dto = toDto(posteRepo.save(p));
        projectionService.invaliderCache(scenarioId);
        return dto;
    }

    public PosteDto modifier(UUID foyerId, UUID scenarioId, UUID posteId, PosteRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        verifierScenario(foyerId, scenarioId);

        validerRepartition(req.repartitions(), foyerId);

        Poste p = trouver(scenarioId, posteId);
        p.getRepartitions().clear();
        p.getVentilations().clear();
        appliquer(p, req, foyerId);
        PosteDto dto = toDto(posteRepo.save(p));
        projectionService.invaliderCache(scenarioId);
        return dto;
    }

    public void supprimer(UUID foyerId, UUID scenarioId, UUID posteId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        verifierScenario(foyerId, scenarioId);
        Poste p = trouver(scenarioId, posteId);
        posteRepo.delete(p);
        projectionService.invaliderCache(scenarioId);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void appliquer(Poste p, PosteRequest req, UUID foyerId) {
        p.setType(req.type());
        p.setDescription(req.description());
        p.setMontant(req.montant() != null ? req.montant() : BigDecimal.ZERO);
        p.setDevise(req.devise());
        p.setPeriodiciteMois(req.periodiciteMois() > 0 ? req.periodiciteMois() : 1);
        p.setDebut(req.debut());
        p.setFin(req.fin());
        p.setMode(req.mode());
        p.setMoment(req.moment());
        p.setOrdre(req.ordre());

        if (req.categorieId() != null) {
            Categorie cat = categorieRepo.findByIdAndFoyerId(req.categorieId(), foyerId)
                    .orElseThrow(() -> new RessourceIntrouvableException(
                            "Catégorie introuvable : " + req.categorieId()));
            p.setCategorie(cat);
        }

        if (req.compteSource() != null) {
            Compte cs = compteRepo.findByIdAndFoyerId(req.compteSource(), foyerId)
                    .orElseThrow(() -> new RessourceIntrouvableException(
                            "Compte source introuvable : " + req.compteSource()));
            p.setCompteSource(cs);
        }

        if (req.repartitions() != null) {
            for (PosteRequest.RepartitionPosteDto rd : req.repartitions()) {
                Membre m = membreRepo.findByIdAndFoyerId(rd.membreId(), foyerId)
                        .orElseThrow(() -> new RessourceIntrouvableException(
                                "Membre introuvable : " + rd.membreId()));
                RepartitionPoste rp = new RepartitionPoste();
                rp.setPoste(p);
                rp.setMembre(m);
                rp.setQuotePart(rd.quotePart());
                p.getRepartitions().add(rp);
            }
        }

        if (req.ventilations() != null) {
            for (PosteRequest.VentilationCompteDto vd : req.ventilations()) {
                Membre m = membreRepo.findByIdAndFoyerId(vd.membreId(), foyerId)
                        .orElseThrow(() -> new RessourceIntrouvableException(
                                "Membre introuvable : " + vd.membreId()));
                Compte c = compteRepo.findByIdAndFoyerId(vd.compteId(), foyerId)
                        .orElseThrow(() -> new RessourceIntrouvableException(
                                "Compte introuvable : " + vd.compteId()));
                VentilationCompte vc = new VentilationCompte();
                vc.setPoste(p);
                vc.setMembre(m);
                vc.setCompte(c);
                p.getVentilations().add(vc);
            }
        }
    }

    private void validerRepartition(List<PosteRequest.RepartitionPosteDto> reps, UUID foyerId) {
        if (reps == null || reps.isEmpty()) return;
        List<RepartitionCalcul> rcs = reps.stream()
                .map(r -> new RepartitionCalcul(r.membreId(), r.quotePart().doubleValue()))
                .toList();
        MoteurCalcul.validerRepartition(rcs);
    }

    private Scenario verifierScenario(UUID foyerId, UUID scenarioId) {
        return scenarioRepo.findByIdAndFoyerId(scenarioId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Scénario introuvable : " + scenarioId));
    }

    private Poste trouver(UUID scenarioId, UUID posteId) {
        return posteRepo.findByIdAndScenarioId(posteId, scenarioId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Poste introuvable : " + posteId));
    }

    private PosteDto toDto(Poste p) {
        // Calcul du montantMensualise via le moteur
        PosteCalcul pc = new PosteCalcul(p.getId(), p.getType(),
                p.getMontant().doubleValue(), p.getDevise(), p.getPeriodiciteMois(),
                p.getDebut(), p.getFin(), p.getMode(), p.getMoment(),
                List.of(), List.of(), null, null);
        BigDecimal mensualise = BigDecimal.valueOf(MoteurCalcul.montantMensualise(pc))
                .setScale(2, java.math.RoundingMode.HALF_UP);

        List<PosteDto.RepartitionPosteDto> reps = p.getRepartitions().stream()
                .map(r -> new PosteDto.RepartitionPosteDto(
                        r.getMembre().getId(), r.getMembre().getNom(), r.getQuotePart()))
                .toList();

        List<PosteDto.VentilationCompteDto> vents = p.getVentilations().stream()
                .map(v -> new PosteDto.VentilationCompteDto(
                        v.getMembre().getId(), v.getCompte().getId(), v.getCompte().getLibelle()))
                .toList();

        return new PosteDto(p.getId(), p.getType(), p.getDescription(),
                p.getCategorie() != null ? p.getCategorie().getId() : null,
                p.getMontant(), mensualise, p.getDevise(), p.getPeriodiciteMois(),
                p.getDebut(), p.getFin(), p.getMode(), p.getMoment(),
                p.getCompteSource() != null ? p.getCompteSource().getId() : null,
                p.getOrdre(), reps, vents);
    }
}
