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
 * Tests golden pour {@link MoteurCalcul#estPersonnel(PosteCalcul)} et
 * {@link MoteurCalcul#aggregatMembreMoisSplit(ParametresScenario, UUID, int, int)}.
 *
 * <p>Scénario reproduisant le bug rapporté : un membre a un salaire personnel
 * mensualisé de 6 300 CHF/mois (D=1, MENSUALISE), un 13ᵉ salaire personnel périodique
 * de 6 300 CHF (D=12, PERIODIQUE/DEBUT, ancre=novembre), et le foyer partage un revenu
 * de 240 CHF/mois à 50/50 (CUSTOM). La régression constatée : hors du mois d'ancre, le
 * calcul (auparavant reconstruit côté frontend) attribuait un poids non nul au 13ᵉ
 * salaire alors que sa contribution réelle est 0 ce mois-là, faussant la répartition
 * perso/partagé (109,61 / 118,46 constatés au lieu de 6 300 / 120 attendus).
 */
class MoteurCalculSplitPersoPartageTest {

    static final UUID M1 = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID M2 = UUID.fromString("00000000-0000-0000-0000-000000000002");

    private static PosteCalcul posteCustom(TypePoste type, double montant, int dMois,
                                            LocalDate debut, ModeComptabilisation mode, MomentPeriode moment,
                                            List<RepartitionCalcul> repartitions) {
        return new PosteCalcul(UUID.randomUUID(), type, montant, "CHF", dMois,
                debut, null, mode, moment, NaturePoste.EFFECTIF,
                TypeRepartition.CUSTOM, repartitions, List.of(), null);
    }

    private static ParametresScenario scenario(List<PosteCalcul> postes) {
        // Aucune période AUTO nécessaire : tous les postes sont CUSTOM ci-dessous.
        return new ParametresScenario("CHF", 2026, 0.0, 1, List.of(), Map.of(), postes, List.of(M1, M2));
    }

    @Nested
    @DisplayName("estPersonnel")
    class EstPersonnel {

        @Test
        @DisplayName("CUSTOM avec un seul membre non-nul → personnel")
        void custom100Pourcent() {
            PosteCalcul poste = posteCustom(REVENU, 6300, 1, null, MENSUALISE, DEBUT_PERIODE,
                    List.of(new RepartitionCalcul(M1, 1.0), new RepartitionCalcul(M2, 0.0)));
            assertThat(MoteurCalcul.estPersonnel(poste)).isTrue();
        }

        @Test
        @DisplayName("CUSTOM avec deux membres non-nuls (50/50) → partagé")
        void custom5050() {
            PosteCalcul poste = posteCustom(REVENU, 240, 1, null, MENSUALISE, DEBUT_PERIODE,
                    List.of(new RepartitionCalcul(M1, 0.5), new RepartitionCalcul(M2, 0.5)));
            assertThat(MoteurCalcul.estPersonnel(poste)).isFalse();
        }

        @Test
        @DisplayName("AUTO → toujours partagé, quel que soit le nombre de membres")
        void autoToujoursPartage() {
            PosteCalcul poste = new PosteCalcul(UUID.randomUUID(), REVENU, 1000, "CHF", 1,
                    null, null, MENSUALISE, DEBUT_PERIODE, NaturePoste.EFFECTIF,
                    TypeRepartition.AUTO, List.of(), List.of(), null);
            assertThat(MoteurCalcul.estPersonnel(poste)).isFalse();
        }
    }

    @Nested
    @DisplayName("aggregatMembreMoisSplit — scénario du bug rapporté")
    class SplitScenario {

        private ParametresScenario buildScenario() {
            List<PosteCalcul> postes = List.of(
                    // Salaire personnel M1 : 6 300/mois, toujours actif
                    posteCustom(REVENU, 6300, 1, null, MENSUALISE, DEBUT_PERIODE,
                            List.of(new RepartitionCalcul(M1, 1.0), new RepartitionCalcul(M2, 0.0))),
                    // 13e salaire personnel M1 : 6 300 en novembre uniquement
                    posteCustom(REVENU, 6300, 12, LocalDate.of(2026, 11, 1), PERIODIQUE, DEBUT_PERIODE,
                            List.of(new RepartitionCalcul(M1, 1.0), new RepartitionCalcul(M2, 0.0))),
                    // Revenu partagé 240/mois à 50/50
                    posteCustom(REVENU, 240, 1, null, MENSUALISE, DEBUT_PERIODE,
                            List.of(new RepartitionCalcul(M1, 0.5), new RepartitionCalcul(M2, 0.5)))
            );
            return scenario(postes);
        }

        @Test
        @DisplayName("Janvier (hors ancre) : M1 perso=6300, partagé=120 — le 13e salaire ne contribue pas")
        void horsAncre() {
            ParametresScenario params = buildScenario();
            SplitPersoPartageMensuel split = MoteurCalcul.aggregatMembreMoisSplit(params, M1, 2026, 1);
            assertThat(split.revenusPerso()).isCloseTo(6300.0, within(0.01));
            assertThat(split.revenusPartage()).isCloseTo(120.0, within(0.01));
        }

        @Test
        @DisplayName("Novembre (ancre du 13e salaire) : M1 perso=12600, partagé=120")
        void surAncre() {
            ParametresScenario params = buildScenario();
            SplitPersoPartageMensuel split = MoteurCalcul.aggregatMembreMoisSplit(params, M1, 2026, 11);
            assertThat(split.revenusPerso()).isCloseTo(12_600.0, within(0.01));
            assertThat(split.revenusPartage()).isCloseTo(120.0, within(0.01));
        }

        @Test
        @DisplayName("M2 (0% du salaire/13e, 50% du partagé) : perso=0, partagé=120 en janvier")
        void membreSansSalairePersonnel() {
            ParametresScenario params = buildScenario();
            SplitPersoPartageMensuel split = MoteurCalcul.aggregatMembreMoisSplit(params, M2, 2026, 1);
            assertThat(split.revenusPerso()).isCloseTo(0.0, within(0.01));
            assertThat(split.revenusPartage()).isCloseTo(120.0, within(0.01));
        }

        @Test
        @DisplayName("perso + partagé = total agrégat du membre (aucune approximation), pour chaque mois")
        void sommeEgaleTotal() {
            ParametresScenario params = buildScenario();
            for (int m = 1; m <= 12; m++) {
                AggregatMensuel ag = MoteurCalcul.aggregatMembreMois(params, M1, 2026, m);
                SplitPersoPartageMensuel split = MoteurCalcul.aggregatMembreMoisSplit(params, M1, 2026, m);
                assertThat(split.revenusPerso() + split.revenusPartage())
                        .as("Mois %d", m)
                        .isCloseTo(ag.revenus(), within(1e-6));
            }
        }
    }
}
