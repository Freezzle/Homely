package ch.homely.scenario;

import ch.homely.commun.CodesErreur;
import ch.homely.commun.RegleMetierException;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.foyer.RoleFoyer;
import ch.homely.membre.Membre;
import ch.homely.membre.MembreRepository;
import ch.homely.moteur.MoteurCalcul;
import ch.homely.moteur.RepartitionCalcul;
import ch.homely.projection.ProjectionService;
import ch.homely.scenario.dto.RepartitionPeriodeDto;
import ch.homely.scenario.dto.RepartitionPeriodeRequest;
import ch.homely.securite.MultiTenantService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * CRUD des périodes de répartition par défaut d'un scénario.
 *
 * <p>Règles métier :</p>
 * <ul>
 *   <li>Au plus une période ouverte (fin = null) par scénario.</li>
 *   <li>Pas de chevauchement entre périodes.</li>
 *   <li>Σ quotePart = 1 (±1e-6) pour chaque période.</li>
 * </ul>
 */
@Service
@Transactional
public class RepartitionPeriodeService {

    private static final Logger log = LoggerFactory.getLogger(RepartitionPeriodeService.class);

    private final RepartitionPeriodeRepository periodeRepo;
    private final ScenarioRepository scenarioRepo;
    private final MembreRepository membreRepo;
    private final MultiTenantService multiTenant;
    private final ProjectionService projectionService;

    public RepartitionPeriodeService(RepartitionPeriodeRepository periodeRepo,
                                     ScenarioRepository scenarioRepo,
                                     MembreRepository membreRepo,
                                     MultiTenantService multiTenant,
                                     ProjectionService projectionService) {
        this.periodeRepo       = periodeRepo;
        this.scenarioRepo      = scenarioRepo;
        this.membreRepo        = membreRepo;
        this.multiTenant       = multiTenant;
        this.projectionService = projectionService;
    }

    @Transactional(readOnly = true)
    public List<RepartitionPeriodeDto> lister(UUID foyerId, UUID scenarioId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        verifierScenario(foyerId, scenarioId);
        return periodeRepo.findWithPartsForScenario(scenarioId, foyerId).stream()
                .map(this::toDto).toList();
    }

    public RepartitionPeriodeDto creer(UUID foyerId, UUID scenarioId, RepartitionPeriodeRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Scenario scenario = verifierScenario(foyerId, scenarioId);

        validerParts(req.parts());
        validerPasDeRecouvrement(scenarioId, null, req.debut(), req.fin());
        if (req.fin() == null && periodeRepo.findOpenPeriode(scenarioId).isPresent()) {
            throw new RegleMetierException(CodesErreur.PERIODE_INVALIDE,
                    "Il ne peut y avoir qu'une seule période ouverte par scénario.");
        }

        RepartitionPeriode periode = new RepartitionPeriode();
        periode.setScenario(scenario);
        appliquer(periode, req, foyerId);
        RepartitionPeriodeDto dto = toDto(periodeRepo.save(periode));
        projectionService.invaliderCache(scenarioId);
        return dto;
    }

    public RepartitionPeriodeDto modifier(UUID foyerId, UUID scenarioId, UUID periodeId,
                                          RepartitionPeriodeRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        verifierScenario(foyerId, scenarioId);

        RepartitionPeriode periode = periodeRepo.findByIdAndScenarioIdAndFoyerId(periodeId, scenarioId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Période introuvable : " + periodeId));

        validerParts(req.parts());
        validerPasDeRecouvrement(scenarioId, periodeId, req.debut(), req.fin());
        if (req.fin() == null && periodeRepo.existsAutrePeriodeOuverte(scenarioId, periodeId)) {
            throw new RegleMetierException(CodesErreur.PERIODE_INVALIDE,
                    "Il ne peut y avoir qu'une seule période ouverte par scénario.");
        }

        periode.getParts().clear();
        periodeRepo.saveAndFlush(periode);
        appliquer(periode, req, foyerId);
        RepartitionPeriodeDto dto = toDto(periodeRepo.save(periode));
        projectionService.invaliderCache(scenarioId);
        return dto;
    }

    public void supprimer(UUID foyerId, UUID scenarioId, UUID periodeId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        verifierScenario(foyerId, scenarioId);

        RepartitionPeriode periode = periodeRepo.findByIdAndScenarioIdAndFoyerId(periodeId, scenarioId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Période introuvable : " + periodeId));

        periodeRepo.delete(periode);
        projectionService.invaliderCache(scenarioId);
        log.info("Période {} supprimée du scénario {}", periodeId, scenarioId);
    }

    // ── Hooks cycle de vie membre ─────────────────────────────────────────────

    /**
     * Appelé après l'ajout d'un membre au foyer.
     * Ajoute ce membre avec quotePart = 0 dans toutes les périodes de tous les scénarios du foyer.
     * La somme reste 1 (les autres membres inchangés, le nouveau à 0).
     */
    @Transactional
    public void onMembreAjoute(UUID foyerId, Membre membre) {
        List<Scenario> scenarios = scenarioRepo.findAllByFoyerIdOrderByDateCreation(foyerId);
        for (Scenario sc : scenarios) {
            List<RepartitionPeriode> periodes = periodeRepo.findByScenarioId(sc.getId());
            for (RepartitionPeriode p : periodes) {
                boolean dejaPresent = p.getParts().stream()
                        .anyMatch(pp -> membre.getId().equals(pp.getMembre().getId()));
                if (!dejaPresent) {
                    RepartitionPeriodePart part = new RepartitionPeriodePart();
                    part.setPeriode(p);
                    part.setMembre(membre);
                    part.setQuotePart(BigDecimal.ZERO);
                    part.setOrdre(p.getParts().size());
                    p.getParts().add(part);
                    periodeRepo.save(p);
                }
            }
            projectionService.invaliderCache(sc.getId());
        }
    }

    /**
     * Appelé lors de la désactivation d'un membre.
     * <ul>
     *   <li>Ferme la période ouverte (fin = hier) sur tous les scénarios du foyer.</li>
     *   <li>Crée une nouvelle période ouverte (début = aujourd'hui) avec les membres restants
     *       répartis équitablement.</li>
     *   <li>Les périodes fermées sont conservées telles quelles (données historiques).</li>
     * </ul>
     */
    @Transactional
    public void onMembreDesactive(UUID foyerId, Membre membre, LocalDate dateDesactivation) {
        List<Scenario> scenarios = scenarioRepo.findAllByFoyerIdOrderByDateCreation(foyerId);
        for (Scenario sc : scenarios) {
            periodeRepo.findOpenPeriode(sc.getId()).ifPresent(openPeriode -> {
                // Fermer la période ouverte (fin = dateDesactivation - 1 jour)
                LocalDate veille = dateDesactivation.minusDays(1);
                if (openPeriode.getDebut() != null && !veille.isBefore(openPeriode.getDebut())) {
                    openPeriode.setFin(veille);
                    periodeRepo.save(openPeriode);
                } else {
                    // La période ouverte commence au même jour ou après → on la supprime
                    periodeRepo.delete(openPeriode);
                    return;
                }

                // Membres restants actifs dans la période qu'on vient de fermer (hors membre désactivé)
                List<RepartitionPeriodePart> partsRestantes = openPeriode.getParts().stream()
                        .filter(p -> !membre.getId().equals(p.getMembre().getId()))
                        .toList();

                if (partsRestantes.isEmpty()) return; // Plus aucun membre → pas de nouvelle période

                // Répartition équitable entre les membres restants
                int n = partsRestantes.size();
                double partEgale = 1.0 / n;

                RepartitionPeriode nouvellePeriode = new RepartitionPeriode();
                nouvellePeriode.setScenario(sc);
                nouvellePeriode.setDebut(dateDesactivation);
                nouvellePeriode.setFin(null);

                for (int i = 0; i < partsRestantes.size(); i++) {
                    RepartitionPeriodePart src = partsRestantes.get(i);
                    RepartitionPeriodePart novPart = new RepartitionPeriodePart();
                    novPart.setPeriode(nouvellePeriode);
                    novPart.setMembre(src.getMembre());
                    // Dernier membre reçoit le reste pour éviter les arrondis
                    double quote = (i == partsRestantes.size() - 1)
                            ? (1.0 - partEgale * (n - 1))
                            : partEgale;
                    novPart.setQuotePart(BigDecimal.valueOf(quote));
                    novPart.setOrdre(i);
                    nouvellePeriode.getParts().add(novPart);
                }
                periodeRepo.save(nouvellePeriode);
            });
            projectionService.invaliderCache(sc.getId());
        }
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void appliquer(RepartitionPeriode p, RepartitionPeriodeRequest req, UUID foyerId) {
        p.setDebut(req.debut());
        p.setFin(req.fin());
        for (int i = 0; i < req.parts().size(); i++) {
            RepartitionPeriodeRequest.PartRequest pr = req.parts().get(i);
            Membre m = membreRepo.findByIdAndFoyerId(pr.membreId(), foyerId)
                    .orElseThrow(() -> new RessourceIntrouvableException(
                            "Membre introuvable : " + pr.membreId()));
            RepartitionPeriodePart part = new RepartitionPeriodePart();
            part.setPeriode(p);
            part.setMembre(m);
            part.setQuotePart(pr.quotePart());
            part.setOrdre(i);
            p.getParts().add(part);
        }
    }

    private void validerParts(List<RepartitionPeriodeRequest.PartRequest> parts) {
        if (parts == null || parts.isEmpty()) {
            throw new RegleMetierException(CodesErreur.REPARTITION_INVALIDE,
                    "Une période doit contenir au moins une part.");
        }
        List<RepartitionCalcul> rcs = parts.stream()
                .map(r -> new RepartitionCalcul(r.membreId(), r.quotePart().doubleValue()))
                .toList();
        MoteurCalcul.validerRepartition(rcs);
    }

    private void validerPasDeRecouvrement(UUID scenarioId, UUID excludeId,
                                          LocalDate debut, LocalDate fin) {
        periodeRepo.findByScenarioId(scenarioId).stream()
                .filter(p -> excludeId == null || !p.getId().equals(excludeId))
                .forEach(p -> {
                    if (seChevauchent(debut, fin, p.getDebut(), p.getFin())) {
                        throw new RegleMetierException(CodesErreur.PERIODE_INVALIDE,
                                "La période chevauche une période existante [%s, %s]."
                                        .formatted(p.getDebut(), p.getFin() == null ? "∞" : p.getFin()));
                    }
                });
    }

    private static boolean seChevauchent(LocalDate d1, LocalDate f1, LocalDate d2, LocalDate f2) {
        // [d1, f1] ∩ [d2, f2] ≠ ∅
        // ⟺ NOT (d1 > f2 OR d2 > f1)  (avec null = ±∞)
        boolean d1ApresF2 = d1 != null && f2 != null && d1.isAfter(f2);
        boolean d2ApresF1 = d2 != null && f1 != null && d2.isAfter(f1);
        return !d1ApresF2 && !d2ApresF1;
    }

    private Scenario verifierScenario(UUID foyerId, UUID scenarioId) {
        return scenarioRepo.findByIdAndFoyerId(scenarioId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Scénario introuvable : " + scenarioId));
    }

    RepartitionPeriodeDto toDto(RepartitionPeriode p) {
        List<RepartitionPeriodeDto.PartDto> parts = p.getParts().stream()
                .map(pp -> new RepartitionPeriodeDto.PartDto(
                        pp.getMembre().getId(),
                        pp.getMembre().getNom(),
                        pp.getMembre().getCouleur(),
                        pp.getQuotePart(),
                        pp.getOrdre()))
                .toList();
        return new RepartitionPeriodeDto(p.getId(), p.getDebut(), p.getFin(), parts);
    }
}

