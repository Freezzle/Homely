package ch.homely.scenario;

import ch.homely.commun.CodesErreur;
import ch.homely.commun.ConflitException;
import ch.homely.commun.RegleMetierException;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.foyer.Foyer;
import ch.homely.foyer.FoyerRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.membre.Membre;
import ch.homely.membre.MembreRepository;
import ch.homely.moteur.MoteurCalcul;
import ch.homely.moteur.RepartitionCalcul;
import ch.homely.scenario.dto.ScenarioDto;
import ch.homely.scenario.dto.ScenarioRequest;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** T7.1 — CRUD Scénarios + RepartitionDefaut + dupliquer + définir référence. */
@Service
@Transactional
public class ScenarioService {

    private final ScenarioRepository scenarioRepo;
    private final FoyerRepository foyerRepo;
    private final MembreRepository membreRepo;
    private final MultiTenantService multiTenant;

    public ScenarioService(ScenarioRepository scenarioRepo, FoyerRepository foyerRepo,
                            MembreRepository membreRepo, MultiTenantService multiTenant) {
        this.scenarioRepo = scenarioRepo;
        this.foyerRepo    = foyerRepo;
        this.membreRepo   = membreRepo;
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

        validerRepartition(req.repartitions());

        Scenario s = new Scenario();
        s.setFoyer(foyer);
        appliquer(s, req, foyerId);
        return toDto(scenarioRepo.save(s));
    }

    public ScenarioDto modifier(UUID foyerId, UUID scenarioId, ScenarioRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Scenario s = trouver(foyerId, scenarioId);
        validerRepartition(req.repartitions());
        s.getRepartitionsDefaut().clear();
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

    /** T7.3 — Dupliquer un scénario (copie profonde). */
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

        for (RepartitionDefaut r : src.getRepartitionsDefaut()) {
            RepartitionDefaut rd = new RepartitionDefaut();
            rd.setScenario(copie);
            rd.setMembre(r.getMembre());
            rd.setQuotePart(r.getQuotePart());
            copie.getRepartitionsDefaut().add(rd);
        }

        return toDto(scenarioRepo.save(copie));
    }

    /** T7.3 — Définir comme référence (une seule référence par foyer). */
    public ScenarioDto definirReference(UUID foyerId, UUID scenarioId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.OWNER);

        // Désactiver l'ancienne référence
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

        for (ScenarioRequest.RepartitionDefautDto dto : req.repartitions()) {
            Membre m = membreRepo.findByIdAndFoyerId(dto.membreId(), foyerId)
                    .orElseThrow(() -> new RessourceIntrouvableException(
                            "Membre introuvable : " + dto.membreId()));
            RepartitionDefaut rd = new RepartitionDefaut();
            rd.setScenario(s);
            rd.setMembre(m);
            rd.setQuotePart(dto.quotePart());
            s.getRepartitionsDefaut().add(rd);
        }
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
        List<ScenarioDto.RepartitionDefautDto> reps = s.getRepartitionsDefaut().stream()
                .map(r -> new ScenarioDto.RepartitionDefautDto(
                        r.getMembre().getId(), r.getMembre().getNom(), r.getQuotePart()))
                .toList();
        return new ScenarioDto(s.getId(), s.getNom(), s.isEstReference(),
                s.getAnneeDepart(), s.getTresorerieInitiale(), s.getHorizonAnnees(),
                reps, s.getDateModification());
    }
}
