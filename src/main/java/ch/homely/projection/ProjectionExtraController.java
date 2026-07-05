package ch.homely.projection;

import ch.homely.foyer.RoleFoyer;
import ch.homely.projection.dto.ApercuPosteDto;
import ch.homely.projection.dto.ComparaisonDto;
import ch.homely.securite.MultiTenantService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * T8.5-T8.6 — Comparaison multi-scénarios et aperçu poste.
 * Route séparée car T8.5 n'est pas scopé à un scénario unique.
 */
@RestController
@RequestMapping("/api/foyers/{foyerId}")
public class ProjectionExtraController {

    private final ProjectionService projectionService;
    private final MultiTenantService multiTenant;

    public ProjectionExtraController(ProjectionService projectionService,
                                      MultiTenantService multiTenant) {
        this.projectionService = projectionService;
        this.multiTenant       = multiTenant;
    }

    /** T8.5 — Comparaison multi-scénarios (query param scenarioIds=id1,id2,...) */
    @GetMapping("/projection/comparaison")
    public ComparaisonDto comparaison(@PathVariable UUID foyerId,
                                       @RequestParam List<UUID> scenarioIds) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.comparaison(foyerId, scenarioIds);
    }

    /** T8.6 — Aperçu mensuel d'un poste */
    @GetMapping("/scenarios/{scenarioId}/postes/{posteId}/apercu")
    public ApercuPosteDto apercu(@PathVariable UUID foyerId,
                                  @PathVariable UUID scenarioId,
                                  @PathVariable UUID posteId,
                                  @RequestParam int annee) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return projectionService.apercuPoste(foyerId, scenarioId, posteId, annee);
    }
}
