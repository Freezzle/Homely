package ch.homely.objectif;

import ch.homely.objectif.dto.ObjectifDto;
import ch.homely.objectif.dto.ObjectifRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** T7.4 — CRUD Objectifs scopé par foyer/scénario. */
@RestController
@RequestMapping("/api/foyers/{foyerId}/scenarios/{scenarioId}/objectifs")
public class ObjectifController {

    private final ObjectifService objectifService;

    public ObjectifController(ObjectifService objectifService) {
        this.objectifService = objectifService;
    }

    @GetMapping
    public List<ObjectifDto> lister(@PathVariable UUID foyerId, @PathVariable UUID scenarioId) {
        return objectifService.lister(foyerId, scenarioId);
    }

    @GetMapping("/{objectifId}")
    public ObjectifDto obtenir(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                                @PathVariable UUID objectifId) {
        return objectifService.obtenir(foyerId, scenarioId, objectifId);
    }

    @PostMapping
    public ResponseEntity<ObjectifDto> creer(@PathVariable UUID foyerId,
                                              @PathVariable UUID scenarioId,
                                              @Valid @RequestBody ObjectifRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(objectifService.creer(foyerId, scenarioId, req));
    }

    @PutMapping("/{objectifId}")
    public ObjectifDto modifier(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                                 @PathVariable UUID objectifId,
                                 @Valid @RequestBody ObjectifRequest req) {
        return objectifService.modifier(foyerId, scenarioId, objectifId, req);
    }

    @DeleteMapping("/{objectifId}")
    public ResponseEntity<Void> supprimer(@PathVariable UUID foyerId,
                                           @PathVariable UUID scenarioId,
                                           @PathVariable UUID objectifId) {
        objectifService.supprimer(foyerId, scenarioId, objectifId);
        return ResponseEntity.noContent().build();
    }
}
