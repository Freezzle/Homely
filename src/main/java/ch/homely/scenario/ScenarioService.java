package ch.homely.scenario;

import ch.homely.commun.CodesErreur;
import ch.homely.commun.RegleMetierException;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.foyer.Foyer;
import ch.homely.foyer.FoyerRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.membre.Membre;
import ch.homely.membre.MembreRepository;
import ch.homely.moteur.MoteurCalcul;
import ch.homely.moteur.RepartitionCalcul;
import ch.homely.poche.AllocationArgentPoche;
import ch.homely.poche.AllocationArgentPocheRepository;
import ch.homely.poche.PolitiqueArgentPoche;
import ch.homely.poche.PolitiqueArgentPocheRepository;
import ch.homely.poste.Poste;
import ch.homely.poste.PosteRepository;
import ch.homely.poste.RepartitionPoste;
import ch.homely.poste.VentilationCompte;
import ch.homely.scenario.dto.RepartitionPeriodeDto;
import ch.homely.scenario.dto.ScenarioDto;
import ch.homely.scenario.dto.ScenarioRequest;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** T7.1 — CRUD Scénarios (+ période de répartition ouverte) + dupliquer + définir référence. */
@Service
@Transactional
public class ScenarioService {

    private final ScenarioRepository scenarioRepo;
    private final FoyerRepository foyerRepo;
    private final MembreRepository membreRepo;
    private final RepartitionPeriodeRepository periodeRepo;
    private final PosteRepository posteRepo;
    private final PolitiqueArgentPocheRepository politiqueArgentPocheRepo;
    private final AllocationArgentPocheRepository allocationArgentPocheRepo;
    private final MultiTenantService multiTenant;

    public ScenarioService(ScenarioRepository scenarioRepo, FoyerRepository foyerRepo,
                           MembreRepository membreRepo,
                           RepartitionPeriodeRepository periodeRepo,
                           PosteRepository posteRepo,
                           PolitiqueArgentPocheRepository politiqueArgentPocheRepo,
                           AllocationArgentPocheRepository allocationArgentPocheRepo,
                           MultiTenantService multiTenant) {
        this.scenarioRepo = scenarioRepo;
        this.foyerRepo    = foyerRepo;
        this.membreRepo   = membreRepo;
        this.periodeRepo  = periodeRepo;
        this.posteRepo    = posteRepo;
        this.politiqueArgentPocheRepo   = politiqueArgentPocheRepo;
        this.allocationArgentPocheRepo  = allocationArgentPocheRepo;
        this.multiTenant  = multiTenant;
    }

    @Transactional(readOnly = true)
    public List<ScenarioDto> lister(UUID foyerId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return scenarioRepo.findAllByFoyerIdOrderByDateCreation(foyerId).stream()
                .map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public ScenarioDto obtenir(UUID foyerId, UUID scenarioId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return toDto(trouver(foyerId, scenarioId));
    }

    public ScenarioDto creer(UUID foyerId, ScenarioRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Foyer foyer = foyerRepo.findById(foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Foyer introuvable"));

        if (req.repartitions() == null || req.repartitions().isEmpty()) {
            throw new RegleMetierException(CodesErreur.REPARTITION_INVALIDE,
                    "La répartition initiale est requise à la création du scénario.");
        }
        validerRepartition(req.repartitions());

        Scenario s = new Scenario();
        s.setFoyer(foyer);
        appliquer(s, req, foyerId);
        Scenario saved = scenarioRepo.save(s);

        // Créer la période ouverte initiale depuis les repartitions saisies par l'utilisateur
        creerOuMettreAJourPeriodeOuverte(saved, req.repartitions(), foyerId);

        return toDto(scenarioRepo.save(saved));
    }

    /**
     * Modifie les paramètres généraux du scénario (nom, année de départ, trésorerie initiale,
     * horizon). La répartition n'est jamais impactée par cette opération : elle se gère
     * exclusivement via les périodes de prorata dédiées ({@link RepartitionPeriodeService}).
     */
    public ScenarioDto modifier(UUID foyerId, UUID scenarioId, ScenarioRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Scenario s = trouver(foyerId, scenarioId);
        appliquer(s, req, foyerId);
        return toDto(scenarioRepo.save(s));
    }

    public void supprimer(UUID foyerId, UUID scenarioId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.OWNER);
        Scenario s = trouver(foyerId, scenarioId);
        if (s.isEstReference()) {
            throw new RegleMetierException(CodesErreur.SCENARIO_REFERENCE_UNIQUE,
                    "Le scénario de référence ne peut pas être supprimé.");
        }
        scenarioRepo.delete(s);
    }

    /**
     * T7.3 — Dupliquer un scénario (copie profonde). Copie l'intégralité des données
     * scénario-scopées : périodes de répartition (+ quotes-parts), postes (+ répartitions
     * par membre et ventilations par compte, avec remap des chaînes de révision), politiques
     * d'argent de poche et allocations ponctuelles. Les référentiels foyer (membres, comptes,
     * catégories) sont réutilisés par référence, sans être eux-mêmes dupliqués.
     */
    public ScenarioDto dupliquer(UUID foyerId, UUID scenarioId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Scenario src = trouver(foyerId, scenarioId);

        Scenario copie = new Scenario();
        copie.setFoyer(src.getFoyer());
        copie.setNom(src.getNom() + " (copie)");
        copie.setAnneeDepart(src.getAnneeDepart());
        copie.setTresorerieInitiale(src.getTresorerieInitiale());
        copie.setHorizonAnnees(src.getHorizonAnnees());
        copie.setEstReference(false);

        // Copie des périodes de répartition (+ quotes-parts)
        List<RepartitionPeriode> srcPeriodes = periodeRepo.findByScenarioId(src.getId());
        for (RepartitionPeriode sp : srcPeriodes) {
            RepartitionPeriode pc = new RepartitionPeriode();
            pc.setScenario(copie);
            pc.setDebut(sp.getDebut());
            pc.setFin(sp.getFin());
            for (RepartitionPeriodePart part : sp.getParts()) {
                RepartitionPeriodePart pp = new RepartitionPeriodePart();
                pp.setPeriode(pc);
                pp.setMembre(part.getMembre());
                pp.setQuotePart(part.getQuotePart());
                pp.setOrdre(part.getOrdre());
                pc.getParts().add(pp);
            }
            copie.getRepartitionsPeriodes().add(pc);
        }

        Scenario saved = scenarioRepo.save(copie);

        dupliquerPostes(src.getId(), saved);
        dupliquerPolitiquesArgentPoche(src.getId(), saved);
        dupliquerAllocationsArgentPoche(src.getId(), saved);

        return toDto(saved);
    }

    /**
     * Copie tous les postes du scénario source (+ répartitions par membre et ventilations
     * par compte). Les chaînes de révision de montant ({@code posteOrigineId}) sont
     * remappées vers les nouveaux postes copiés, afin que la copie reste autonome et ne
     * pointe pas vers des postes du scénario source.
     *
     * <p>Chaque copie reçoit en outre un {@code sourcePosteId} pointant vers la racine
     * de la chaîne de duplication (le premier poste jamais créé, avant toute copie de
     * scénario) : ce lien cross-scénario permet à l'écran de comparaison de scénarios
     * d'apparier fiablement un poste et sa copie, même en cas de renommage ou de
     * doublons de description (feature_5_bis §9).</p>
     */
    private void dupliquerPostes(UUID srcScenarioId, Scenario copie) {
        List<Poste> srcPostes = posteRepo.findAllByScenarioIdOrderByOrdre(srcScenarioId);
        List<Poste> nouveauxPostes = new ArrayList<>();

        for (Poste sp : srcPostes) {
            Poste pc = new Poste();
            pc.setScenario(copie);
            pc.setType(sp.getType());
            pc.setDescription(sp.getDescription());
            pc.setCategorie(sp.getCategorie());
            pc.setMontant(sp.getMontant());
            pc.setDevise(sp.getDevise());
            pc.setPeriodiciteMois(sp.getPeriodiciteMois());
            pc.setDebut(sp.getDebut());
            pc.setFin(sp.getFin());
            pc.setMode(sp.getMode());
            pc.setMoment(sp.getMoment());
            pc.setNature(sp.getNature());
            pc.setEstimPourcentage(sp.getEstimPourcentage());
            pc.setTypeRepartition(sp.getTypeRepartition());
            pc.setOrdre(sp.getOrdre());
            pc.setImportance(sp.getImportance());
            pc.setPotentielOptimisation(sp.getPotentielOptimisation());
            pc.setDeriveExterne(sp.getDeriveExterne());
            pc.setInclureProrataTheorique(sp.isInclureProrataTheorique());
            // sourcePosteId = racine de la chaîne de duplication (jamais le poste
            // intermédiaire) : si sp est déjà une copie, on repropage sa racine,
            // sinon sp devient lui-même la racine (première duplication).
            pc.setSourcePosteId(sp.getSourcePosteId() != null ? sp.getSourcePosteId() : sp.getId());
            // posteOrigineId remappé ci-dessous, une fois tous les postes copiés et sauvés

            for (RepartitionPoste rp : sp.getRepartitions()) {
                RepartitionPoste rpc = new RepartitionPoste();
                rpc.setPoste(pc);
                rpc.setMembre(rp.getMembre());
                rpc.setQuotePart(rp.getQuotePart());
                pc.getRepartitions().add(rpc);
            }
            for (VentilationCompte vc : sp.getVentilations()) {
                VentilationCompte vcc = new VentilationCompte();
                vcc.setPoste(pc);
                vcc.setMembre(vc.getMembre());
                vcc.setCompte(vc.getCompte());
                pc.getVentilations().add(vcc);
            }
            nouveauxPostes.add(pc);
        }

        posteRepo.saveAll(nouveauxPostes);

        // Remap des chaînes de révision (posteOrigineId) vers les nouveaux ids copiés
        Map<UUID, UUID> ancienVersNouveauId = new HashMap<>();
        for (int i = 0; i < srcPostes.size(); i++) {
            ancienVersNouveauId.put(srcPostes.get(i).getId(), nouveauxPostes.get(i).getId());
        }
        boolean remapNecessaire = false;
        for (int i = 0; i < srcPostes.size(); i++) {
            UUID origine = srcPostes.get(i).getPosteOrigineId();
            if (origine != null && ancienVersNouveauId.containsKey(origine)) {
                nouveauxPostes.get(i).setPosteOrigineId(ancienVersNouveauId.get(origine));
                remapNecessaire = true;
            }
        }
        if (remapNecessaire) {
            posteRepo.saveAll(nouveauxPostes);
        }
    }

    /** Copie toutes les politiques d'argent de poche du scénario source. */
    private void dupliquerPolitiquesArgentPoche(UUID srcScenarioId, Scenario copie) {
        List<PolitiqueArgentPoche> srcPolitiques =
                politiqueArgentPocheRepo.findAllByScenarioIdOrderByMembreIdAscDateDebutAsc(srcScenarioId);
        List<PolitiqueArgentPoche> nouvelles = new ArrayList<>();
        for (PolitiqueArgentPoche sp : srcPolitiques) {
            PolitiqueArgentPoche pc = new PolitiqueArgentPoche();
            pc.setScenario(copie);
            pc.setMembre(sp.getMembre());
            pc.setCompte(sp.getCompte());
            pc.setNom(sp.getNom());
            pc.setDateDebut(sp.getDateDebut());
            pc.setDateFin(sp.getDateFin());
            pc.setMode(sp.getMode());
            pc.setSocle(sp.getSocle());
            pc.setPourcentage(sp.getPourcentage());
            pc.setPlafond(sp.getPlafond());
            pc.setMontantFixe(sp.getMontantFixe());
            nouvelles.add(pc);
        }
        politiqueArgentPocheRepo.saveAll(nouvelles);
    }

    /** Copie toutes les allocations d'argent de poche ponctuelles du scénario source. */
    private void dupliquerAllocationsArgentPoche(UUID srcScenarioId, Scenario copie) {
        List<AllocationArgentPoche> srcAllocations =
                allocationArgentPocheRepo.findAllByScenarioIdOrderByMoisDesc(srcScenarioId);
        List<AllocationArgentPoche> nouvelles = new ArrayList<>();
        for (AllocationArgentPoche sa : srcAllocations) {
            AllocationArgentPoche ac = new AllocationArgentPoche();
            ac.setScenario(copie);
            ac.setMembre(sa.getMembre());
            ac.setCompte(sa.getCompte());
            ac.setMois(sa.getMois());
            ac.setMontant(sa.getMontant());
            ac.setRaison(sa.getRaison());
            nouvelles.add(ac);
        }
        allocationArgentPocheRepo.saveAll(nouvelles);
    }

    /** T7.3 — Définir comme référence (une seule référence par foyer). */
    public ScenarioDto definirReference(UUID foyerId, UUID scenarioId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.OWNER);

        scenarioRepo.findByFoyerIdAndEstReferenceTrue(foyerId)
                .ifPresent(ancien -> {
                    ancien.setEstReference(false);
                    scenarioRepo.save(ancien);
                });

        Scenario s = trouver(foyerId, scenarioId);
        s.setEstReference(true);
        return toDto(scenarioRepo.save(s));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void appliquer(Scenario s, ScenarioRequest req, UUID foyerId) {
        s.setNom(req.nom());
        s.setAnneeDepart(req.anneeDepart());
        s.setTresorerieInitiale(req.tresorerieInitiale() != null
                ? req.tresorerieInitiale() : BigDecimal.ZERO);
        s.setHorizonAnnees(req.horizonAnnees() > 0 ? req.horizonAnnees() : 9);
    }

    /**
     * Crée ou met à jour la période ouverte (fin=null) à partir des repartitions de la requête.
     * Si aucune période ouverte n'existe, crée une période dont début = anneeDepart-01-01.
     */
    private void creerOuMettreAJourPeriodeOuverte(Scenario s,
                                                   List<ScenarioRequest.RepartitionDefautDto> repartitions,
                                                   UUID foyerId) {
        RepartitionPeriode periode = periodeRepo.findOpenPeriode(s.getId())
                .orElseGet(() -> {
                    RepartitionPeriode np = new RepartitionPeriode();
                    np.setScenario(s);
                    np.setDebut(LocalDate.of(s.getAnneeDepart(), 1, 1));
                    np.setFin(null);
                    return np;
                });

        periode.getParts().clear();
        if (periode.getId() != null) periodeRepo.saveAndFlush(periode);

        for (int i = 0; i < repartitions.size(); i++) {
            ScenarioRequest.RepartitionDefautDto dto = repartitions.get(i);
            Membre m = membreRepo.findByIdAndFoyerId(dto.membreId(), foyerId)
                    .orElseThrow(() -> new RessourceIntrouvableException(
                            "Membre introuvable : " + dto.membreId()));
            RepartitionPeriodePart part = new RepartitionPeriodePart();
            part.setPeriode(periode);
            part.setMembre(m);
            part.setQuotePart(dto.quotePart());
            part.setOrdre(i);
            periode.getParts().add(part);
        }

        if (!s.getRepartitionsPeriodes().contains(periode)) {
            s.getRepartitionsPeriodes().add(periode);
        }
        periodeRepo.save(periode);
    }

    private void validerRepartition(List<ScenarioRequest.RepartitionDefautDto> reps) {
        if (reps == null || reps.isEmpty()) return;
        List<RepartitionCalcul> rcs = reps.stream()
                .map(r -> new RepartitionCalcul(r.membreId(), r.quotePart().doubleValue()))
                .toList();
        MoteurCalcul.validerRepartition(rcs);
    }

    private Scenario trouver(UUID foyerId, UUID scenarioId) {
        return scenarioRepo.findByIdAndFoyerId(scenarioId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Scénario introuvable : " + scenarioId));
    }

    private ScenarioDto toDto(Scenario s) {
        // Périodes depuis repartitionsPeriodes
        List<RepartitionPeriodeDto> periodes = s.getRepartitionsPeriodes().stream()
                .map(p -> {
                    List<RepartitionPeriodeDto.PartDto> parts = p.getParts().stream()
                            .map(pp -> new RepartitionPeriodeDto.PartDto(
                                    pp.getMembre().getId(),
                                    pp.getMembre().getNom(),
                                    pp.getMembre().getCouleur(),
                                    pp.getQuotePart(),
                                    pp.getOrdre()))
                            .toList();
                    return new RepartitionPeriodeDto(p.getId(), p.getDebut(), p.getFin(), parts);
                })
                .toList();

        // "repartitions" (rétro-compat DTO) = parts de la période ouverte
        List<ScenarioDto.RepartitionDefautDto> repsOuverte = periodes.stream()
                .filter(p -> p.fin() == null)
                .findFirst()
                .map(p -> p.parts().stream()
                        .map(pp -> new ScenarioDto.RepartitionDefautDto(
                                pp.membreId(), pp.nomMembre(), pp.quotePart()))
                        .toList())
                .orElse(List.of());

        return new ScenarioDto(s.getId(), s.getNom(), s.isEstReference(),
                s.getAnneeDepart(), s.getTresorerieInitiale(), s.getHorizonAnnees(),
                repsOuverte, periodes, s.getDateModification());
    }
}
