package ch.homely.moteur;

import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.MomentPeriode;
import ch.homely.poste.TypePoste;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.*;

import static ch.homely.poste.ModeComptabilisation.*;
import static ch.homely.poste.MomentPeriode.*;
import static ch.homely.poste.TypePoste.*;
import static org.assertj.core.api.Assertions.*;

/**
 * Tests golden du moteur de calcul — vecteurs de référence doc 01 §8-bis.
 * Tolérance affichage : ±0,01 CHF (arrondi 2 décimales).
 * Tolérance interne   : ±1e-6.
 */
class MoteurCalculTest {

    // ─── identifiants membres ────────────────────────────────────────────────
    static final UUID DYLAN   = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID MELANIE = UUID.fromString("00000000-0000-0000-0000-000000000002");

    static final double TOLERANCE = 1e-6;

    // ─── helpers de construction ─────────────────────────────────────────────

    static PosteCalcul poste(TypePoste type, double montant, int dMois,
                              LocalDate debut, LocalDate fin,
                              ModeComptabilisation mode, MomentPeriode moment) {
        return new PosteCalcul(UUID.randomUUID(), type, montant, "CHF", dMois,
                debut, fin, mode, moment, ch.homely.poste.NaturePoste.EFFECTIF,
                List.of(), List.of(), null, null);
    }

    static PosteCalcul mensualisé(TypePoste type, double montant, int dMois) {
        return poste(type, montant, dMois, null, null, MENSUALISE, DEBUT_PERIODE);
    }

    static PosteCalcul mensuelToujours(TypePoste type, double montant) {
        return mensualisé(type, montant, 1);
    }

    static PosteCalcul periodiqueDebut(TypePoste type, double montant, int dMois, LocalDate debut) {
        return poste(type, montant, dMois, debut, null, PERIODIQUE, DEBUT_PERIODE);
    }

    static PosteCalcul mkPerFin(TypePoste type, double montant, int dMois, LocalDate debut) {
        return poste(type, montant, dMois, debut, null, PERIODIQUE, FIN_PERIODE);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // §T1 — Contributions élémentaires (doc 01 §8-bis T1)
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("T1 — Contributions élémentaires")
    class ContributionsElementaires {

        @Test
        @DisplayName("Loyer (CHARGE, 1500, D=1, MENSUALISE) → 1500 chaque mois")
        void loyer() {
            PosteCalcul loyer = mensuelToujours(CHARGE, 1500);
            assertThat(MoteurCalcul.contribution(loyer, 2026, 1)).isCloseTo(1500, withinPercentage(0.0001));
            assertThat(MoteurCalcul.contribution(loyer, 2026, 6)).isCloseTo(1500, withinPercentage(0.0001));
            assertThat(MoteurCalcul.contribution(loyer, 2026, 12)).isCloseTo(1500, withinPercentage(0.0001));
        }

        @Test
        @DisplayName("Électricité (CHARGE, 360, D=3, MENSUALISE) → 120 chaque mois")
        void electricite() {
            PosteCalcul elec = mensualisé(CHARGE, 360, 3);
            assertThat(MoteurCalcul.contribution(elec, 2026, 1)).isCloseTo(120.0, within(TOLERANCE));
            assertThat(MoteurCalcul.contribution(elec, 2026, 6)).isCloseTo(120.0, within(TOLERANCE));
        }

        @Test
        @DisplayName("13e salaire (REVENU, 6300, D=12, PERIODIQUE/DEBUT, ancre=nov) → 0/6300/0")
        void treizièmeSalaire() {
            PosteCalcul treize = periodiqueDebut(REVENU, 6300, 12, LocalDate.of(2026, 11, 1));
            // floorMod(10-11, 12) = floorMod(-1,12) = 11 ≠ 0 → 0 en octobre
            assertThat(MoteurCalcul.contribution(treize, 2026, 10)).isEqualTo(0.0);
            // floorMod(11-11, 12) = 0 → 6300 en novembre
            assertThat(MoteurCalcul.contribution(treize, 2026, 11)).isCloseTo(6300.0, within(TOLERANCE));
            // floorMod(12-11, 12) = 1 ≠ 0 → 0 en décembre
            assertThat(MoteurCalcul.contribution(treize, 2026, 12)).isEqualTo(0.0);
        }

        @Test
        @DisplayName("3e pilier (RESERVE, 3600, D=12, PERIODIQUE/DEBUT, ancre=nov) → 0 juin / 3600 nov")
        void troisiemePilier() {
            PosteCalcul pilier = periodiqueDebut(RESERVE, 3600, 12, LocalDate.of(2026, 11, 1));
            assertThat(MoteurCalcul.contribution(pilier, 2026, 6)).isEqualTo(0.0);
            assertThat(MoteurCalcul.contribution(pilier, 2026, 11)).isCloseTo(3600.0, within(TOLERANCE));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // §T2 — Projection annuelle 2026 (doc 01 §8-bis T2)
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("T2 — Projection annuelle 2026 (vecteurs golden)")
    class ProjectionAnnuelle2026 {

        ParametresScenario params;

        @BeforeEach
        void setUp() {
            params = GoldenFixture.buildScenario2026(DYLAN, MELANIE);
        }

        @Test
        @DisplayName("Total annuel FOYER : Revenus=140350 / Charges=62322 / Réserves=8520 / Solde=69508")
        void totalAnnuel() {
            ProjectionAnnuelle proj = MoteurCalcul.projectionAnnuelle(params, 2026);

            AggregatMensuel total = proj.totalAnnuel();
            assertThat(total.revenus()).as("Revenus 2026")
                    .isCloseTo(140_350.0, within(0.01));
            assertThat(total.charges()).as("Charges 2026")
                    .isCloseTo(62_322.0, within(0.01));
            assertThat(total.reserves()).as("Réserves 2026")
                    .isCloseTo(8_520.0, within(0.01));
            assertThat(total.soldeDisponible()).as("Solde 2026")
                    .isCloseTo(69_508.0, within(0.01));
        }

        @Test
        @DisplayName("Janvier : Revenus=11000 / Charges≈5172.67 / Réserves=410 / Solde≈5417.33")
        void janvier() {
            AggregatMensuel jan = MoteurCalcul.aggregatFoyerMois(params, 2026, 1);
            assertThat(jan.revenus()).isCloseTo(11_000.0, within(0.01));
            assertThat(jan.charges()).isCloseTo(5_172.67, within(0.01));
            assertThat(jan.reserves()).isCloseTo(410.0, within(0.01));
            assertThat(jan.soldeDisponible()).isCloseTo(5_417.33, within(0.01));
        }

        @Test
        @DisplayName("Avril : Revenus=11500 (allocation familiale)")
        void avril() {
            AggregatMensuel avr = MoteurCalcul.aggregatFoyerMois(params, 2026, 4);
            assertThat(avr.revenus()).isCloseTo(11_500.0, within(0.01));
        }

        @Test
        @DisplayName("Août : Revenus=11230 (Mélanie augmentation)")
        void aout() {
            AggregatMensuel aug = MoteurCalcul.aggregatFoyerMois(params, 2026, 8);
            assertThat(aug.revenus()).isCloseTo(11_230.0, within(0.01));
            assertThat(aug.charges()).isCloseTo(5_222.67, within(0.01));
        }

        @Test
        @DisplayName("Novembre : Revenus=17530 (13e salaire) / Réserves=4010 (3e pilier)")
        void novembre() {
            AggregatMensuel nov = MoteurCalcul.aggregatFoyerMois(params, 2026, 11);
            assertThat(nov.revenus()).isCloseTo(17_530.0, within(0.01));
            assertThat(nov.reserves()).isCloseTo(4_010.0, within(0.01));
            assertThat(nov.soldeDisponible()).isCloseTo(8_297.33, within(0.01));
        }

        @Test
        @DisplayName("Décembre : Revenus=11630 (prime décembre)")
        void decembre() {
            AggregatMensuel dec = MoteurCalcul.aggregatFoyerMois(params, 2026, 12);
            assertThat(dec.revenus()).isCloseTo(11_630.0, within(0.01));
        }

        @Test
        @DisplayName("Chaque mois : charges Jan-Jul < charges Août-Déc")
        void chargesAugmentation() {
            ProjectionAnnuelle proj = MoteurCalcul.projectionAnnuelle(params, 2026);
            for (int m = 1; m <= 7; m++) {
                assertThat(proj.mois().get(m - 1).charges()).isCloseTo(5_172.67, within(0.01));
            }
            for (int m = 8; m <= 12; m++) {
                assertThat(proj.mois().get(m - 1).charges()).isCloseTo(5_222.67, within(0.01));
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // §T3 — Trésorerie chaînée (mécanisme + vecteur Y0)
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("T3 — Trésorerie chaînée")
    class TresorerieChainee {

        @Test
        @DisplayName("Trésorerie initiale T0=0 : tresoDebut(2026)=0, tresoDebut(2027)=solde(2026)")
        void enchaînement() {
            ParametresScenario params = GoldenFixture.buildScenario2026(DYLAN, MELANIE);
            ProjectionPluriannuelle pp = MoteurCalcul.projectionPluriannuelle(params);

            var t0 = pp.tresorerie().get(0); // 2026
            assertThat(t0.tresorerieDebutAnnee()).isCloseTo(0.0, within(TOLERANCE));
            assertThat(t0.soldeAnnuel()).isCloseTo(69_508.0, within(0.01));
            assertThat(t0.tresorerieFinAnnee()).isCloseTo(69_508.0, within(0.01));

            var t1 = pp.tresorerie().get(1); // 2027
            assertThat(t1.tresorerieDebutAnnee())
                    .isCloseTo(t0.tresorerieFinAnnee(), within(TOLERANCE));
        }

        @Test
        @DisplayName("Formule générale : tresoDebut(Yi) = T0 + Σ soldes(Y0..Yi-1)")
        void formuleChainage() {
            // Scénario synthétique : solde fixe de 1000/an pour 5 ans
            List<PosteCalcul> postes = List.of(
                    mensuelToujours(REVENU, 1000),
                    mensuelToujours(CHARGE, 0)
            );
            // NB : solde = 1000×12/mois (reserves=0, charges=0) → 12000/an
            ParametresScenario params = new ParametresScenario(
                    "CHF", 2026, 0, 5, List.of(), Map.of(), postes, List.of()
            );
            ProjectionPluriannuelle pp = MoteurCalcul.projectionPluriannuelle(params);
            double soldeAttendu = 12_000.0;
            for (int i = 0; i < 5; i++) {
                var t = pp.tresorerie().get(i);
                assertThat(t.soldeAnnuel()).isCloseTo(soldeAttendu, within(TOLERANCE));
                assertThat(t.tresorerieDebutAnnee()).isCloseTo(i * soldeAttendu, within(TOLERANCE));
                assertThat(t.tresorerieFinAnnee()).isCloseTo((i + 1) * soldeAttendu, within(TOLERANCE));
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // §T4 — Répartition par membre (doc 01 §8-bis T4)
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("T4 — Répartition par membre")
    class RepartitionMembre {

        @Test
        @DisplayName("Dylan 0.58 : revenus(DYLAN, jan 2026) = 11000 × 0.58 = 6380")
        void dylanJanvier() {
            ParametresScenario params = GoldenFixture.buildScenario2026(DYLAN, MELANIE);
            AggregatMensuel dylan = MoteurCalcul.aggregatMembreMois(params, DYLAN, 2026, 1);
            assertThat(dylan.revenus()).isCloseTo(6_380.0, within(0.01));
        }

        @Test
        @DisplayName("Mélanie 0.42 : revenus(MELANIE, jan 2026) = 11000 × 0.42 = 4620")
        void melanieJanvier() {
            ParametresScenario params = GoldenFixture.buildScenario2026(DYLAN, MELANIE);
            AggregatMensuel melanie = MoteurCalcul.aggregatMembreMois(params, MELANIE, 2026, 1);
            assertThat(melanie.revenus()).isCloseTo(4_620.0, within(0.01));
        }

        @Test
        @DisplayName("partDylan + partMélanie = contribution FOYER pour chaque mois")
        void sommeMembresEgaleFoyer() {
            ParametresScenario params = GoldenFixture.buildScenario2026(DYLAN, MELANIE);
            for (int m = 1; m <= 12; m++) {
                AggregatMensuel foyer  = MoteurCalcul.aggregatFoyerMois(params, 2026, m);
                AggregatMensuel dylan  = MoteurCalcul.aggregatMembreMois(params, DYLAN, 2026, m);
                AggregatMensuel mel    = MoteurCalcul.aggregatMembreMois(params, MELANIE, 2026, m);
                assertThat(dylan.revenus() + mel.revenus())
                        .as("Somme membres revenus mois %d", m)
                        .isCloseTo(foyer.revenus(), within(TOLERANCE));
                assertThat(dylan.charges() + mel.charges())
                        .as("Somme membres charges mois %d", m)
                        .isCloseTo(foyer.charges(), within(TOLERANCE));
            }
        }

        @Test
        @DisplayName("Répartition invalide (somme ≠ 1) → RepartitionInvalideException")
        void repartitionInvalide() {
            List<RepartitionCalcul> rep = List.of(
                    new RepartitionCalcul(DYLAN, 0.58),
                    new RepartitionCalcul(MELANIE, 0.43) // somme = 1.01
            );
            assertThatThrownBy(() -> MoteurCalcul.validerRepartition(rep))
                    .isInstanceOf(RepartitionInvalideException.class);
        }

        @Test
        @DisplayName("Répartition valide (0.58 + 0.42 = 1) → pas d'exception")
        void repartitionValide() {
            List<RepartitionCalcul> rep = List.of(
                    new RepartitionCalcul(DYLAN, 0.58),
                    new RepartitionCalcul(MELANIE, 0.42)
            );
            assertThatCode(() -> MoteurCalcul.validerRepartition(rep)).doesNotThrowAnyException();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // §T5 — Cas limites (doc 01 §8-bis T5)
    // ─────────────────────────────────────────────────────────────────────────

    @Nested
    @DisplayName("T5 — Cas limites")
    class CasLimites {

        @Test
        @DisplayName("D=0 → traité comme mensuel (Dsafe=1), pas de division par zéro")
        void dZeroTraiteCommeMensuel() {
            PosteCalcul p = poste(REVENU, 1000, 0, null, null, MENSUALISE, DEBUT_PERIODE);
            assertThat(MoteurCalcul.contribution(p, 2026, 1)).isCloseTo(1000.0, within(TOLERANCE));
        }

        @Test
        @DisplayName("Sans date de début ni de fin → actif tous les mois")
        void sansDateToujorsActif() {
            PosteCalcul p = mensuelToujours(REVENU, 500);
            for (int m = 1; m <= 12; m++) {
                assertThat(MoteurCalcul.contribution(p, 2026, m)).isCloseTo(500.0, within(TOLERANCE));
            }
        }

        @Test
        @DisplayName("Fin en cours d'année → contributions nulles après fin")
        void finEnCoursAnnee() {
            PosteCalcul p = poste(CHARGE, 200, 1, null, LocalDate.of(2026, 6, 30), MENSUALISE, DEBUT_PERIODE);
            assertThat(MoteurCalcul.contribution(p, 2026, 6)).isCloseTo(200.0, within(TOLERANCE));
            assertThat(MoteurCalcul.contribution(p, 2026, 7)).isEqualTo(0.0);
        }

        @Test
        @DisplayName("PERIODIQUE ancre=mars, D=6 → tombe en mars et septembre")
        void periodiqueMarsD6() {
            PosteCalcul p = periodiqueDebut(CHARGE, 1200, 6, LocalDate.of(2026, 3, 1));
            // floorMod(3-3, 6) = 0 → mars
            assertThat(MoteurCalcul.contribution(p, 2026, 3)).isCloseTo(1200.0, within(TOLERANCE));
            // floorMod(4-3, 6) = 1 → nul
            assertThat(MoteurCalcul.contribution(p, 2026, 4)).isEqualTo(0.0);
            // floorMod(9-3, 6) = 0 → septembre
            assertThat(MoteurCalcul.contribution(p, 2026, 9)).isCloseTo(1200.0, within(TOLERANCE));
            // Autres mois : null
            for (int m : new int[]{1, 2, 5, 6, 7, 8, 10, 11, 12}) {
                assertThat(MoteurCalcul.contribution(p, 2026, m)).isEqualTo(0.0);
            }
        }

        @Test
        @DisplayName("Montant nul → contribution 0 (pas d'exception)")
        void montantNul() {
            PosteCalcul p = mensuelToujours(REVENU, 0);
            assertThatCode(() -> MoteurCalcul.contribution(p, 2026, 1)).doesNotThrowAnyException();
            assertThat(MoteurCalcul.contribution(p, 2026, 1)).isEqualTo(0.0);
        }

        @Test
        @DisplayName("Poste null → contribution 0 (pas d'exception)")
        void posteNull() {
            assertThat(MoteurCalcul.contribution(null, 2026, 1)).isEqualTo(0.0);
        }

        @Test
        @DisplayName("Modulo euclidien : mois-ancre négatif ne provoque pas de faux positif")
        void moduloNegatif() {
            // ancre=novembre (11), D=12 ; teste janvier (mois=1)
            // floorMod(1-11, 12) = floorMod(-10, 12) = 2 ≠ 0 → 0
            PosteCalcul p = periodiqueDebut(REVENU, 5000, 12, LocalDate.of(2026, 11, 1));
            assertThat(MoteurCalcul.contribution(p, 2026, 1)).isEqualTo(0.0);
            // floorMod(1-11, 12) avec Math.floorMod = 2 → aucun hit
            assertThat(MoteurCalcul.contribution(p, 2027, 1)).isEqualTo(0.0);
        }

        @Test
        @DisplayName("FIN_PERIODE D=12 ancre=jan : floorMod(mois-ancre+1, D) → tombe en décembre")
        void periodiqueFin() {
            // ancre=1 (janvier), D=12, FIN_PERIODE
            // floorMod(mois - 1 + 1, 12) = floorMod(mois, 12) = 0 quand mois=12
            PosteCalcul p = mkPerFin(REVENU, 1000, 12, LocalDate.of(2026, 1, 1));
            assertThat(MoteurCalcul.contribution(p, 2026, 12)).isCloseTo(1000.0, within(TOLERANCE));
            assertThat(MoteurCalcul.contribution(p, 2026, 1)).isEqualTo(0.0);
        }

        @Test
        @DisplayName("Multi-devises : taux 1.1 EUR→CHF → contribution convertie")
        void multiDevises() {
            PosteCalcul p = new PosteCalcul(UUID.randomUUID(), REVENU, 1000.0, "EUR", 1,
                    null, null, MENSUALISE, DEBUT_PERIODE, null, List.of(), List.of(), null, null);
            List<PosteCalcul> postes = List.of(p);
            ParametresScenario params = new ParametresScenario(
                    "CHF", 2026, 0, 1,
                    List.of(),
                    Map.of("EUR", 1.1),
                    postes, List.of()
            );
            AggregatMensuel ag = MoteurCalcul.aggregatFoyerMois(params, 2026, 1);
            assertThat(ag.revenus()).isCloseTo(1100.0, within(TOLERANCE));
        }

        @Test
        @DisplayName("Multi-devises : devise == deviseBase → facteur 1 (résultat identique)")
        void devisBaseFacteurUn() {
            PosteCalcul p = mensuelToujours(REVENU, 1000);
            ParametresScenario params = new ParametresScenario(
                    "CHF", 2026, 0, 1,
                    List.of(), Map.of("EUR", 1.1),
                    List.of(p), List.of()
            );
            AggregatMensuel ag = MoteurCalcul.aggregatFoyerMois(params, 2026, 1);
            assertThat(ag.revenus()).isCloseTo(1000.0, within(TOLERANCE));
        }
    }
}
