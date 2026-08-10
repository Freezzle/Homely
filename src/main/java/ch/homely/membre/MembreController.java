package ch.homely.membre;

import ch.homely.membre.dto.ComptePrimaireRequest;
import ch.homely.membre.dto.MembreDto;
import ch.homely.membre.dto.MembreRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * T6.1 — CRUD Membres scopé par foyer.
 */
@RestController
@RequestMapping("/api/foyers/{foyerId}/membres")
public class MembreController {

    private final MembreService membreService;

    public MembreController(MembreService membreService) {
        this.membreService = membreService;
    }

    @GetMapping
    public List<MembreDto> lister(@PathVariable UUID foyerId) {
        return membreService.lister(foyerId);
    }

    @GetMapping("/{membreId}")
    public MembreDto obtenir(@PathVariable UUID foyerId, @PathVariable UUID membreId) {
        return membreService.obtenir(foyerId, membreId);
    }

    @PostMapping
    public ResponseEntity<MembreDto> creer(@PathVariable UUID foyerId,
                                            @Valid @RequestBody MembreRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(membreService.creer(foyerId, req));
    }

    @PutMapping("/{membreId}")
    public MembreDto modifier(@PathVariable UUID foyerId, @PathVariable UUID membreId,
                               @Valid @RequestBody MembreRequest req) {
        return membreService.modifier(foyerId, membreId, req);
    }

    /** Désigne (ou retire, si {@code compteId} est {@code null}) le compte primaire
     *  du membre — le compte qui finance les virements entrants de ses autres comptes. */
    @PutMapping("/{membreId}/compte-primaire")
    public MembreDto definirComptePrimaire(@PathVariable UUID foyerId, @PathVariable UUID membreId,
                                            @Valid @RequestBody ComptePrimaireRequest req) {
        return membreService.definirComptePrimaire(foyerId, membreId, req);
    }

    @DeleteMapping("/{membreId}")
    public ResponseEntity<Void> supprimer(@PathVariable UUID foyerId, @PathVariable UUID membreId) {
        membreService.supprimer(foyerId, membreId);
        return ResponseEntity.noContent().build();
    }
}
