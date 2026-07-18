package ch.homely.poste;

import ch.homely.poste.dto.PosteDto;
import ch.homely.poste.dto.PosteRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.WebDataBinder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** T7.2 — CRUD Postes scopé par foyer/scénario. */
@RestController
@RequestMapping("/api/foyers/{foyerId}/scenarios/{scenarioId}/postes")
public class PosteController {

    private final PosteService posteService;
    private final PosteValidator posteValidator;

    public PosteController(PosteService posteService, PosteValidator posteValidator) {
        this.posteService = posteService;
        this.posteValidator = posteValidator;
    }

    @InitBinder
    public void initBinder(WebDataBinder binder) {
        binder.addValidators(posteValidator);
    }

    @GetMapping
    public List<PosteDto> lister(@PathVariable UUID foyerId, @PathVariable UUID scenarioId) {
        return posteService.lister(foyerId, scenarioId);
    }

    @GetMapping("/{posteId}")
    public PosteDto obtenir(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                             @PathVariable UUID posteId) {
        return posteService.obtenir(foyerId, scenarioId, posteId);
    }

    @PostMapping
    public ResponseEntity<PosteDto> creer(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                                           @Valid @RequestBody PosteRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(posteService.creer(foyerId, scenarioId, req));
    }

    @PutMapping("/{posteId}")
    public PosteDto modifier(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                              @PathVariable UUID posteId, @Valid @RequestBody PosteRequest req) {
        return posteService.modifier(foyerId, scenarioId, posteId, req);
    }

    @DeleteMapping("/{posteId}")
    public ResponseEntity<Void> supprimer(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                                           @PathVariable UUID posteId) {
        posteService.supprimer(foyerId, scenarioId, posteId);
        return ResponseEntity.noContent().build();
    }
}
