package ch.homely.projection;

import ch.homely.compte.Compte;
import ch.homely.compte.CompteMembre;
import ch.homely.membre.Membre;
import ch.homely.moteur.ParametresScenario;
import ch.homely.moteur.RepartitionCalcul;
import ch.homely.moteur.RepartitionPeriodeCalcul;
import ch.homely.poche.ArgentPocheService;
import ch.homely.poche.LigneRoutagePoche;
import ch.homely.poche.ResolutionArgentPoche;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Virements inter-comptes issus du <b>routage de l'argent de poche</b> (V29) : compte
 * pivot = source qui finance, contreparties = comptes de poche crédités, au sens REVENU.
 *
 * <p>Pendant de {@link ComptesFluxSimulateurRoutageTest} (routage des postes) pour le
 * module argent de poche, dont la source du virement était auparavant déduite du
 * réglage global {@code compte_membre.est_primaire}.</p>
 */
class ComptesFluxSimulateurPocheRoutageTest {

    static final UUID MEMBRE_1 = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private Compte comptePivot, comptePoche, compteLoisirs;
    private ArgentPocheService argentPoche;

    @BeforeEach
    void setUp() {
        comptePivot = compte("Salaire", MEMBRE_1);
        comptePoche = compte("Poche", MEMBRE_1);
        compteLoisirs = compte("Loisirs", MEMBRE_1);
        argentPoche = mock(ArgentPocheService.class);
    }

    @Test
    @DisplayName("Versement éclaté : 200 depuis le pivot → 150 sur le compte poche, 50 sur loisirs")
    void versementEclateSurDeuxComptes() {
        resolution(200, comptePivot.getId(), List.of(
                new LigneRoutagePoche(comptePoche.getId(), 0.75),
                new LigneRoutagePoche(compteLoisirs.getId(), 0.25)));

        List<ComptesFluxSimulateur.VirementPaire> paires =
                pairesDuMois(List.of(comptePivot, comptePoche, compteLoisirs), Map.of());

        assertThat(paires).hasSize(2);
        assertThat(paires).allSatisfy(p ->
                assertThat(p.compteSourceId()).isEqualTo(comptePivot.getId()));
        assertThat(montantVers(paires, comptePoche)).isCloseTo(150.0, within(0.01));
        assertThat(montantVers(paires, compteLoisirs)).isCloseTo(50.0, within(0.01));
    }

    @Test
    @DisplayName("Auto-routage : contrepartie confondue avec le pivot ⇒ aucun virement")
    void autoRoutageNeGenerePasDeVirement() {
        resolution(200, comptePivot.getId(),
                List.of(new LigneRoutagePoche(comptePivot.getId(), 1.0)));

        List<ComptesFluxSimulateur.VirementPaire> paires =
                pairesDuMois(List.of(comptePivot, comptePoche), Map.of());

        assertThat(paires).isEmpty();
    }

    @Test
    @DisplayName("Le pivot du versement prime sur le compte primaire du membre")
    void pivotPrimeSurComptePrimaire() {
        // Le membre a « Loisirs » comme compte primaire, mais le versement est
        // explicitement financé depuis « Salaire » : c'est le pivot qui fait foi.
        resolution(120, comptePivot.getId(),
                List.of(new LigneRoutagePoche(comptePoche.getId(), 1.0)));

        Map<UUID, UUID> primaires = new HashMap<>();
        primaires.put(MEMBRE_1, compteLoisirs.getId());

        List<ComptesFluxSimulateur.VirementPaire> paires =
                pairesDuMois(List.of(comptePivot, comptePoche, compteLoisirs), primaires);

        assertThat(paires).hasSize(1);
        assertThat(paires.getFirst().compteSourceId()).isEqualTo(comptePivot.getId());
        assertThat(paires.getFirst().compteDestinationId()).isEqualTo(comptePoche.getId());
        assertThat(paires.getFirst().montant()).isCloseTo(120.0, within(0.01));
    }

    @Test
    @DisplayName("Aucun argent de poche résolu ⇒ aucun virement")
    void aucunArgentDePocheAucunVirement() {
        when(argentPoche.resoudre(any(), any(), any(), anyDouble()))
                .thenAnswer(inv -> ResolutionArgentPoche.aucune(inv.getArgument(3)));

        assertThat(pairesDuMois(List.of(comptePivot, comptePoche), Map.of())).isEmpty();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void resolution(double montant, UUID pivotId, List<LigneRoutagePoche> routage) {
        when(argentPoche.resoudre(any(), any(), any(), anyDouble()))
                .thenAnswer(inv -> ResolutionArgentPoche.parPolitique(
                        montant, UUID.randomUUID(), pivotId, routage, inv.getArgument(3)));
    }

    private List<ComptesFluxSimulateur.VirementPaire> pairesDuMois(
            List<Compte> comptes, Map<UUID, UUID> primaires) {
        return ComptesFluxSimulateur.simulerPaires(
                        scenario(), comptes, primaires, 2026, 1, argentPoche, UUID.randomUUID())
                .get(YearMonth.of(2026, 1)).paires();
    }

    private double montantVers(List<ComptesFluxSimulateur.VirementPaire> paires, Compte destination) {
        return paires.stream()
                .filter(p -> p.compteDestinationId().equals(destination.getId()))
                .mapToDouble(ComptesFluxSimulateur.VirementPaire::montant)
                .sum();
    }

    private static ParametresScenario scenario() {
        List<RepartitionPeriodeCalcul> periodes = List.of(new RepartitionPeriodeCalcul(
                LocalDate.of(2020, 1, 1), null, List.of(new RepartitionCalcul(MEMBRE_1, 1.0))));
        return new ParametresScenario("CHF", 2026, 0.0, 1, periodes, Map.of(),
                List.of(), List.of(MEMBRE_1));
    }

    private static Compte compte(String libelle, UUID membreId) {
        Compte c = new Compte();
        c.setId(UUID.randomUUID());
        c.setLibelle(libelle);
        // Solde initial confortable : évite tout comblement « topUp » parasite.
        c.setSoldeInitial(BigDecimal.valueOf(100_000));
        Membre m = new Membre();
        m.setId(membreId);
        c.getCompteMembres().add(new CompteMembre(c, m));
        return c;
    }
}
