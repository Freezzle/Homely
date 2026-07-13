package ch.homely.moteur;

import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.MomentPeriode;
import ch.homely.poste.TypePoste;
import ch.homely.poste.TypeRepartition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

/**
 * Tests unitaires du nouveau modèle de répartition par période.
 * Couvre : periode active, AUTO, REVERSE_AUTO, CUSTOM, mono-membre, transition en cours d'année.
 *
 * <p>Note : les @Nested classes groupent les cas ; un test de "smoke" direct est placé
 * en tête pour garantir la détection par Surefire (comportement hérité du projet).</p>
 */
class MoteurRepartitionPeriodeTest {

    private static final UUID DYLAN   = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID MELANIE = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ALEXIS  = UUID.fromString("00000000-0000-0000-0000-000000000003");

    // ── Smoke test direct pour Surefire ──────────────────────────────────────

    @Test
    @DisplayName("Smoke: golden 2026 non-régressé — AUTO période unique 58/42")
    void smokeGolden2026() {
        ParametresScenario params = GoldenFixture.buildScenario2026(DYLAN, MELANIE);
        ProjectionAnnuelle proj = MoteurCalcul.projectionAnnuelle(params, 2026);
        assertThat(proj.totalAnnuel().revenus())        .isCloseTo(140350.0, within(0.01));
        assertThat(proj.totalAnnuel().charges())        .isCloseTo(62322.0,  within(0.01));
        assertThat(proj.totalAnnuel().reserves())       .isCloseTo(8520.0,   within(0.01));
        assertThat(proj.totalAnnuel().soldeDisponible()).isCloseTo(69508.0,   within(0.01));
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private static PosteCalcul poste(TypeRepartition type) {
        return new PosteCalcul(UUID.randomUUID(), TypePoste.CHARGE, 1000.0, "CHF", 1,
                null, null, ModeComptabilisation.MENSUALISE, MomentPeriode.DEBUT_PERIODE,
                null, type, List.of(), List.of(), null);
    }

    private static PosteCalcul posteCustom(double partDylan, double partMelanie) {
        List<RepartitionCalcul> reps = List.of(
                new RepartitionCalcul(DYLAN, partDylan),
                new RepartitionCalcul(MELANIE, partMelanie)
        );
        return new PosteCalcul(UUID.randomUUID(), TypePoste.CHARGE, 1000.0, "CHF", 1,
                null, null, ModeComptabilisation.MENSUALISE, MomentPeriode.DEBUT_PERIODE,
                null, TypeRepartition.CUSTOM, reps, List.of(), null);
    }

    private static RepartitionPeriodeCalcul periode(LocalDate debut, LocalDate fin, double d, double m) {
        return new RepartitionPeriodeCalcul(debut, fin, List.of(
                new RepartitionCalcul(DYLAN, d),
                new RepartitionCalcul(MELANIE, m)
        ));
    }

    // ─── §periodeActive ─────────────────────────────────────────────────────────

    @Nested
    @DisplayName("periodeActive")
    class PeriodeActiveTest {

        @Test
        void periodeOuverte_couvreToujours() {
            var periodes = List.of(periode(LocalDate.of(2026, 1, 1), null, 0.58, 0.42));
            assertThat(MoteurCalcul.periodeActive(periodes, 2026, 1)).hasSize(2);
            assertThat(MoteurCalcul.periodeActive(periodes, 2035, 12)).hasSize(2);
        }

        @Test
        void periodeFermee_horsRangeDonne_listeVide() {
            var periodes = List.of(periode(
                    LocalDate.of(2026, 1, 1), LocalDate.of(2026, 6, 30), 0.58, 0.42));
            assertThat(MoteurCalcul.periodeActive(periodes, 2026, 7)).isEmpty();
        }

        @Test
        void transition_julletOuAout() {
            var periodes = List.of(
                    periode(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 7, 31), 0.58, 0.42),
                    periode(LocalDate.of(2026, 8, 1), null, 0.65, 0.35)
            );
            var repsJuillet = MoteurCalcul.periodeActive(periodes, 2026, 7);
            assertThat(repsJuillet.stream().filter(r -> DYLAN.equals(r.membreId())).findFirst()
                    .map(RepartitionCalcul::quotePart).orElse(-1.0)).isEqualTo(0.58);

            var repsAout = MoteurCalcul.periodeActive(periodes, 2026, 8);
            assertThat(repsAout.stream().filter(r -> DYLAN.equals(r.membreId())).findFirst()
                    .map(RepartitionCalcul::quotePart).orElse(-1.0)).isEqualTo(0.65);
        }

        @Test
        void listePeriodeVide_retourneListeVide() {
            assertThat(MoteurCalcul.periodeActive(List.of(), 2026, 1)).isEmpty();
            assertThat(MoteurCalcul.periodeActive(null, 2026, 1)).isEmpty();
        }
    }

    // ─── §quotePartEffective ────────────────────────────────────────────────────

    @Nested
    @DisplayName("quotePartEffective")
    class QuotePartEffectiveTest {

        private final List<RepartitionPeriodeCalcul> periodes5842 = List.of(
                periode(LocalDate.of(2026, 1, 1), null, 0.58, 0.42));

        @Test
        @DisplayName("AUTO avec 2 membres 58/42 — non-régression golden")
        void auto_58_42_nonRegression() {
            var p = poste(TypeRepartition.AUTO);
            assertThat(MoteurCalcul.quotePartEffective(p, DYLAN,   2026, 6, periodes5842, 2))
                    .isCloseTo(0.58, within(1e-9));
            assertThat(MoteurCalcul.quotePartEffective(p, MELANIE, 2026, 6, periodes5842, 2))
                    .isCloseTo(0.42, within(1e-9));
        }

        @Test
        @DisplayName("REVERSE_AUTO avec 2 membres → permutation exacte 42/58")
        void reverseAuto_2membres_permutation() {
            var p = poste(TypeRepartition.REVERSE_AUTO);
            assertThat(MoteurCalcul.quotePartEffective(p, DYLAN,   2026, 6, periodes5842, 2))
                    .isCloseTo(0.42, within(1e-9));
            assertThat(MoteurCalcul.quotePartEffective(p, MELANIE, 2026, 6, periodes5842, 2))
                    .isCloseTo(0.58, within(1e-9));
        }

        @Test
        @DisplayName("REVERSE_AUTO avec 3 membres → complément normalisé = 1")
        void reverseAuto_3membres_complementNormalise() {
            // 3 membres : 0.40 / 0.35 / 0.25
            var periodes3 = List.of(new RepartitionPeriodeCalcul(
                    LocalDate.of(2026, 1, 1), null,
                    List.of(new RepartitionCalcul(DYLAN, 0.40),
                            new RepartitionCalcul(MELANIE, 0.35),
                            new RepartitionCalcul(ALEXIS, 0.25))
            ));
            var p = poste(TypeRepartition.REVERSE_AUTO);
            double d = MoteurCalcul.quotePartEffective(p, DYLAN,   2026, 1, periodes3, 3);
            double m = MoteurCalcul.quotePartEffective(p, MELANIE, 2026, 1, periodes3, 3);
            double a = MoteurCalcul.quotePartEffective(p, ALEXIS,  2026, 1, periodes3, 3);

            assertThat(d).isCloseTo((1 - 0.40) / 2, within(1e-9)); // 0.30
            assertThat(m).isCloseTo((1 - 0.35) / 2, within(1e-9)); // 0.325
            assertThat(a).isCloseTo((1 - 0.25) / 2, within(1e-9)); // 0.375
            assertThat(d + m + a).isCloseTo(1.0, within(1e-9));     // Σ = 1
        }

        @Test
        @DisplayName("CUSTOM 100%/0% — parts du poste utilisées, pas de la période")
        void custom_100_0() {
            var p = posteCustom(1.0, 0.0);
            assertThat(MoteurCalcul.quotePartEffective(p, DYLAN,   2026, 1, periodes5842, 2))
                    .isEqualTo(1.0);
            assertThat(MoteurCalcul.quotePartEffective(p, MELANIE, 2026, 1, periodes5842, 2))
                    .isEqualTo(0.0);
        }

        @Test
        @DisplayName("Mono-membre → toujours 1.0 quel que soit typeRepartition")
        void monoMembre_toujours1() {
            for (TypeRepartition type : TypeRepartition.values()) {
                var p = poste(type);
                assertThat(MoteurCalcul.quotePartEffective(p, DYLAN, 2026, 1, periodes5842, 1))
                        .as("type=%s", type).isEqualTo(1.0);
                assertThat(MoteurCalcul.quotePartEffective(p, DYLAN, 2026, 1, periodes5842, 0))
                        .as("type=%s, nbMembres=0", type).isEqualTo(1.0);
            }
        }

        @Test
        @DisplayName("AUTO sans période active pour le mois → 0.0")
        void auto_sansPeriodeActive_retourne0() {
            var periodesFermee = List.of(
                    periode(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31), 0.58, 0.42));
            var p = poste(TypeRepartition.AUTO);
            assertThat(MoteurCalcul.quotePartEffective(p, DYLAN, 2026, 4, periodesFermee, 2))
                    .isEqualTo(0.0);
        }
    }

    // ─── Intégration : transition en cours d'année ─────────────────────────────

    @Nested
    @DisplayName("Transition de prorata en cours d'année")
    class TransitionIntegration {

        @Test
        @DisplayName("Poste AUTO — transition 58/42 → 65/35 au 1er août 2026")
        void auto_transitionAout() {
            List<RepartitionPeriodeCalcul> periodes = List.of(
                    periode(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 7, 31), 0.58, 0.42),
                    periode(LocalDate.of(2026, 8, 1), null, 0.65, 0.35)
            );

            var charge = new PosteCalcul(UUID.randomUUID(), TypePoste.CHARGE, 1000.0, "CHF", 1,
                    null, null, ModeComptabilisation.MENSUALISE, MomentPeriode.DEBUT_PERIODE,
                    null, TypeRepartition.AUTO, List.of(), List.of(), null);

            ParametresScenario params = new ParametresScenario(
                    "CHF", 2026, 0.0, 1, periodes, Map.of(),
                    List.of(charge), List.of(DYLAN, MELANIE));

            // Janvier à juillet : 58%
            AggregatMensuel aggJanDylan = MoteurCalcul.aggregatMembreMois(params, DYLAN, 2026, 1);
            assertThat(aggJanDylan.charges()).isCloseTo(580.0, within(0.01));

            // Août et après : 65%
            AggregatMensuel aggAoutDylan = MoteurCalcul.aggregatMembreMois(params, DYLAN, 2026, 8);
            assertThat(aggAoutDylan.charges()).isCloseTo(650.0, within(0.01));

            // Vérification Mélanie : 42% en jan, 35% en août
            AggregatMensuel aggJanMelanie = MoteurCalcul.aggregatMembreMois(params, MELANIE, 2026, 1);
            assertThat(aggJanMelanie.charges()).isCloseTo(420.0, within(0.01));

            AggregatMensuel aggAoutMelanie = MoteurCalcul.aggregatMembreMois(params, MELANIE, 2026, 8);
            assertThat(aggAoutMelanie.charges()).isCloseTo(350.0, within(0.01));
        }

        @Test
        @DisplayName("Golden 2026 non-régressé — AUTO période unique 58/42")
        void golden2026_nonRegression() {
            ParametresScenario params = GoldenFixture.buildScenario2026(DYLAN, MELANIE);
            ProjectionAnnuelle proj = MoteurCalcul.projectionAnnuelle(params, 2026);

            // Totaux golden (doc 01 §8-bis T2) — au centime près
            assertThat(proj.totalAnnuel().revenus())   .isCloseTo(140350.0, within(0.01));
            assertThat(proj.totalAnnuel().charges())   .isCloseTo(62322.0,  within(0.01));
            assertThat(proj.totalAnnuel().reserves())  .isCloseTo(8520.0,   within(0.01));
            assertThat(proj.totalAnnuel().soldeDisponible()).isCloseTo(69508.0, within(0.01));
        }
    }

    // ─── validerRepartition (inchangé) ─────────────────────────────────────────

    @Test
    @DisplayName("validerRepartition — somme != 1 → exception")
    void validerRepartition_sommeInvalide() {
        var reps = List.of(new RepartitionCalcul(DYLAN, 0.60), new RepartitionCalcul(MELANIE, 0.60));
        assertThatThrownBy(() -> MoteurCalcul.validerRepartition(reps))
                .isInstanceOf(RepartitionInvalideException.class);
    }

    @Test
    @DisplayName("validerRepartition — somme = 1 → OK")
    void validerRepartition_sommeValide() {
        var reps = List.of(new RepartitionCalcul(DYLAN, 0.58), new RepartitionCalcul(MELANIE, 0.42));
        assertThatCode(() -> MoteurCalcul.validerRepartition(reps)).doesNotThrowAnyException();
    }
}


