package ch.homely.scenario;

import ch.homely.scenario.dto.ScenarioDto;
import ch.homely.scenario.dto.ScenarioRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** T7.1 / T7.3 — CRUD Scénarios + actions spéciales. */
@RestController
@RequestMapping("/api/foyers/{foyerId}/scenarios")
public class ScenarioController {

    private final ScenarioService scenarioService;

    public ScenarioController(ScenarioService scenarioService) {
        this.scenarioService = scenarioService;
    }

    @GetMapping
    public List<ScenarioDto> lister(@PathVariable UUID foyerId) {
        return scenarioService.lister(foyerId);
    }

    @GetMapping("/{scenarioId}")
    public ScenarioDto obtenir(@PathVariable UUID foyerId, @PathVariable UUID scenarioId) {
        return scenarioService.obtenir(foyerId, scenarioId);
    }

    @PostMapping
    public ResponseEntity<ScenarioDto> creer(@PathVariable UUID foyerId,
                                              @Valid @RequestBody ScenarioRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(scenarioService.creer(foyerId, req));
    }

    @PutMapping("/{scenarioId}")
    public ScenarioDto modifier(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                                 @Valid @RequestBody ScenarioRequest req) {
        return scenarioService.modifier(foyerId, scenarioId, req);
    }

    @DeleteMapping("/{scenarioId}")
    public ResponseEntity<Void> supprimer(@PathVariable UUID foyerId, @PathVariable UUID scenarioId) {
        scenarioService.supprimer(foyerId, scenarioId);
        return ResponseEntity.noContent().build();
    }

    /** POST /scenarios/{id}:dupliquer */
    @PostMapping("/{scenarioId}:dupliquer")
    public ResponseEntity<ScenarioDto> dupliquer(@PathVariable UUID foyerId,
                                                  @PathVariable UUID scenarioId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(scenarioService.dupliquer(foyerId, scenarioId));
    }

    /** POST /scenarios/{id}:definir-reference */
    @PostMapping("/{scenarioId}:definir-reference")
    public ScenarioDto definirReference(@PathVariable UUID foyerId, @PathVariable UUID scenarioId) {
        return scenarioService.definirReference(foyerId, scenarioId);
    }
}
