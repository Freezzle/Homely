package ch.homely.poche;

import ch.homely.foyer.RoleFoyer;
import ch.homely.moteur.ArgentDePocheProvider;
import ch.homely.moteur.MoteurCalcul;
import ch.homely.moteur.ParametresScenario;
import ch.homely.poche.dto.*;
import ch.homely.projection.ProjectionService;
import ch.homely.securite.MultiTenantService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/**
 * API REST — argent de poche, scopée par {@code (foyer, scénario)}.
 *
 * <p>Pattern d'URL scopé sous
 * {@code /api/foyers/{foyerId}/scenarios/{scenarioId}/argent-poche} qui met en
 * évidence le scope multi-tenant à la lecture du log/tracing.</p>
 *
 * <p>Le contrôle d'accès (rôle {@code VIEWER} en lecture, {@code EDITOR} en
 * écriture) est réalisé <b>dans le service métier</b> — le controller ne fait
 * que router. Pattern déjà en place dans le repo.</p>
 */
@RestController
@RequestMapping("/api/foyers/{foyerId}/scenarios/{scenarioId}/argent-poche")
public class ArgentPocheController {

    private final ArgentPocheService service;
    private final ArgentPocheMapper mapper;
    private final ProjectionService projectionService;
    private final MultiTenantService multiTenant;

    public ArgentPocheController(ArgentPocheService service,
                                 ArgentPocheMapper mapper,
                                 ProjectionService projectionService,
                                 MultiTenantService multiTenant) {
        this.service           = service;
        this.mapper            = mapper;
        this.projectionService = projectionService;
        this.multiTenant       = multiTenant;
    }

    // ── Politiques ──────────────────────────────────────────────────────────

    @GetMapping("/politiques")
    public List<PolitiqueArgentPocheDto> listerPolitiques(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @RequestParam(required = false) UUID membreId) {
        return service.listerPolitiques(foyerId, scenarioId, membreId).stream()
                .map(mapper::toDto).toList();
    }

    @GetMapping("/politiques/{id}")
    public PolitiqueArgentPocheDto obtenirPolitique(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @PathVariable UUID id) {
        return mapper.toDto(service.obtenirPolitique(foyerId, scenarioId, id));
    }

    @PostMapping("/politiques")
    public ResponseEntity<PolitiqueArgentPocheDto> creerPolitique(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @Valid @RequestBody PolitiqueArgentPocheRequest req) {
        PolitiqueArgentPoche p = service.creerPolitique(
                foyerId, scenarioId, req.membreId(), req.compteId(), req.nom(),
                req.dateDebut(), req.dateFin(), req.mode(),
                req.socle(), req.pourcentage(), req.plafond(), req.montantFixe());
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toDto(p));
    }

    @PutMapping("/politiques/{id}")
    public PolitiqueArgentPocheDto modifierPolitique(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @PathVariable UUID id,
            @Valid @RequestBody PolitiqueArgentPocheRequest req) {
        PolitiqueArgentPoche p = service.modifierPolitique(
                foyerId, scenarioId, id, req.membreId(), req.compteId(), req.nom(),
                req.dateDebut(), req.dateFin(), req.mode(),
                req.socle(), req.pourcentage(), req.plafond(), req.montantFixe());
        return mapper.toDto(p);
    }

    @DeleteMapping("/politiques/{id}")
    public ResponseEntity<Void> supprimerPolitique(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @PathVariable UUID id) {
        service.supprimerPolitique(foyerId, scenarioId, id);
        return ResponseEntity.noContent().build();
    }

    // ── Allocations ─────────────────────────────────────────────────────────

    @GetMapping("/allocations")
    public List<AllocationArgentPocheDto> listerAllocations(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @RequestParam(required = false) UUID membreId) {
        return service.listerAllocations(foyerId, scenarioId, membreId).stream()
                .map(mapper::toDto).toList();
    }

    @GetMapping("/allocations/{id}")
    public AllocationArgentPocheDto obtenirAllocation(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @PathVariable UUID id) {
        return mapper.toDto(service.obtenirAllocation(foyerId, scenarioId, id));
    }

    @PostMapping("/allocations")
    public ResponseEntity<AllocationArgentPocheDto> creerAllocation(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @Valid @RequestBody AllocationArgentPocheRequest req) {
        AllocationArgentPoche a = service.creerAllocation(
                foyerId, scenarioId, req.membreId(), req.compteId(),
                req.mois(), req.montant(), req.raison());
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toDto(a));
    }

    @PutMapping("/allocations/{id}")
    public AllocationArgentPocheDto modifierAllocation(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @PathVariable UUID id,
            @Valid @RequestBody AllocationArgentPocheRequest req) {
        AllocationArgentPoche a = service.modifierAllocation(
                foyerId, scenarioId, id, req.membreId(), req.compteId(),
                req.mois(), req.montant(), req.raison());
        return mapper.toDto(a);
    }

    @DeleteMapping("/allocations/{id}")
    public ResponseEntity<Void> supprimerAllocation(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @PathVariable UUID id) {
        service.supprimerAllocation(foyerId, scenarioId, id);
        return ResponseEntity.noContent().build();
    }

    // ── Résolution (endpoint dashboard) ─────────────────────────────────────

    /**
     * Résolution du montant d'argent de poche pour un {@code (membre, mois)}.
     * Utilisé par le widget dashboard membre (PR5) pour afficher le montant et
     * sa source ({@code allocation}, {@code politique}, {@code aucune}).
     *
     * <p>Le RàV utilisé pour la formule est recalculé à la volée via le moteur
     * ({@code aggregatMembreMois}) — la source de vérité reste unique et la
     * réponse est déterministe.</p>
     */
    @GetMapping("/resolution")
    public ResolutionArgentPocheDto resolution(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @RequestParam UUID membreId,
            @RequestParam
            @DateTimeFormat(pattern = "yyyy-MM") YearMonth mois) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);

        ParametresScenario paramsBrut = chargerParametresBruts(foyerId, scenarioId);
        double ravBrut = MoteurCalcul.aggregatMembreMois(
                paramsBrut, membreId, mois.getYear(), mois.getMonthValue()).soldeDisponible();

        ResolutionArgentPoche r = service.resoudre(scenarioId, membreId, mois, ravBrut);
        return toDto(r);
    }

    /**
     * Résolution mensuelle sur une année complète pour un membre — utilisée par
     * le widget dashboard (PR5) pour afficher le total annuel d'argent de poche
     * sans multiplier les allers-retours réseau (12 mois retournés en une seule
     * requête). Le RàV brut est reconstitué une fois pour toute l'année.
     */
    @GetMapping("/resolution-annee")
    public List<ResolutionArgentPocheDto> resolutionAnnee(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @RequestParam UUID membreId,
            @RequestParam int annee) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);

        ParametresScenario paramsBrut = chargerParametresBruts(foyerId, scenarioId);

        List<ResolutionArgentPocheDto> resultats = new java.util.ArrayList<>(12);
        for (int m = 1; m <= 12; m++) {
            YearMonth ym = YearMonth.of(annee, m);
            double ravBrut = MoteurCalcul.aggregatMembreMois(
                    paramsBrut, membreId, annee, m).soldeDisponible();
            ResolutionArgentPoche r = service.resoudre(scenarioId, membreId, ym, ravBrut);
            resultats.add(toDto(r));
        }
        return resultats;
    }

    /**
     * RàV <b>brut</b> (avant tout retrait d'argent de poche) sur les 12 mois
     * d'une année, pour un membre — <b>indépendant</b> de toute politique ou
     * allocation persistée. Utilisé par la popin de politique (PR6) pour
     * calculer un aperçu "6 prochains mois" côté client à partir des valeurs
     * du formulaire <b>en cours d'édition</b> (donc potentiellement non encore
     * enregistrées), sans que la formule d'une politique déjà sauvegardée ne
     * vienne fausser l'aperçu.
     */
    @GetMapping("/rav-brut")
    public List<RavBrutMoisDto> ravBrutAnnee(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @RequestParam UUID membreId,
            @RequestParam int annee) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);

        ParametresScenario paramsBrut = chargerParametresBruts(foyerId, scenarioId);

        List<RavBrutMoisDto> resultats = new java.util.ArrayList<>(12);
        for (int m = 1; m <= 12; m++) {
            double rav = MoteurCalcul.aggregatMembreMois(paramsBrut, membreId, annee, m).soldeDisponible();
            resultats.add(new RavBrutMoisDto(m, BigDecimal.valueOf(rav).setScale(2, RoundingMode.HALF_UP)));
        }
        return resultats;
    }

    /**
     * Résolution d'argent de poche agrégée à l'échelle du foyer, sur les 12
     * mois d'une année — somme des résolutions de tous les membres actifs du
     * scénario. Un seul chargement de {@link ParametresScenario} pour l'année
     * entière et tous les membres (pas de N+1), utilisé par le widget dashboard
     * en mode <b>foyer</b> (PR6) — l'argent de poche individuel n'a de sens
     * qu'agrégé en somme brute à ce niveau, aucune action d'édition unitaire
     * n'est possible depuis cette vue.
     */
    @GetMapping("/resolution-foyer-annee")
    public List<ResolutionArgentPocheFoyerMoisDto> resolutionFoyerAnnee(
            @PathVariable UUID foyerId,
            @PathVariable UUID scenarioId,
            @RequestParam int annee) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);

        ParametresScenario paramsBrut = chargerParametresBruts(foyerId, scenarioId);

        List<ResolutionArgentPocheFoyerMoisDto> resultats = new java.util.ArrayList<>(12);
        for (int m = 1; m <= 12; m++) {
            YearMonth ym = YearMonth.of(annee, m);
            List<ResolutionArgentPocheMembreMoisDto> parMembre = new java.util.ArrayList<>(paramsBrut.membres().size());
            BigDecimal total = BigDecimal.ZERO;
            for (UUID membreId : paramsBrut.membres()) {
                double ravBrut = MoteurCalcul.aggregatMembreMois(paramsBrut, membreId, annee, m).soldeDisponible();
                ResolutionArgentPoche r = service.resoudre(scenarioId, membreId, ym, ravBrut);
                BigDecimal montant = BigDecimal.valueOf(r.montant()).setScale(2, RoundingMode.HALF_UP);
                parMembre.add(new ResolutionArgentPocheMembreMoisDto(membreId, montant, r.source()));
                total = total.add(montant);
            }
            resultats.add(new ResolutionArgentPocheFoyerMoisDto(m, total, parMembre));
        }
        return resultats;
    }

    /**
     * Reconstitue les {@link ParametresScenario} du scénario avec le provider
     * {@link ArgentDePocheProvider#AUCUN} — nécessaire pour obtenir un RàV
     * <b>brut</b> (avant retrait de l'argent de poche) via le moteur, la source
     * de vérité restant unique pour tous les endpoints de cette classe.
     */
    private ParametresScenario chargerParametresBruts(UUID foyerId, UUID scenarioId) {
        ParametresScenario params = projectionService.chargerParametres(foyerId, scenarioId);
        return new ParametresScenario(
                params.deviseBase(), params.anneeDepart(), params.tresorerieInitiale(),
                params.horizonAnnees(), params.periodesDefaut(), params.taux(),
                params.postes(), params.membres(), ArgentDePocheProvider.AUCUN);
    }

    private ResolutionArgentPocheDto toDto(ResolutionArgentPoche r) {
        return new ResolutionArgentPocheDto(
                BigDecimal.valueOf(r.montant()).setScale(2, RoundingMode.HALF_UP),
                r.source(),
                r.politiqueId(),
                r.allocationId(),
                BigDecimal.valueOf(r.rav()).setScale(2, RoundingMode.HALF_UP));
    }
}
