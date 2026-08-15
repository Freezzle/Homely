package ch.homely.moteur;

import org.junit.jupiter.api.Test;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests d'intégration du moteur avec le nouveau {@link ArgentDePocheProvider}.
 *
 * <p>Objectifs :
 * <ol>
 *   <li><b>Non-régression</b> — avec {@link ArgentDePocheProvider#AUCUN} (ou aucun
 *       provider spécifié via le constructeur legacy 8-args), le résultat est
 *       strictement identique à celui d'avant PR2 (les vecteurs golden restent
 *       reproduits au centime — cf. {@link MoteurCalculTest}).</li>
 *   <li><b>Impact correct</b> — le provider est appelé avec le RàV <em>avant</em>
 *       retrait ({@code revenus − charges − réserves}) ; son montant est retiré
 *       uniquement du {@code soldeDisponible}, sans être compté dans les
 *       {@code reserves} (cohérence
 *       {@code revenus = charges + reserves + soldeDisponible + argentDePoche}).</li>
 *   <li><b>Isolation membre</b> — le provider est appelé indépendamment pour chaque
 *       membre ; l'agrégat foyer voit son solde disponible diminué de la somme des
 *       poches de tous les membres (revenus/charges/réserves FOYER restent, eux, la
 *       vue "postes réels" du foyer, inchangée).</li>
 * </ol>
 */
class MoteurCalculArgentPocheTest {

    private static final UUID DYLAN   = MoteurCalculTest.DYLAN;
    private static final UUID MELANIE = MoteurCalculTest.MELANIE;

    @Test
    void avec_provider_aucun_l_agregat_membre_est_inchange() {
        ParametresScenario avec = GoldenFixture.buildScenario2026(DYLAN, MELANIE);
        // Reconstruit avec le constructeur 9-args et provider AUCUN explicite —
        // doit être identique au constructeur 8-args (compat).
        ParametresScenario explicite = new ParametresScenario(
                avec.deviseBase(), avec.anneeDepart(), avec.tresorerieInitiale(),
                avec.horizonAnnees(), avec.periodesDefaut(), avec.taux(),
                avec.postes(), avec.membres(), ArgentDePocheProvider.AUCUN);

        for (int m = 1; m <= 12; m++) {
            AggregatMensuel a = MoteurCalcul.aggregatMembreMois(avec, DYLAN, 2026, m);
            AggregatMensuel b = MoteurCalcul.aggregatMembreMois(explicite, DYLAN, 2026, m);
            assertThat(b.revenus()).isCloseTo(a.revenus(), org.assertj.core.api.Assertions.within(1e-9));
            assertThat(b.charges()).isCloseTo(a.charges(), org.assertj.core.api.Assertions.within(1e-9));
            assertThat(b.reserves()).isCloseTo(a.reserves(), org.assertj.core.api.Assertions.within(1e-9));
            assertThat(b.soldeDisponible()).isCloseTo(a.soldeDisponible(), org.assertj.core.api.Assertions.within(1e-9));
        }
    }

    @Test
    void provider_est_appele_avec_le_rav_brut_et_impacte_solde_sans_toucher_aux_reserves() {
        ParametresScenario base = GoldenFixture.buildScenario2026(DYLAN, MELANIE);
        AggregatMensuel avant = MoteurCalcul.aggregatMembreMois(base, DYLAN, 2026, 3);
        double ravBrutAttendu = avant.revenus() - avant.charges() - avant.reserves();

        // Provider qui retire 500 CHF pour Dylan uniquement en mars 2026, et
        // capture le ravBrut qui lui est passé pour vérifier le contrat.
        final double[] ravVu = {Double.NaN};
        ArgentDePocheProvider p = (membreId, annee, mois, ravBrut) -> {
            if (membreId.equals(DYLAN) && annee == 2026 && mois == 3) {
                ravVu[0] = ravBrut;
                return 500.0;
            }
            return 0.0;
        };

        ParametresScenario avec = new ParametresScenario(
                base.deviseBase(), base.anneeDepart(), base.tresorerieInitiale(),
                base.horizonAnnees(), base.periodesDefaut(), base.taux(),
                base.postes(), base.membres(), p);

        AggregatMensuel apres = MoteurCalcul.aggregatMembreMois(avec, DYLAN, 2026, 3);

        // Le provider a bien reçu le RàV brut (avant retrait).
        assertThat(ravVu[0]).isCloseTo(ravBrutAttendu, org.assertj.core.api.Assertions.within(1e-6));

        // Le montant est retiré du soldeDisponible, les réserves restent inchangées.
        assertThat(apres.revenus()).isCloseTo(avant.revenus(), org.assertj.core.api.Assertions.within(1e-6));
        assertThat(apres.charges()).isCloseTo(avant.charges(), org.assertj.core.api.Assertions.within(1e-6));
        assertThat(apres.reserves()).isCloseTo(avant.reserves(), org.assertj.core.api.Assertions.within(1e-6));
        assertThat(apres.soldeDisponible()).isCloseTo(avant.soldeDisponible() - 500.0, org.assertj.core.api.Assertions.within(1e-6));

        // Identité comptable préservée : revenus = charges + reserves + soldeDisponible + argentDePoche.
        assertThat(apres.charges() + apres.reserves() + apres.soldeDisponible() + 500.0)
                .isCloseTo(apres.revenus(), org.assertj.core.api.Assertions.within(1e-6));
    }

    @Test
    void provider_impacte_l_agregat_foyer_de_la_somme_des_poches_membres() {
        ParametresScenario base = GoldenFixture.buildScenario2026(DYLAN, MELANIE);
        AggregatMensuel foyerAvant = MoteurCalcul.aggregatFoyerMois(base, 2026, 5);

        // Provider "agressif" — retire 999 CHF pour tout le monde tous les mois.
        ArgentDePocheProvider p = (m, y, mo, rav) -> 999.0;
        ParametresScenario avec = new ParametresScenario(
                base.deviseBase(), base.anneeDepart(), base.tresorerieInitiale(),
                base.horizonAnnees(), base.periodesDefaut(), base.taux(),
                base.postes(), base.membres(), p);

        AggregatMensuel foyerApres = MoteurCalcul.aggregatFoyerMois(avec, 2026, 5);

        // L'argent de poche quitte le budget disponible du foyer pour la consommation
        // personnelle des membres (doc 01 §4/§7) : revenus/charges/réserves FOYER restent
        // inchangés, mais le solde disponible FOYER doit être diminué de la somme des
        // poches de tous les membres actifs (2 × 999 ici) — ce test verrouille ce contrat.
        assertThat(foyerApres.revenus()).isEqualTo(foyerAvant.revenus());
        assertThat(foyerApres.charges()).isEqualTo(foyerAvant.charges());
        assertThat(foyerApres.reserves()).isEqualTo(foyerAvant.reserves());
        assertThat(foyerApres.soldeDisponible())
                .isCloseTo(foyerAvant.soldeDisponible() - 2 * 999.0, org.assertj.core.api.Assertions.within(1e-6));
    }

    @Test
    void montant_negatif_du_provider_est_ramene_a_zero() {
        ParametresScenario base = GoldenFixture.buildScenario2026(DYLAN, MELANIE);
        AggregatMensuel avant = MoteurCalcul.aggregatMembreMois(base, DYLAN, 2026, 1);

        ArgentDePocheProvider bugue = (m, y, mo, rav) -> -100.0;
        ParametresScenario avec = new ParametresScenario(
                base.deviseBase(), base.anneeDepart(), base.tresorerieInitiale(),
                base.horizonAnnees(), base.periodesDefaut(), base.taux(),
                base.postes(), base.membres(), bugue);

        AggregatMensuel apres = MoteurCalcul.aggregatMembreMois(avec, DYLAN, 2026, 1);
        assertThat(apres.soldeDisponible()).isCloseTo(avant.soldeDisponible(), org.assertj.core.api.Assertions.within(1e-9));
    }

    @Test
    void provider_est_appele_une_fois_par_membre_et_par_mois() {
        ParametresScenario base = GoldenFixture.buildScenario2026(DYLAN, MELANIE);
        AtomicInteger appels = new AtomicInteger(0);
        ArgentDePocheProvider p = (m, y, mo, rav) -> {
            appels.incrementAndGet();
            return 0.0;
        };
        ParametresScenario avec = new ParametresScenario(
                base.deviseBase(), base.anneeDepart(), base.tresorerieInitiale(),
                base.horizonAnnees(), base.periodesDefaut(), base.taux(),
                base.postes(), base.membres(), p);

        MoteurCalcul.aggregatMembreMois(avec, DYLAN, 2026, 6);
        assertThat(appels.get()).isEqualTo(1);
    }
}
