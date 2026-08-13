package ch.homely.poste;

import ch.homely.poste.dto.BesoinsPlaisirsDto;
import ch.homely.poste.dto.PosteActionGroupeeRequest;
import ch.homely.poste.dto.PosteClotureRequest;
import ch.homely.poste.dto.PosteDecalerDateEffetRequest;
import ch.homely.poste.dto.PosteDecalerDateEffetResponse;
import ch.homely.poste.dto.PosteDto;
import ch.homely.poste.dto.PostePositionneDto;
import ch.homely.poste.dto.PosteRequest;
import ch.homely.poste.dto.PosteRevisionRequest;
import ch.homely.poste.dto.PosteRevisionResponse;
import ch.homely.poste.dto.PosteSuppressionGroupeeRequest;
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
    private final MatriceBudgetaireService matriceBudgetaireService;
    private final BesoinsPlaisirsService besoinsPlaisirsService;

    public PosteController(PosteService posteService, PosteValidator posteValidator,
                            MatriceBudgetaireService matriceBudgetaireService,
                            BesoinsPlaisirsService besoinsPlaisirsService) {
        this.posteService = posteService;
        this.posteValidator = posteValidator;
        this.matriceBudgetaireService = matriceBudgetaireService;
        this.besoinsPlaisirsService = besoinsPlaisirsService;
    }

    @InitBinder("posteRequest")
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

    /** Postes "à optimiser en priorité" (dashboard annuel et mensuel) : postes
     *  CHARGE/RESERVE non obsolètes de la période, dédupliqués par chaîne de révisions,
     *  classés par score unique (0-100) et tronqués aux
     *  {@value MatriceBudgetaireService#TOP_N} premiers — tout calculé côté serveur. Si
     *  {@code mois} est fourni, ne considère que ce mois (postes actifs ce mois-là,
     *  montant réel de ce seul mois) ; sinon cumule les 12 mois de {@code annee}. Si
     *  {@code membreId} est fourni, ne renvoie que les postes qui le concernent. */
    @GetMapping("/matrice-budgetaire")
    public List<PostePositionneDto> matriceBudgetaire(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                                                        @RequestParam int annee,
                                                        @RequestParam(required = false) Integer mois,
                                                        @RequestParam(required = false) UUID membreId) {
        return mois != null
                ? matriceBudgetaireService.calculerMois(foyerId, scenarioId, annee, mois, membreId)
                : matriceBudgetaireService.calculerAnnee(foyerId, scenarioId, annee, membreId);
    }

    /** Indicateur dashboard "Plaisirs vs Besoins" : répartition des charges (necessite
     *  1-3 = Plaisirs, 4-5 = Besoins) sur la période demandée. {@code mois} absent ⇒
     *  cumul annuel ; sinon uniquement ce mois. Si {@code membreId} est fourni, ne
     *  compte que la quote-part effective du membre. */
    @GetMapping("/besoins-plaisirs")
    public BesoinsPlaisirsDto besoinsPlaisirs(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                                               @RequestParam int annee,
                                               @RequestParam(required = false) Integer mois,
                                               @RequestParam(required = false) UUID membreId) {
        return mois != null
                ? besoinsPlaisirsService.calculerMois(foyerId, scenarioId, annee, mois, membreId)
                : besoinsPlaisirsService.calculerAnnee(foyerId, scenarioId, annee, membreId);
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

    @PostMapping("/actions-groupees")
    public List<PosteDto> actionsGroupees(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                                           @Valid @RequestBody PosteActionGroupeeRequest req) {
        return posteService.mettreAJourGroupee(foyerId, scenarioId, req);
    }

    @PostMapping("/supprimer-groupe")
    public ResponseEntity<Void> supprimerGroupe(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                                                 @Valid @RequestBody PosteSuppressionGroupeeRequest req) {
        posteService.supprimerGroupe(foyerId, scenarioId, req);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{posteId}/reviser-montant")
    public PosteRevisionResponse reviserMontant(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                                                 @PathVariable UUID posteId,
                                                 @Valid @RequestBody PosteRevisionRequest req) {
        return posteService.reviserMontant(foyerId, scenarioId, posteId, req);
    }

    @PostMapping("/{posteId}/annuler-revision")
    public PosteDto annulerRevision(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                                     @PathVariable UUID posteId) {
        return posteService.annulerRevision(foyerId, scenarioId, posteId);
    }

    @PostMapping("/{posteId}/decaler-date-effet")
    public PosteDecalerDateEffetResponse decalerDateEffet(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                                                            @PathVariable UUID posteId,
                                                            @Valid @RequestBody PosteDecalerDateEffetRequest req) {
        return posteService.decalerDateEffet(foyerId, scenarioId, posteId, req);
    }

    @PostMapping("/{posteId}/cloturer")
    public PosteDto cloturer(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                              @PathVariable UUID posteId, @Valid @RequestBody PosteClotureRequest req) {
        return posteService.cloturer(foyerId, scenarioId, posteId, req);
    }

    @PostMapping("/{posteId}/reactiver")
    public PosteDto reactiver(@PathVariable UUID foyerId, @PathVariable UUID scenarioId,
                               @PathVariable UUID posteId) {
        return posteService.reactiver(foyerId, scenarioId, posteId);
    }
}
