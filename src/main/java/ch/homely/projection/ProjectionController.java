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

    /** T8.3 — Ventilations mensuelles */
    @GetMapping("/mensuelle")
    public VentilationsDto mensuelle(@PathVariable UUID foyerId,
                                      @PathVariable UUID scenarioId,
                                      @RequestParam int annee,
                                      @RequestParam int mois) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.ventilations(foyerId, scenarioId, annee, mois);
    }
}
