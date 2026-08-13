package ch.homely.poche;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires purs (sans Spring, sans BDD) de la formule d'argent de poche
 * — module central du service métier PR2.
 */
class ArgentPocheServiceFormuleTest {

    private static PolitiqueArgentPoche variable(double socle, double pct, double plafond) {
        PolitiqueArgentPoche p = new PolitiqueArgentPoche();
        p.setMode(ModePolitiqueArgentPoche.VARIABLE);
        p.setSocle(BigDecimal.valueOf(socle));
        p.setPourcentage(BigDecimal.valueOf(pct));
        p.setPlafond(BigDecimal.valueOf(plafond));
        return p;
    }

    private static PolitiqueArgentPoche fixe(double montant) {
        PolitiqueArgentPoche p = new PolitiqueArgentPoche();
        p.setMode(ModePolitiqueArgentPoche.FIXE);
        p.setMontantFixe(BigDecimal.valueOf(montant));
        return p;
    }

    @Test
    void mode_variable_pourcentage_du_rav_sous_le_socle_verse_le_socle_plancher() {
        // socle=500, pct=20%, plafond=1000. RàV=300 → brut=60 (< socle) → plancher socle=500.
        double montant = ArgentPocheService.calculerFormule(variable(500, 20, 1000), 300);
        assertThat(montant).isEqualTo(500.0);
    }

    @Test
    void mode_variable_rav_negatif_verse_uniquement_le_socle_plancher() {
        // Le socle est toujours versé intégralement (spec §1) — même si RàV<0
        // (le versement va créer/aggraver un découvert, comportement voulu).
        double montant = ArgentPocheService.calculerFormule(variable(500, 20, 1000), -200);
        assertThat(montant).isEqualTo(500.0);
    }

    @Test
    void mode_variable_pourcentage_du_rav_au_dessus_du_socle_verse_ce_montant() {
        // socle=500, pct=20%, plafond=2000. RàV=5000 → brut=1000 (entre socle et plafond) → 1000.
        double montant = ArgentPocheService.calculerFormule(variable(500, 20, 2000), 5000);
        assertThat(montant).isEqualTo(1000.0);
    }

    @Test
    void mode_variable_pourcentage_du_rav_depasse_le_plafond_est_cape() {
        // socle=500, pct=20%, plafond=1000. RàV=10000 → brut=2000 → capé à plafond=1000.
        double montant = ArgentPocheService.calculerFormule(variable(500, 20, 1000), 10000);
        assertThat(montant).isEqualTo(1000.0);
    }

    @Test
    void mode_variable_pct_zero_ne_verse_que_le_socle_plancher() {
        double montant = ArgentPocheService.calculerFormule(variable(500, 0, 1000), 5000);
        assertThat(montant).isEqualTo(500.0);
    }

    @Test
    void mode_variable_socle_egal_plafond_verse_toujours_ce_montant() {
        double montant = ArgentPocheService.calculerFormule(variable(500, 100, 500), 10000);
        assertThat(montant).isEqualTo(500.0);
    }

    @Test
    void mode_fixe_verse_le_montant_fixe_independamment_du_rav() {
        assertThat(ArgentPocheService.calculerFormule(fixe(250), 0)).isEqualTo(250.0);
        assertThat(ArgentPocheService.calculerFormule(fixe(250), 10000)).isEqualTo(250.0);
        assertThat(ArgentPocheService.calculerFormule(fixe(250), -100)).isEqualTo(250.0);
    }
}
