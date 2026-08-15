package ch.homely.moteur;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

/**
 * Tests golden de la trésorerie <b>cumulée</b> par année et par sujet
 * ({@link MoteurCalcul#tresorerieCumuleeAnnee}). Vérifie l'amorçage à la trésorerie
 * initiale, le cumul mensuel et l'invariant « mensualisé = réel » en fin d'année.
 */
class MoteurTresorerieCumuleeTest {

    static final UUID DYLAN   = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID MELANIE = UUID.fromString("00000000-0000-0000-0000-000000000002");
    static final double TOLERANCE = 1e-6;

    private final ParametresScenario params = GoldenFixture.buildScenario2026(DYLAN, MELANIE);

    @Test
    @DisplayName("Foyer : cumul de décembre = trésorerie initiale + solde annuel (69 508 CHF)")
    void cumulFoyerDecembre() {
        double[] mensualise = MoteurCalcul.tresorerieCumuleeAnnee(params, 2026, null, false);
        double[] reel       = MoteurCalcul.tresorerieCumuleeAnnee(params, 2026, null, true);

        assertThat(mensualise).hasSize(12);
        assertThat(reel).hasSize(12);
        // trésorerie initiale = 0 dans le fixture golden
        assertThat(mensualise[11]).as("cumul déc. mensualisé").isCloseTo(69_508.0, within(0.01));
        assertThat(reel[11]).as("cumul déc. réel").isCloseTo(69_508.0, within(0.01));
    }

    @Test
    @DisplayName("Invariant : cumul annuel identique en mensualisé et réel (fin d'année)")
    void invariantMensualiseEgalReelFinAnnee() {
        double[] mensualise = MoteurCalcul.tresorerieCumuleeAnnee(params, 2026, null, false);
        double[] reel       = MoteurCalcul.tresorerieCumuleeAnnee(params, 2026, null, true);
        assertThat(mensualise[11]).isCloseTo(reel[11], within(0.01));
    }

    @Test
    @DisplayName("Le cumul mensualisé est monotone croissant sur l'année (soldes positifs)")
    void cumulMensualiseCroissant() {
        double[] mensualise = MoteurCalcul.tresorerieCumuleeAnnee(params, 2026, null, false);
        for (int i = 1; i < 12; i++) {
            assertThat(mensualise[i]).isGreaterThanOrEqualTo(mensualise[i - 1]);
        }
    }

    @Test
    @DisplayName("Somme des sujets membres = foyer (fin d'année, mensualisé)")
    void sommeMembresEgaleFoyer() {
        double[] foyer   = MoteurCalcul.tresorerieCumuleeAnnee(params, 2026, null, false);
        double[] dylan   = MoteurCalcul.tresorerieCumuleeAnnee(params, 2026, DYLAN, false);
        double[] melanie = MoteurCalcul.tresorerieCumuleeAnnee(params, 2026, MELANIE, false);
        assertThat(dylan[11] + melanie[11]).as("Dylan + Mélanie = foyer")
                .isCloseTo(foyer[11], within(0.01));
    }

    @Test
    @DisplayName("Quote-part de la période ouverte : 0.58 / 0.42, 0 si membre inconnu")
    void quotePartPeriodeOuverte() {
        assertThat(MoteurCalcul.quotePartPeriodeOuverte(params, DYLAN)).isCloseTo(0.58, within(TOLERANCE));
        assertThat(MoteurCalcul.quotePartPeriodeOuverte(params, MELANIE)).isCloseTo(0.42, within(TOLERANCE));
        assertThat(MoteurCalcul.quotePartPeriodeOuverte(params, UUID.randomUUID()))
                .isCloseTo(0.0, within(TOLERANCE));
    }
}
