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

import static ch.homely.poste.ModeComptabilisation.MENSUALISE;
import static ch.homely.poste.MomentPeriode.DEBUT_PERIODE;
import static ch.homely.poste.TypePoste.CHARGE;
import static ch.homely.poste.TypePoste.RESERVE;
import static ch.homely.poste.TypePoste.REVENU;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Vecteurs golden du <b>routage comptes</b> : compte pivot (là où la transaction a
 * physiquement lieu) + contreparties au prorata, le sens étant dérivé du type de poste.
 *
 * <p>Couvre les deux cas de référence :</p>
 * <ul>
 *   <li><b>A2</b> — facture annuelle de voiture débitée du compte 1 ; Membre 2 envoie 40%
 *       depuis son compte 2 vers le compte 1, Membre 1 envoie 60% depuis le compte 1 vers
 *       le compte 1 (aucun virement : l'argent y est déjà).</li>
 *   <li><b>A3</b> — allocations de 260 encaissées sur le compte 1 par Membre 1, redistribuées
 *       à 60% vers le compte 2 et 40% vers le compte 3.</li>
 * </ul>
 */
class MoteurCalculRoutageTest {

    static final UUID MEMBRE_1 = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID MEMBRE_2 = UUID.fromString("00000000-0000-0000-0000-000000000002");
    static final UUID COMPTE_1 = UUID.fromString("00000000-0000-0000-0000-0000000000c1");
    static final UUID COMPTE_2 = UUID.fromString("00000000-0000-0000-0000-0000000000c2");
    static final UUID COMPTE_3 = UUID.fromString("00000000-0000-0000-0000-0000000000c3");

    static final double TOLERANCE = 1e-6;

    private static PosteCalcul poste(TypePoste type, double montant, int dMois,
                                     ModeComptabilisation mode, MomentPeriode moment,
                                     TypeRepartition typeRepartition,
                                     List<RepartitionCalcul> repartitions,
                                     List<VentilationCalcul> ventilations,
                                     UUID comptePivotId) {
        return new PosteCalcul(UUID.randomUUID(), type, montant, "CHF", dMois,
                LocalDate.of(2026, 1, 1), null, mode, moment, NaturePoste.EFFECTIF,
                typeRepartition, repartitions, ventilations, null, null, null, true, comptePivotId);
    }

    private static ParametresScenario scenario(List<PosteCalcul> postes, List<UUID> membres) {
        List<RepartitionCalcul> repDef = membres.size() == 2
                ? List.of(new RepartitionCalcul(MEMBRE_1, 0.6), new RepartitionCalcul(MEMBRE_2, 0.4))
                : List.of(new RepartitionCalcul(MEMBRE_1, 1.0));
        List<RepartitionPeriodeCalcul> periodes = List.of(
                new RepartitionPeriodeCalcul(LocalDate.of(2020, 1, 1), null, repDef));
        return new ParametresScenario("CHF", 2026, 0.0, 1, periodes, Map.of(), postes, membres);
    }

    @Nested
    @DisplayName("A2 — charge sur un compte pivot, alimenté par les contreparties")
    class A2 {

        /** Facture voiture 1200/an mensualisée, pivot = compte 1, répartition 60/40. */
        private ParametresScenario params() {
            PosteCalcul facture = poste(CHARGE, 1200, 12, MENSUALISE, DEBUT_PERIODE,
                    TypeRepartition.AUTO, List.of(),
                    List.of(new VentilationCalcul(MEMBRE_1, COMPTE_1, 1.0),
                            new VentilationCalcul(MEMBRE_2, COMPTE_2, 1.0)),
                    COMPTE_1);
            return scenario(List.of(facture), List.of(MEMBRE_1, MEMBRE_2));
        }

        @Test
        @DisplayName("Toute la charge est imputée sur le compte pivot, pas éclatée par membre")
        void chargeImputeeSurLePivot() {
            Ventilations v = MoteurCalcul.ventilations(params(), 2026, 1);

            Map<UUID, Double> surPivot = v.parCompteMembre().get(COMPTE_1);
            assertThat(surPivot).isNotNull();
            assertThat(surPivot.get(MEMBRE_1)).isCloseTo(60.0, within(TOLERANCE));
            assertThat(surPivot.get(MEMBRE_2)).isCloseTo(40.0, within(TOLERANCE));
            // Le compte 2 n'est qu'une contrepartie : aucune charge n'y est imputée.
            assertThat(v.parCompteMembre()).doesNotContainKey(COMPTE_2);
        }

        @Test
        @DisplayName("Virement compte 2 → compte 1 pour la seule part du membre 2 (40%)")
        void virementDepuisLaContrepartieUniquement() {
            List<VirementRoutage> virements = MoteurCalcul.virementsRoutage(params(), 2026, 1);

            assertThat(virements).hasSize(1);
            VirementRoutage v = virements.getFirst();
            assertThat(v.membreId()).isEqualTo(MEMBRE_2);
            assertThat(v.compteSourceId()).isEqualTo(COMPTE_2);
            assertThat(v.compteDestinationId()).isEqualTo(COMPTE_1);
            assertThat(v.mensualise()).isCloseTo(40.0, within(TOLERANCE));
        }
    }

    @Nested
    @DisplayName("A3 — revenu encaissé sur le pivot, redistribué vers les contreparties")
    class A3 {

        /** Allocations 260/mois sur le compte 1, redistribuées 60% compte 2 / 40% compte 3. */
        private ParametresScenario params() {
            PosteCalcul allocations = poste(REVENU, 260, 1, MENSUALISE, DEBUT_PERIODE,
                    TypeRepartition.CUSTOM, List.of(new RepartitionCalcul(MEMBRE_1, 1.0)),
                    List.of(new VentilationCalcul(MEMBRE_1, COMPTE_2, 0.6),
                            new VentilationCalcul(MEMBRE_1, COMPTE_3, 0.4)),
                    COMPTE_1);
            return scenario(List.of(allocations), List.of(MEMBRE_1));
        }

        @Test
        @DisplayName("Le revenu est encaissé en totalité sur le compte pivot")
        void revenuEncaisseSurLePivot() {
            Ventilations v = MoteurCalcul.ventilations(params(), 2026, 1);

            assertThat(v.parCompteMembre().get(COMPTE_1).get(MEMBRE_1)).isCloseTo(260.0, within(TOLERANCE));
            assertThat(v.parCompteMembre()).doesNotContainKeys(COMPTE_2, COMPTE_3);
        }

        @Test
        @DisplayName("Redistribution : 156 vers le compte 2 et 104 vers le compte 3")
        void redistributionAuProrata() {
            List<VirementRoutage> virements = MoteurCalcul.virementsRoutage(params(), 2026, 1);

            assertThat(virements).hasSize(2);
            assertThat(virements).allSatisfy(v -> {
                assertThat(v.membreId()).isEqualTo(MEMBRE_1);
                assertThat(v.compteSourceId()).isEqualTo(COMPTE_1);
            });
            assertThat(montantVers(virements, COMPTE_2)).isCloseTo(156.0, within(TOLERANCE));
            assertThat(montantVers(virements, COMPTE_3)).isCloseTo(104.0, within(TOLERANCE));
        }

        private double montantVers(List<VirementRoutage> virements, UUID compteId) {
            return virements.stream()
                    .filter(v -> v.compteDestinationId().equals(compteId))
                    .mapToDouble(VirementRoutage::echu)
                    .sum();
        }
    }

    @Nested
    @DisplayName("Règles transverses")
    class Transverse {

        @Test
        @DisplayName("Sans compte pivot, le mode hérité éclate la part du membre sur ses comptes")
        void modeHeriteSansPivot() {
            PosteCalcul charge = poste(CHARGE, 100, 1, MENSUALISE, DEBUT_PERIODE,
                    TypeRepartition.CUSTOM, List.of(new RepartitionCalcul(MEMBRE_1, 1.0)),
                    List.of(new VentilationCalcul(MEMBRE_1, COMPTE_2, 0.25),
                            new VentilationCalcul(MEMBRE_1, COMPTE_3, 0.75)),
                    null);
            ParametresScenario params = scenario(List.of(charge), List.of(MEMBRE_1));

            Ventilations v = MoteurCalcul.ventilations(params, 2026, 1);
            assertThat(v.parCompteMembre().get(COMPTE_2).get(MEMBRE_1)).isCloseTo(25.0, within(TOLERANCE));
            assertThat(v.parCompteMembre().get(COMPTE_3).get(MEMBRE_1)).isCloseTo(75.0, within(TOLERANCE));
            // Aucun pivot ⇒ aucun virement de routage (financement déduit du compte primaire).
            assertThat(MoteurCalcul.virementsRoutage(params, 2026, 1)).isEmpty();
        }

        @Test
        @DisplayName("Une RESERVE suit le sens d'une CHARGE : les contreparties alimentent le pivot")
        void reserveSuitLeSensDUneCharge() {
            PosteCalcul reserve = poste(RESERVE, 200, 1, MENSUALISE, DEBUT_PERIODE,
                    TypeRepartition.CUSTOM, List.of(new RepartitionCalcul(MEMBRE_1, 1.0)),
                    List.of(new VentilationCalcul(MEMBRE_1, COMPTE_2, 1.0)),
                    COMPTE_1);
            ParametresScenario params = scenario(List.of(reserve), List.of(MEMBRE_1));

            List<VirementRoutage> virements = MoteurCalcul.virementsRoutage(params, 2026, 1);
            assertThat(virements).hasSize(1);
            assertThat(virements.getFirst().compteSourceId()).isEqualTo(COMPTE_2);
            assertThat(virements.getFirst().compteDestinationId()).isEqualTo(COMPTE_1);
        }

        @Test
        @DisplayName("Quotes-parts de routage non normalisées : renormalisées à 1")
        void quotesPartsRenormalisees() {
            PosteCalcul charge = poste(CHARGE, 100, 1, MENSUALISE, DEBUT_PERIODE,
                    TypeRepartition.CUSTOM, List.of(new RepartitionCalcul(MEMBRE_1, 1.0)),
                    List.of(new VentilationCalcul(MEMBRE_1, COMPTE_2, 1.0),
                            new VentilationCalcul(MEMBRE_1, COMPTE_3, 3.0)),
                    COMPTE_1);
            ParametresScenario params = scenario(List.of(charge), List.of(MEMBRE_1));

            List<VirementRoutage> virements = MoteurCalcul.virementsRoutage(params, 2026, 1);
            assertThat(virements).hasSize(2);
            double versPivotDepuis2 = virements.stream()
                    .filter(v -> v.compteSourceId().equals(COMPTE_2))
                    .mapToDouble(VirementRoutage::mensualise).sum();
            double versPivotDepuis3 = virements.stream()
                    .filter(v -> v.compteSourceId().equals(COMPTE_3))
                    .mapToDouble(VirementRoutage::mensualise).sum();
            assertThat(versPivotDepuis2).isCloseTo(25.0, within(TOLERANCE));
            assertThat(versPivotDepuis3).isCloseTo(75.0, within(TOLERANCE));
        }
    }
}
