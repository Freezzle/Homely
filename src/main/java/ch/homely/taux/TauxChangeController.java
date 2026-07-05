package ch.homely.taux;

import ch.homely.taux.dto.TauxChangeDto;
import ch.homely.taux.dto.TauxChangeRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** T6.1 — CRUD TauxChange scopé par foyer. */
@RestController
@RequestMapping("/api/foyers/{foyerId}/taux-change")
public class TauxChangeController {

    private final TauxChangeService tauxService;

    public TauxChangeController(TauxChangeService tauxService) {
        this.tauxService = tauxService;
    }

    @GetMapping
    public List<TauxChangeDto> lister(@PathVariable UUID foyerId) {
        return tauxService.lister(foyerId);
    }

    /** PUT = upsert (crée ou met à jour selon la devise). */
    @PutMapping
    public TauxChangeDto creerOuModifier(@PathVariable UUID foyerId,
                                          @Valid @RequestBody TauxChangeRequest req) {
        return tauxService.creerOuModifier(foyerId, req);
    }

    @DeleteMapping("/{tauxId}")
    public ResponseEntity<Void> supprimer(@PathVariable UUID foyerId, @PathVariable UUID tauxId) {
        tauxService.supprimer(foyerId, tauxId);
        return ResponseEntity.noContent().build();
    }
}
