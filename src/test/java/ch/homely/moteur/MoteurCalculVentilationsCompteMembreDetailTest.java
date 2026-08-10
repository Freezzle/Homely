package ch.homely.moteur;

import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.MomentPeriode;
import ch.homely.poste.NaturePoste;
import ch.homely.poste.TypePoste;
import ch.homely.poste.TypeRepartition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static ch.homely.poste.ModeComptabilisation.*;
import static ch.homely.poste.MomentPeriode.*;
import static ch.homely.poste.TypePoste.*;
import static org.assertj.core.api.Assertions.*;

/**
 * Golden tests pour {@link MoteurCalcul#ventilationsCompteMembreDetail} — récapitulatif
 * mensuel par compte du dashboard (vue membre). Vérifie que la désagrégation
 * mensualisé/échu et revenu/sortie est cohérente avec {@link MoteurCalcul#ventilations}
 * (déjà golden-testé ailleurs) et avec les invariants du moteur
 * ({@code contribution} vs {@code contributionReelle}).
 */
class MoteurCalculVentilationsCompteMembreDetailTest {

    static final UUID DYLAN   = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID MELANIE = UUID.fromString("00000000-0000-0000-0000-000000000002");
    static final UUID COMPTE_COMMUN = UUID.fromString("00000000-0000-0000-0000-0000000000c1");
    static final UUID COMPTE_DYLAN  = UUID.fromString("00000000-0000-0000-0000-0000000000c2");

    static final double TOLERANCE = 1e-6;

    private static PosteCalcul poste(TypePoste type, double montant, int dMois,
                                      LocalDate debut, LocalDate fin,
                                      ModeComptabilisation mode, MomentPeriode moment,
                                      TypeRepartition typeRepartition, List<RepartitionCalcul> repartitions,
                                      List<VentilationCalcul> ventilations) {
        return new PosteCalcul(UUID.randomUUID(), type, montant, "CHF", dMois,
                debut, fin, mode, moment, NaturePoste.EFFECTIF, typeRepartition,
                repartitions, ventilations, null);
    }

    private static ParametresScenario scenario(List<PosteCalcul> postes) {
        List<RepartitionCalcul> repDef = List.of(
                new RepartitionCalcul(DYLAN, 0.6),
                new RepartitionCalcul(MELANIE, 0.4)
        );
        List<RepartitionPeriodeCalcul> periodes = List.of(
                new RepartitionPeriodeCalcul(LocalDate.of(2020, 1, 1), null, repDef)
        );
        return new ParametresScenario("CHF", 2026, 0.0, 1, periodes, Map.of(), postes, List.of(DYLAN, MELANIE));
    }

    @Nested
    @DisplayName("Invariant mensualisé/échu")
    class Invariant {

        @Test
        @DisplayName("Charge PERIODIQUE trimestrielle : somme échue == somme mensualisée sur 3 mois")
        void chargePeriodiqueTrimestrielle() {
            PosteCalcul charge = poste(CHARGE, 300, 3, LocalDate.of(2026, 1, 1), null,
                    PERIODIQUE, DEBUT_PERIODE, TypeRepartition.AUTO, List.of(),
                    List.of(new VentilationCalcul(DYLAN, COMPTE_COMMUN), new VentilationCalcul(MELANIE, COMPTE_COMMUN)));
            ParametresScenario params = scenario(List.of(charge));

            double sommeMensualisee = 0, sommeEchue = 0;
            for (int m = 1; m <= 3; m++) {
                VentilationsCompteDetail v = MoteurCalcul.ventilationsCompteMembreDetail(params, 2026, m);
                Map<UUID, DetailCompteMembre> parMembre = v.parCompteMembre().getOrDefault(COMPTE_COMMUN, Map.of());
                DetailCompteMembre dylanDetail = parMembre.getOrDefault(DYLAN, DetailCompteMembre.zero());
                DetailCompteMembre melanieDetail = parMembre.getOrDefault(MELANIE, DetailCompteMembre.zero());
                sommeMensualisee += dylanDetail.chargesReservesMensualise() + melanieDetail.chargesReservesMensualise();
                sommeEchue += dylanDetail.chargesReservesEchu() + melanieDetail.chargesReservesEchu();
            }
            assertThat(sommeMensualisee).isCloseTo(300.0, within(TOLERANCE));
            assertThat(sommeEchue).isCloseTo(300.0, within(TOLERANCE));
            // mode=PERIODIQUE : mensualisé et échu coïncident déjà (montant plein sur mois d'ancrage)
        }

        @Test
        @DisplayName("Charge MENSUALISE annuelle : mensualisé lissé chaque mois, échu concentré en un seul mois")
        void chargeMensualiseeAnnuelle() {
            PosteCalcul charge = poste(CHARGE, 1200, 12, LocalDate.of(2026, 1, 1), null,
                    MENSUALISE, DEBUT_PERIODE, TypeRepartition.AUTO, List.of(),
                    List.of(new VentilationCalcul(DYLAN, COMPTE_COMMUN), new VentilationCalcul(MELANIE, COMPTE_COMMUN)));
            ParametresScenario params = scenario(List.of(charge));

            double sommeMensualisee = 0, sommeEchue = 0;
            int moisAvecEcheance = 0;
            for (int m = 1; m <= 12; m++) {
                VentilationsCompteDetail v = MoteurCalcul.ventilationsCompteMembreDetail(params, 2026, m);
                DetailCompteMembre dylanDetail = v.parCompteMembre().get(COMPTE_COMMUN).get(DYLAN);
                DetailCompteMembre melanieDetail = v.parCompteMembre().get(COMPTE_COMMUN).get(MELANIE);
                double mensu = dylanDetail.chargesReservesMensualise() + melanieDetail.chargesReservesMensualise();
                double echu = dylanDetail.chargesReservesEchu() + melanieDetail.chargesReservesEchu();
                assertThat(mensu).isCloseTo(100.0, within(TOLERANCE)); // 1200/12 chaque mois
                if (echu != 0) {
                    moisAvecEcheance++;
                    assertThat(echu).isCloseTo(1200.0, within(TOLERANCE)); // montant plein sur mois d'ancrage
                }
                sommeMensualisee += mensu;
                sommeEchue += echu;
            }
            assertThat(moisAvecEcheance).isEqualTo(1);
            assertThat(sommeMensualisee).isCloseTo(1200.0, within(TOLERANCE));
            assertThat(sommeEchue).isCloseTo(1200.0, within(TOLERANCE));
        }

        @Test
        @DisplayName("One-shot : mensualisé == échu, concentré sur le mois de début")
        void oneShot() {
            PosteCalcul reserve = poste(RESERVE, 500, 0, LocalDate.of(2026, 5, 1), null,
                    MENSUALISE, DEBUT_PERIODE, TypeRepartition.AUTO, List.of(),
                    List.of(new VentilationCalcul(DYLAN, COMPTE_COMMUN), new VentilationCalcul(MELANIE, COMPTE_COMMUN)));
            ParametresScenario params = scenario(List.of(reserve));

            for (int m = 1; m <= 12; m++) {
                VentilationsCompteDetail v = MoteurCalcul.ventilationsCompteMembreDetail(params, 2026, m);
                Map<UUID, DetailCompteMembre> parMembre = v.parCompteMembre().getOrDefault(COMPTE_COMMUN, Map.of());
                double mensu = parMembre.values().stream().mapToDouble(DetailCompteMembre::chargesReservesMensualise).sum();
                double echu = parMembre.values().stream().mapToDouble(DetailCompteMembre::chargesReservesEchu).sum();
                if (m == 5) {
                    assertThat(mensu).isCloseTo(500.0, within(TOLERANCE));
                    assertThat(echu).isCloseTo(500.0, within(TOLERANCE));
                } else {
                    assertThat(mensu).isCloseTo(0.0, within(TOLERANCE));
                    assertThat(echu).isCloseTo(0.0, within(TOLERANCE));
                }
            }
        }
    }

    @Nested
    @DisplayName("Cohérence avec ventilations() existant (parCompteMembre)")
    class CoherenceAvecVentilationsExistant {

        @Test
        @DisplayName("chargesReservesMensualise == valeur négative implicite de ventilations().parCompteMembre() pour une charge")
        void coherenceCharge() {
            PosteCalcul charge = poste(CHARGE, 600, 1, null, null, MENSUALISE, DEBUT_PERIODE,
                    TypeRepartition.AUTO, List.of(),
                    List.of(new VentilationCalcul(DYLAN, COMPTE_DYLAN)));
            PosteCalcul revenu = poste(REVENU, 1000, 1, null, null, MENSUALISE, DEBUT_PERIODE,
                    TypeRepartition.CUSTOM, List.of(new RepartitionCalcul(DYLAN, 1.0)),
                    List.of(new VentilationCalcul(DYLAN, COMPTE_DYLAN)));
            ParametresScenario params = scenario(List.of(charge, revenu));

            Ventilations vSimple = MoteurCalcul.ventilations(params, 2026, 3);
            VentilationsCompteDetail vDetail = MoteurCalcul.ventilationsCompteMembreDetail(params, 2026, 3);

            double montantSimple = vSimple.parCompteMembre().get(COMPTE_DYLAN).get(DYLAN);
            DetailCompteMembre detail = vDetail.parCompteMembre().get(COMPTE_DYLAN).get(DYLAN);

            // ventilations() cumule charge (600*0.6 quote-part AUTO) — revenu CUSTOM 100% Dylan
            // ventilationsCompteMembreDetail sépare : revenusMensualise = 1000, chargesReservesMensualise = 360
            assertThat(detail.revenusMensualise()).isCloseTo(1000.0, within(TOLERANCE));
            assertThat(detail.chargesReservesMensualise()).isCloseTo(600 * 0.6, within(TOLERANCE));
            // montantSimple additionne les deux contributions signées par le moteur existant (charge+revenu, quote-part appliquée à chacun)
            assertThat(montantSimple).isCloseTo(detail.revenusMensualise() + detail.chargesReservesMensualise(), within(TOLERANCE));
        }
    }

    @Nested
    @DisplayName("Filtrage : membres sans quote-part ou sans compte résolu absents")
    class Filtrage {

        @Test
        @DisplayName("Poste sans ventilation compte pour un membre : absent du détail")
        void sansCompteResolu() {
            PosteCalcul charge = poste(CHARGE, 400, 1, null, null, MENSUALISE, DEBUT_PERIODE,
                    TypeRepartition.AUTO, List.of(),
                    List.of(new VentilationCalcul(DYLAN, COMPTE_DYLAN))); // Mélanie non ventilée
            ParametresScenario params = scenario(List.of(charge));

            VentilationsCompteDetail v = MoteurCalcul.ventilationsCompteMembreDetail(params, 2026, 1);
            Map<UUID, DetailCompteMembre> parMembre = v.parCompteMembre().get(COMPTE_DYLAN);
            assertThat(parMembre).containsOnlyKeys(DYLAN);
        }
    }
}
