package ch.homely.projection;

import ch.homely.foyer.RoleFoyer;
import ch.homely.projection.dto.*;
import ch.homely.securite.MultiTenantService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * T8.1-T8.6 — Endpoints de projection scopés par foyer/scénario.
 */
@RestController
@RequestMapping("/api/foyers/{foyerId}/scenarios/{scenarioId}/projection")
public class ProjectionController {

    private final ProjectionService projectionService;
    private final MultiTenantService multiTenant;

    public ProjectionController(ProjectionService projectionService,
                                 MultiTenantService multiTenant) {
        this.projectionService = projectionService;
        this.multiTenant       = multiTenant;
    }

    /** T8.1 — Projection annuelle pour une année */
    @GetMapping("/annuelle")
    public ProjectionAnnuelleDto annuelle(@PathVariable UUID foyerId,
                                          @PathVariable UUID scenarioId,
                                          @RequestParam int annee) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.projectionAnnuelle(foyerId, scenarioId, annee);
    }

    /** T8.1 — Projection complète (toutes les années de l'horizon) */
    @GetMapping("/annuelle-complete")
    public List<ProjectionAnnuelleDto> annuelleComplete(@PathVariable UUID foyerId,
                                                         @PathVariable UUID scenarioId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.projectionAnnuelleComplete(foyerId, scenarioId);
    }

    /** T8.2 — Trésorerie chaînée + courbe mensuelle */
    @GetMapping("/tresorerie")
    public TresorerieDto tresorerie(@PathVariable UUID foyerId,
                                     @PathVariable UUID scenarioId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.tresorerie(foyerId, scenarioId);
    }

    /** Courbe de trésorerie cumulée d'une année, scopée au sujet (foyer, ou membre si
     *  {@code membreId} fourni) — séries mensualisée + réelle. Remplace le cumul
     *  auparavant recalculé côté dashboard. */
    @GetMapping("/tresorerie-cumulee")
    public TresorerieCumuleeDto tresorerieCumulee(@PathVariable UUID foyerId,
                                                  @PathVariable UUID scenarioId,
                                                  @RequestParam int annee,
                                                  @RequestParam(required = false) UUID membreId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.tresorerieCumulee(foyerId, scenarioId, annee, membreId);
    }

    /** T8.3 — Ventilations mensuelles */
    @GetMapping("/mensuelle")
    public VentilationsDto mensuelle(@PathVariable UUID foyerId,
                                      @PathVariable UUID scenarioId,
                                      @RequestParam int annee,
                                      @RequestParam int mois) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.ventilations(foyerId, scenarioId, annee, mois);
    }

    /** Optimisation T8.3 — Décomposition annuelle agrégée (somme des 12 mois), calculée en
     *  une seule requête serveur pour éviter au frontend de faire 12 appels {@code /mensuelle}. */
    @GetMapping("/ventilation-annuelle")
    public VentilationAnnuelleDto ventilationAnnuelle(@PathVariable UUID foyerId,
                                                        @PathVariable UUID scenarioId,
                                                        @RequestParam int annee) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.ventilationsAnnuelle(foyerId, scenarioId, annee);
    }

    /** Indicateur 04 — Taux d'effort par membre pour un mois donné (normal + pire cas). */
    @GetMapping("/taux-effort")
    public List<TauxEffortMembreDto> tauxEffort(@PathVariable UUID foyerId,
                                                 @PathVariable UUID scenarioId,
                                                 @RequestParam int annee,
                                                 @RequestParam int mois) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.tauxEffort(foyerId, scenarioId, annee, mois);
    }

    /** Indicateur 04 — Taux d'effort par membre, calculé sur l'année entière (somme des 12
     *  mois, normal + pire cas). Réservé au dashboard annuel. */
    @GetMapping("/taux-effort-annuel")
    public List<TauxEffortMembreDto> tauxEffortAnnuel(@PathVariable UUID foyerId,
                                                       @PathVariable UUID scenarioId,
                                                       @RequestParam int annee) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.tauxEffortAnnuel(foyerId, scenarioId, annee);
    }

    /** Indicateur "Prorata des postes partagés" — mois donné : prorata moyen appliqué
     *  (pondéré par montant) vs prorata théorique selon les revenus, par membre. */
    @GetMapping("/prorata-partage")
    public List<ProrataPartageMembreDto> prorataPartage(@PathVariable UUID foyerId,
                                                          @PathVariable UUID scenarioId,
                                                          @RequestParam int annee,
                                                          @RequestParam int mois) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.prorataPartage(foyerId, scenarioId, annee, mois);
    }

    /** Indicateur "Prorata des postes partagés" — variante annuelle (somme des 12 mois).
     *  Réservé au dashboard annuel. */
    @GetMapping("/prorata-partage-annuel")
    public List<ProrataPartageMembreDto> prorataPartageAnnuel(@PathVariable UUID foyerId,
                                                                @PathVariable UUID scenarioId,
                                                                @RequestParam int annee) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.prorataPartageAnnuel(foyerId, scenarioId, annee);
    }

    /** Événements budgétaires ("ce qui change") pour une année : début, fin, révision, occurrence.
     *  Si {@code membreId} est fourni, ne renvoie que les événements où sa quote-part effective
     *  est &gt; 0 ce mois-là, avec les montants déjà proratisés (voir {@link EvenementDto#quotePart()}). */
    @GetMapping("/evenements")
    public List<EvenementDto> evenements(@PathVariable UUID foyerId,
                                          @PathVariable UUID scenarioId,
                                          @RequestParam int annee,
                                          @RequestParam(required = false) UUID membreId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.evenements(foyerId, scenarioId, annee, membreId);
    }

    /** Récapitulatif mensuel de trésorerie par compte (dashboard, vue membre) : virements
     * entrants simulés, entrées/sorties échues, solde restant. */
    @GetMapping("/comptes-recap")
    public List<CompteRecapMensuelDto> comptesRecap(@PathVariable UUID foyerId,
                                                     @PathVariable UUID scenarioId,
                                                     @RequestParam int annee,
                                                     @RequestParam int mois,
                                                     @RequestParam UUID membreId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.recapComptesMembre(foyerId, scenarioId, annee, mois, membreId);
    }

    /** Variante annuelle de {@link #comptesRecap} (dashboard, vue membre annuelle) : flux
     * sommés sur les 12 mois de l'année, solde restant = instantané fin décembre. */
    @GetMapping("/comptes-recap-annuel")
    public List<CompteRecapMensuelDto> comptesRecapAnnuel(@PathVariable UUID foyerId,
                                                           @PathVariable UUID scenarioId,
                                                           @RequestParam int annee,
                                                           @RequestParam UUID membreId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.recapComptesMembreAnnuel(foyerId, scenarioId, annee, membreId);
    }

    /** Détail poste par poste (+ argent de poche éventuel) alimentant un compte donné,
     * pour un membre et un mois donnés — affiché en liste lorsqu'un compte est sélectionné
     * dans la vue "Virements des comptes" (org-chart hub & rayons). */
    @GetMapping("/comptes-recap/postes")
    public List<ComptePosteDetailDto> comptePostes(@PathVariable UUID foyerId,
                                                    @PathVariable UUID scenarioId,
                                                    @RequestParam int annee,
                                                    @RequestParam int mois,
                                                    @RequestParam UUID membreId,
                                                    @RequestParam UUID compteId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.recapComptePostes(foyerId, scenarioId, annee, mois, membreId, compteId);
    }
}
