package ch.homely.compte;

import ch.homely.compte.dto.CompteDto;
import ch.homely.compte.dto.CompteRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** T6.1 — CRUD Comptes scopé par foyer. */
@RestController
@RequestMapping("/api/foyers/{foyerId}/comptes")
public class CompteController {

    private final CompteService compteService;

    public CompteController(CompteService compteService) {
        this.compteService = compteService;
    }

    @GetMapping
    public List<CompteDto> lister(@PathVariable UUID foyerId) {
        return compteService.lister(foyerId);
    }

    @GetMapping("/{compteId}")
    public CompteDto obtenir(@PathVariable UUID foyerId, @PathVariable UUID compteId) {
        return compteService.obtenir(foyerId, compteId);
    }

    @PostMapping
    public ResponseEntity<CompteDto> creer(@PathVariable UUID foyerId,
                                            @Valid @RequestBody CompteRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(compteService.creer(foyerId, req));
    }

    @PutMapping("/{compteId}")
    public CompteDto modifier(@PathVariable UUID foyerId, @PathVariable UUID compteId,
                               @Valid @RequestBody CompteRequest req) {
        return compteService.modifier(foyerId, compteId, req);
    }

    @DeleteMapping("/{compteId}")
    public ResponseEntity<Void> supprimer(@PathVariable UUID foyerId, @PathVariable UUID compteId) {
        compteService.supprimer(foyerId, compteId);
        return ResponseEntity.noContent().build();
    }
}
