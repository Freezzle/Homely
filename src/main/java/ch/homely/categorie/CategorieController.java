package ch.homely.categorie;

import ch.homely.categorie.dto.CategorieDto;
import ch.homely.categorie.dto.CategorieRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** T6.1 — CRUD Catégories scopé par foyer. */
@RestController
@RequestMapping("/api/foyers/{foyerId}/categories")
public class CategorieController {

    private final CategorieService categorieService;

    public CategorieController(CategorieService categorieService) {
        this.categorieService = categorieService;
    }

    @GetMapping
    public List<CategorieDto> lister(@PathVariable UUID foyerId,
                                      @RequestParam(required = false) TypeCategorie typePoste) {
        return categorieService.lister(foyerId, typePoste);
    }

    @GetMapping("/{categorieId}")
    public CategorieDto obtenir(@PathVariable UUID foyerId, @PathVariable UUID categorieId) {
        return categorieService.obtenir(foyerId, categorieId);
    }

    @PostMapping
    public ResponseEntity<CategorieDto> creer(@PathVariable UUID foyerId,
                                               @Valid @RequestBody CategorieRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(categorieService.creer(foyerId, req));
    }

    @PutMapping("/{categorieId}")
    public CategorieDto modifier(@PathVariable UUID foyerId, @PathVariable UUID categorieId,
                                  @Valid @RequestBody CategorieRequest req) {
        return categorieService.modifier(foyerId, categorieId, req);
    }

    @DeleteMapping("/{categorieId}")
    public ResponseEntity<Void> supprimer(@PathVariable UUID foyerId, @PathVariable UUID categorieId,
                                           @RequestParam(required = false) UUID migrerVersCategorieId) {
        categorieService.supprimer(foyerId, categorieId, migrerVersCategorieId);
        return ResponseEntity.noContent().build();
    }
}
