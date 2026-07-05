package ch.homely.actif;

import ch.homely.actif.dto.ActifDto;
import ch.homely.actif.dto.ActifRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** T6.1 — CRUD Actifs scopé par foyer. */
@RestController
@RequestMapping("/api/foyers/{foyerId}/actifs")
public class ActifController {

    private final ActifService actifService;

    public ActifController(ActifService actifService) {
        this.actifService = actifService;
    }

    @GetMapping
    public List<ActifDto> lister(@PathVariable UUID foyerId) {
        return actifService.lister(foyerId);
    }

    @GetMapping("/{actifId}")
    public ActifDto obtenir(@PathVariable UUID foyerId, @PathVariable UUID actifId) {
        return actifService.obtenir(foyerId, actifId);
    }

    @PostMapping
    public ResponseEntity<ActifDto> creer(@PathVariable UUID foyerId,
                                           @Valid @RequestBody ActifRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(actifService.creer(foyerId, req));
    }

    @PutMapping("/{actifId}")
    public ActifDto modifier(@PathVariable UUID foyerId, @PathVariable UUID actifId,
                              @Valid @RequestBody ActifRequest req) {
        return actifService.modifier(foyerId, actifId, req);
    }

    @DeleteMapping("/{actifId}")
    public ResponseEntity<Void> supprimer(@PathVariable UUID foyerId, @PathVariable UUID actifId) {
        actifService.supprimer(foyerId, actifId);
        return ResponseEntity.noContent().build();
    }
}
