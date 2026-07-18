package ch.homely.foyer;

import ch.homely.foyer.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;

import java.util.List;
import java.util.UUID;

/**
 * T4.3 / T4.4 — Endpoints foyers et accès.
 * Scoping multi-tenant : tout endpoint sensible vérifie l'appartenance via FoyerService.
 */
@RestController
@RequestMapping("/api/foyers")
public class FoyerController {

    private final FoyerService foyerService;

    public FoyerController(FoyerService foyerService) {
        this.foyerService = foyerService;
    }

    /** GET /api/foyers — liste des foyers accessibles à l'utilisateur courant */
    @GetMapping
    public List<FoyerDto> lister() {
        return foyerService.listerMesFoyers();
    }

    /** POST /api/foyers — créer un foyer */
    @PostMapping
    public ResponseEntity<FoyerDto> creer(@Valid @RequestBody FoyerRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(foyerService.creer(req));
    }

    /**
     * POST /api/foyers/onboarding — wizard de création guidée d'un foyer.
     * Crée en une transaction : foyer, membres, catégories, comptes, scénario de référence.
     */
    @Operation(summary = "Wizard d'onboarding : crée un foyer complet en une transaction")
    @PostMapping("/onboarding")
    public ResponseEntity<FoyerOnboardingResponse> creerAvecOnboarding(
            @Valid @RequestBody FoyerOnboardingRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(foyerService.creerAvecOnboarding(req));
    }

    /** GET /api/foyers/{foyerId} */
    @GetMapping("/{foyerId}")
    public FoyerDto obtenir(@PathVariable UUID foyerId) {
        return foyerService.obtenir(foyerId);
    }

    /** PUT /api/foyers/{foyerId} */
    @PutMapping("/{foyerId}")
    public FoyerDto modifier(@PathVariable UUID foyerId, @Valid @RequestBody FoyerRequest req) {
        return foyerService.modifier(foyerId, req);
    }

    /** DELETE /api/foyers/{foyerId} */
    @DeleteMapping("/{foyerId}")
    public ResponseEntity<Void> supprimer(@PathVariable UUID foyerId) {
        foyerService.supprimer(foyerId);
        return ResponseEntity.noContent().build();
    }

    // ── Accès ─────────────────────────────────────────────────────────────────

    /** GET /api/foyers/{foyerId}/acces */
    @GetMapping("/{foyerId}/acces")
    public List<AccesFoyerDto> listerAcces(@PathVariable UUID foyerId) {
        return foyerService.listerAcces(foyerId);
    }

    /** POST /api/foyers/{foyerId}/acces */
    @PostMapping("/{foyerId}/acces")
    public ResponseEntity<AccesFoyerDto> inviter(@PathVariable UUID foyerId,
                                                   @Valid @RequestBody InviterAccesRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(foyerService.inviter(foyerId, req));
    }

    /** PATCH /api/foyers/{foyerId}/acces/{accesId} */
    @PatchMapping("/{foyerId}/acces/{accesId}")
    public AccesFoyerDto changerRole(@PathVariable UUID foyerId,
                                      @PathVariable UUID accesId,
                                      @Valid @RequestBody ChangerRoleRequest req) {
        return foyerService.changerRole(foyerId, accesId, req);
    }

    /** DELETE /api/foyers/{foyerId}/acces/{accesId} */
    @DeleteMapping("/{foyerId}/acces/{accesId}")
    public ResponseEntity<Void> retirerAcces(@PathVariable UUID foyerId,
                                              @PathVariable UUID accesId) {
        foyerService.retirerAcces(foyerId, accesId);
        return ResponseEntity.noContent().build();
    }
}
