package ch.homely.objectif;

import ch.homely.categorie.Categorie;
import ch.homely.categorie.CategorieRepository;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.compte.Compte;
import ch.homely.compte.CompteRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.objectif.dto.ObjectifDto;
import ch.homely.objectif.dto.ObjectifRequest;
import ch.homely.scenario.Scenario;
import ch.homely.scenario.ScenarioRepository;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * T7.4 — CRUD Objectif (support compte) + calculs doc 01 §10.
 * Calculs : progression, épargne requise, date prévue.
 */
@Service
@Transactional
public class ObjectifService {

    private final ObjectifRepository objectifRepo;
    private final ScenarioRepository scenarioRepo;
    private final CompteRepository compteRepo;
    private final CategorieRepository categorieRepo;
    private final MultiTenantService multiTenant;

    public ObjectifService(ObjectifRepository objectifRepo, ScenarioRepository scenarioRepo,
                           CompteRepository compteRepo,
                           CategorieRepository categorieRepo, MultiTenantService multiTenant) {
        this.objectifRepo  = objectifRepo;
        this.scenarioRepo  = scenarioRepo;
        this.compteRepo    = compteRepo;
        this.categorieRepo = categorieRepo;
        this.multiTenant   = multiTenant;
    }

    @Transactional(readOnly = true)
    public List<ObjectifDto> lister(UUID foyerId, UUID scenarioId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        verifierScenario(foyerId, scenarioId);
        return objectifRepo.findAllByScenarioIdOrderByDateCreation(scenarioId).stream()
                .map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public ObjectifDto obtenir(UUID foyerId, UUID scenarioId, UUID objectifId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        verifierScenario(foyerId, scenarioId);
        return toDto(trouver(scenarioId, objectifId));
    }

    public ObjectifDto creer(UUID foyerId, UUID scenarioId, ObjectifRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Scenario scenario = verifierScenario(foyerId, scenarioId);

        Objectif o = new Objectif();
        o.setScenario(scenario);
        appliquer(o, req, foyerId);
        return toDto(objectifRepo.save(o));
    }

    public ObjectifDto modifier(UUID foyerId, UUID scenarioId, UUID objectifId,
                                ObjectifRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        verifierScenario(foyerId, scenarioId);
        Objectif o = trouver(scenarioId, objectifId);
        appliquer(o, req, foyerId);
        return toDto(objectifRepo.save(o));
    }

    public void supprimer(UUID foyerId, UUID scenarioId, UUID objectifId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        verifierScenario(foyerId, scenarioId);
        objectifRepo.delete(trouver(scenarioId, objectifId));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void appliquer(Objectif o, ObjectifRequest req, UUID foyerId) {
        o.setLibelle(req.libelle());
        o.setMontantCible(req.montantCible());
        o.setEcheance(req.echeance());

        if (req.categorieProjetId() != null) {
            Categorie cat = categorieRepo.findByIdAndFoyerId(req.categorieProjetId(), foyerId)
                    .orElseThrow(() -> new RessourceIntrouvableException(
                            "Catégorie introuvable : " + req.categorieProjetId()));
            o.setCategorieProjet(cat);
        } else {
            o.setCategorieProjet(null);
        }

        Compte c = compteRepo.findByIdAndFoyerId(req.compteId(), foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Compte introuvable : " + req.compteId()));
        o.setCompte(c);
    }

    private Scenario verifierScenario(UUID foyerId, UUID scenarioId) {
        return scenarioRepo.findByIdAndFoyerId(scenarioId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Scénario introuvable : " + scenarioId));
    }

    private Objectif trouver(UUID scenarioId, UUID objectifId) {
        return objectifRepo.findByIdAndScenarioId(objectifId, scenarioId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Objectif introuvable : " + objectifId));
    }

    /**
     * Calcule et retourne le DTO avec les champs dérivés (doc 01 §10).
     * soldeActuel = soldeInitial du compte (valeur de référence du seed).
     * progression = min(1, soldeActuel / montantCible).
     * epargneRequise = (montantCible - soldeActuel) / moisRestants  (0 si dépassé).
     */
    private ObjectifDto toDto(Objectif o) {
        BigDecimal soldeActuel = BigDecimal.ZERO;
        UUID compteId = null;

        if (o.getCompte() != null) {
            compteId    = o.getCompte().getId();
            soldeActuel = o.getCompte().getSoldeInitial();
        }

        BigDecimal cible = o.getMontantCible();
        BigDecimal progression = cible.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ONE
                : soldeActuel.divide(cible, 6, RoundingMode.HALF_UP)
                             .min(BigDecimal.ONE)
                             .max(BigDecimal.ZERO);

        BigDecimal epargneRequise = BigDecimal.ZERO;
        if (o.getEcheance() != null) {
            long moisRestants = ChronoUnit.MONTHS.between(LocalDate.now(), o.getEcheance());
            if (moisRestants > 0) {
                BigDecimal manque = cible.subtract(soldeActuel).max(BigDecimal.ZERO);
                epargneRequise = manque.divide(BigDecimal.valueOf(moisRestants), 2, RoundingMode.HALF_UP);
            }
        }

        return new ObjectifDto(
                o.getId(), o.getLibelle(),
                o.getCategorieProjet() != null ? o.getCategorieProjet().getId() : null,
                cible, o.getEcheance(),
                compteId,
                soldeActuel.setScale(2, RoundingMode.HALF_UP),
                progression.setScale(4, RoundingMode.HALF_UP),
                epargneRequise
        );
    }
}
