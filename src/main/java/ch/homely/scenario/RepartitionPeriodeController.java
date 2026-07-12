package ch.homely.scenario;

import ch.homely.scenario.dto.RepartitionPeriodeDto;
import ch.homely.scenario.dto.RepartitionPeriodeRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * CRUD des périodes de répartition d'un scénario.
 * URL : /api/foyers/{foyerId}/scenarios/{scenarioId}/periodes
 */
@RestController
@RequestMapping("/api/foyers/{foyerId}/scenarios/{scenarioId}/periodes")
public class RepartitionPeriodeController {

    private final RepartitionPeriodeService periodeService;

    public RepartitionPeriodeController(RepartitionPeriodeService periodeService) {
        this.periodeService = periodeService;
    }

    @GetMapping
    public List<RepartitionPeriodeDto> lister(@PathVariable UUID foyerId,
                                              @PathVariable UUID scenarioId) {
        return periodeService.lister(foyerId, scenarioId);
    }

    @PostMapping
    public ResponseEntity<RepartitionPeriodeDto> creer(@PathVariable UUID foyerId,
                                                       @PathVariable UUID scenarioId,
                                                       @Valid @RequestBody RepartitionPeriodeRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(periodeService.creer(foyerId, scenarioId, req));
    }

    @PutMapping("/{periodeId}")
    public RepartitionPeriodeDto modifier(@PathVariable UUID foyerId,
                                          @PathVariable UUID scenarioId,
                                          @PathVariable UUID periodeId,
                                          @Valid @RequestBody RepartitionPeriodeRequest req) {
        return periodeService.modifier(foyerId, scenarioId, periodeId, req);
    }

    @DeleteMapping("/{periodeId}")
    public ResponseEntity<Void> supprimer(@PathVariable UUID foyerId,
                                          @PathVariable UUID scenarioId,
                                          @PathVariable UUID periodeId) {
        periodeService.supprimer(foyerId, scenarioId, periodeId);
        return ResponseEntity.noContent().build();
    }
}

