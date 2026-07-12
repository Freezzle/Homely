package ch.homely.moteur;
import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.MomentPeriode;
import ch.homely.poste.NaturePoste;
import ch.homely.poste.TypePoste;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import static ch.homely.poste.ModeComptabilisation.*;
import static ch.homely.poste.MomentPeriode.*;
import static ch.homely.poste.TypePoste.*;
import static org.assertj.core.api.Assertions.*;
class MoteurCalculReelTest {
    private static final double TOL = 1e-6;
    private static final UUID DYLAN   = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID MELANIE = UUID.fromString("00000000-0000-0000-0000-000000000002");
    static PosteCalcul poste(TypePoste type, double montant, int dMois, LocalDate debut,
                             ModeComptabilisation mode, MomentPeriode moment) {
        return new PosteCalcul(UUID.randomUUID(), type, montant, "CHF", dMois,
                debut, null, mode, moment, NaturePoste.EFFECTIF,
                null, List.of(), List.of(), null, null);
    }
    static ParametresScenario golden() {
        return GoldenFixture.buildScenario2026(DYLAN, MELANIE);
    }
    @Nested
    @DisplayName("contributionReelle")
    class ContributionReelle {
        @Test
        void mensualiseD12SansFenetreForcePeriodique() {
            PosteCalcul p = poste(REVENU, 6300, 12, null, MENSUALISE, DEBUT_PERIODE);
            for (int m = 1; m <= 12; m++) {
                assertThat(MoteurCalcul.contribution(p, 2026, m)).isCloseTo(525.0, within(TOL));
            }
            for (int m = 1; m <= 12; m++) {
                double expected = (m == 1) ? 6300.0 : 0.0;
                assertThat(MoteurCalcul.contributionReelle(p, 2026, m))
                        .as("mois %d", m).isCloseTo(expected, within(TOL));
            }
        }
        @Test
        void mensualiseD12AvecFenetrePartielle() {
            PosteCalcul p = poste(REVENU, 6300, 12, LocalDate.of(2026, 11, 1),
                    MENSUALISE, DEBUT_PERIODE);
            assertThat(MoteurCalcul.contribution(p, 2026, 6)).isEqualTo(0.0);
            assertThat(MoteurCalcul.contribution(p, 2026, 11)).isCloseTo(525.0, within(TOL));
            assertThat(MoteurCalcul.contributionReelle(p, 2026, 11)).isCloseTo(6300.0, within(TOL));
            assertThat(MoteurCalcul.contributionReelle(p, 2026, 12)).isEqualTo(0.0);
        }
        @Test
        void d1Identique() {
            PosteCalcul p = poste(CHARGE, 1500, 1, null, MENSUALISE, DEBUT_PERIODE);
            for (int m = 1; m <= 12; m++) {
                assertThat(MoteurCalcul.contributionReelle(p, 2026, m))
                        .isCloseTo(MoteurCalcul.contribution(p, 2026, m), within(TOL))
                        .isCloseTo(1500.0, within(TOL));
            }
        }
        @Test
        void periodiqueReelEgalClassique() {
            PosteCalcul p = poste(RESERVE, 3600, 12, LocalDate.of(2026, 11, 1),
                    PERIODIQUE, DEBUT_PERIODE);
            for (int m = 1; m <= 12; m++) {
                assertThat(MoteurCalcul.contributionReelle(p, 2026, m))
                        .isCloseTo(MoteurCalcul.contribution(p, 2026, m), within(TOL));
            }
        }
        @Test
        void finPeriodeForce() {
            PosteCalcul p = poste(REVENU, 1200, 12, LocalDate.of(2026, 1, 1),
                    MENSUALISE, FIN_PERIODE);
            assertThat(MoteurCalcul.contributionReelle(p, 2026, 12)).isCloseTo(1200.0, within(TOL));
            for (int m = 1; m <= 11; m++) {
                assertThat(MoteurCalcul.contributionReelle(p, 2026, m)).isEqualTo(0.0);
            }
        }
        @Test
        void invariantAnnuel() {
            List<PosteCalcul> cas = List.of(
                    poste(REVENU, 6300, 12, null, MENSUALISE, DEBUT_PERIODE),
                    poste(CHARGE, 3600, 6, null, MENSUALISE, DEBUT_PERIODE),
                    poste(RESERVE, 2400, 4, null, MENSUALISE, FIN_PERIODE),
                    poste(CHARGE, 1200, 12, null, PERIODIQUE, DEBUT_PERIODE)
            );
            for (PosteCalcul p : cas) {
                double sumReel = 0, sumMens = 0;
                for (int m = 1; m <= 12; m++) {
                    sumReel += MoteurCalcul.contributionReelle(p, 2026, m);
                    sumMens += MoteurCalcul.contribution(p, 2026, m);
                }
                assertThat(sumReel).isCloseTo(sumMens, within(1e-6));
            }
        }
    }
    @Nested
    @DisplayName("projectionAnnuelle")
    class ProjectionAnnuelleTests {
        @Test
        void vecteursGoldenInchanges() {
            var proj = MoteurCalcul.projectionAnnuelle(golden(), 2026);
            assertThat(proj.mois().get(0).revenus()).isCloseTo(11_000.00, within(0.01));
            assertThat(proj.mois().get(0).charges()).isCloseTo(5_172.67, within(0.01));
            assertThat(proj.totalAnnuel().revenus()).isCloseTo(140_350.00, within(0.01));
            assertThat(proj.totalAnnuel().soldeDisponible()).isCloseTo(69_508.00, within(0.01));
            assertThat(proj.moisReel()).hasSize(12);
            assertThat(proj.moisParMembreReel()).isNotEmpty();
        }
        @Test
        void invariantSommeAnnuelle() {
            var proj = MoteurCalcul.projectionAnnuelle(golden(), 2026);
            double sumMens = proj.mois().stream().mapToDouble(AggregatMensuel::charges).sum();
            double sumReel = proj.moisReel().stream().mapToDouble(AggregatMensuel::charges).sum();
            assertThat(sumReel).isCloseTo(sumMens, within(0.01));
        }
        @Test
        void moisReelDifferentDuMensualise() {
            var proj = MoteurCalcul.projectionAnnuelle(golden(), 2026);
            boolean diff = false;
            for (int m = 0; m < 12; m++) {
                if (Math.abs(proj.mois().get(m).charges() - proj.moisReel().get(m).charges()) > 0.01) {
                    diff = true; break;
                }
            }
            assertThat(diff).isTrue();
        }
    }
    @Nested
    @DisplayName("nature descriptif")
    class NatureDescriptive {
        @Test
        void natureNimpacteRien() {
            PosteCalcul eff = new PosteCalcul(UUID.randomUUID(), CHARGE, 500.0, "CHF", 3,
                    null, null, MENSUALISE, DEBUT_PERIODE, NaturePoste.EFFECTIF,
                    null, List.of(), List.of(), null, null);
            PosteCalcul ant = new PosteCalcul(UUID.randomUUID(), CHARGE, 500.0, "CHF", 3,
                    null, null, MENSUALISE, DEBUT_PERIODE, NaturePoste.PREVISION,
                    null, List.of(), List.of(), null, null);
            for (int m = 1; m <= 12; m++) {
                assertThat(MoteurCalcul.contribution(eff, 2026, m))
                        .isCloseTo(MoteurCalcul.contribution(ant, 2026, m), within(TOL));
                assertThat(MoteurCalcul.contributionReelle(eff, 2026, m))
                        .isCloseTo(MoteurCalcul.contributionReelle(ant, 2026, m), within(TOL));
            }
        }
        @Test
        void natureNullDefautEffectif() {
            PosteCalcul p = new PosteCalcul(UUID.randomUUID(), CHARGE, 100.0, "CHF", 1,
                    null, null, MENSUALISE, DEBUT_PERIODE, null,
                    null, List.of(), List.of(), null, null);
            assertThat(p.nature()).isEqualTo(NaturePoste.EFFECTIF);
        }
    }
}
