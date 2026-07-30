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

/**
 * Tests purs (test-first) de {@link MoteurCalcul#evenements(List, int)} — détecte
 * uniquement les <b>changements</b> (début, fin, révision), plus aucune échéance
 * récurrente (OCCURRENCE n'existe plus).
 */
class MoteurEvenementsTest {

    private static final double TOL = 1e-6;

    private static PosteCalcul poste(UUID id, TypePoste type, double montant, int periodiciteMois,
                                      LocalDate debut, LocalDate fin,
                                      ModeComptabilisation mode, MomentPeriode moment,
                                      UUID posteOrigineId, String description) {
        return new PosteCalcul(id, type, montant, "CHF", periodiciteMois, debut, fin, mode, moment,
                NaturePoste.EFFECTIF, null, List.of(), List.of(), null, posteOrigineId, description);
    }

    @Nested
    @DisplayName("DEBUT")
    class Debut {
        @Test
        void nouveauPosteSansOrigine() {
            UUID id = UUID.randomUUID();
            PosteCalcul p = poste(id, REVENU, 1000, 1, LocalDate.of(2026, 3, 1), null,
                    MENSUALISE, DEBUT_PERIODE, null, "Salaire");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            assertThat(evts).hasSize(1);
            EvenementCalcul e = evts.get(0);
            assertThat(e.mois()).isEqualTo(3);
            assertThat(e.type()).isEqualTo(TypeEvenement.DEBUT);
            assertThat(e.montant()).isCloseTo(1000.0, within(TOL));
            assertThat(e.periodiciteMois()).isEqualTo(1);
            assertThat(e.mode()).isEqualTo(MENSUALISE);
            assertThat(e.montantOrigine()).isNull();
            assertThat(e.periodiciteMoisOrigine()).isNull();
            assertThat(e.modeOrigine()).isNull();
        }

        @Test
        void chargeSigneNegatif() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 500, 1, LocalDate.of(2026, 6, 1), null,
                    MENSUALISE, DEBUT_PERIODE, null, "Loyer");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            assertThat(evts).hasSize(1);
            assertThat(evts.get(0).montant()).isCloseTo(-500.0, within(TOL));
        }

        @Test
        void debutHorsAnneeIgnore() {
            PosteCalcul p = poste(UUID.randomUUID(), REVENU, 1000, 1, LocalDate.of(2025, 3, 1), null,
                    MENSUALISE, DEBUT_PERIODE, null, "Salaire");
            assertThat(MoteurCalcul.evenements(List.of(p), 2026)).isEmpty();
        }

        @Test
        void posteTrimestrielMensualiseSansOrigineEmetToujoursLeDebut() {
            // Plus d'exception "lissé" : le montant affiché reste le montant PLEIN (brut),
            // c'est à la couche d'affichage de le mensualiser via periodiciteMois/mode.
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 300, 3, LocalDate.of(2026, 4, 1), null,
                    MENSUALISE, DEBUT_PERIODE, null, "Assurance lissée");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            assertThat(evts).hasSize(1);
            EvenementCalcul e = evts.get(0);
            assertThat(e.type()).isEqualTo(TypeEvenement.DEBUT);
            assertThat(e.mois()).isEqualTo(4);
            assertThat(e.montant()).isCloseTo(-300.0, within(TOL));
            assertThat(e.periodiciteMois()).isEqualTo(3);
            assertThat(e.mode()).isEqualTo(MENSUALISE);
        }

        @Test
        void posteTrimestrielPeriodiqueSansOrigineEmetLeDebut() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 300, 3, LocalDate.of(2026, 4, 1), null,
                    PERIODIQUE, DEBUT_PERIODE, null, "Assurance");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            assertThat(evts).hasSize(1);
            assertThat(evts.get(0).mode()).isEqualTo(PERIODIQUE);
            assertThat(evts.get(0).periodiciteMois()).isEqualTo(3);
            assertThat(evts.get(0).montant()).isCloseTo(-300.0, within(TOL));
        }

        @Test
        void posteTrimestrielMensualiseIssuDUneRevisionEmetLaRevision() {
            UUID origineId = UUID.randomUUID();
            PosteCalcul origine = poste(origineId, CHARGE, 300, 3, null, LocalDate.of(2026, 5, 31),
                    MENSUALISE, DEBUT_PERIODE, null, "Assurance lissée");
            PosteCalcul successeur = poste(UUID.randomUUID(), CHARGE, 340, 3,
                    LocalDate.of(2026, 6, 1), null, MENSUALISE, DEBUT_PERIODE, origineId, "Assurance lissée");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(origine, successeur), 2026);

            assertThat(evts).hasSize(1);
            EvenementCalcul e = evts.get(0);
            assertThat(e.type()).isEqualTo(TypeEvenement.REVISION);
            assertThat(e.mois()).isEqualTo(6);
            // Delta brut (non mensualisé) : signe(-1) * (340 - 300)
            assertThat(e.montant()).isCloseTo(-40.0, within(TOL));
            assertThat(e.periodiciteMois()).isEqualTo(3);
            assertThat(e.mode()).isEqualTo(MENSUALISE);
            // Valeurs du poste d'origine (pour affichage "avant → après")
            assertThat(e.montantOrigine()).isCloseTo(-300.0, within(TOL));
            assertThat(e.periodiciteMoisOrigine()).isEqualTo(3);
            assertThat(e.modeOrigine()).isEqualTo(MENSUALISE);
        }
    }

    @Nested
    @DisplayName("FIN")
    class Fin {
        @Test
        void finSansSuccesseurEstDecaleeAuMoisSuivant() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 300, 1, null, LocalDate.of(2026, 9, 30),
                    MENSUALISE, DEBUT_PERIODE, null, "Abonnement");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            assertThat(evts).hasSize(1);
            EvenementCalcul e = evts.get(0);
            // Fin le 30.09 -> événement le mois suivant (octobre), pas en septembre
            assertThat(e.mois()).isEqualTo(10);
            assertThat(e.type()).isEqualTo(TypeEvenement.FIN);
            assertThat(e.montant()).isCloseTo(300.0, within(TOL)); // soulagement = delta positif
            assertThat(e.montantOrigine()).isNull();
        }

        @Test
        void finAvecSuccesseurNEmetPasDEvenementFin() {
            UUID origineId = UUID.randomUUID();
            PosteCalcul origine = poste(origineId, CHARGE, 300, 1, null, LocalDate.of(2026, 6, 30),
                    MENSUALISE, DEBUT_PERIODE, null, "Loyer");
            PosteCalcul successeur = poste(UUID.randomUUID(), CHARGE, 350, 1,
                    LocalDate.of(2026, 7, 1), null, MENSUALISE, DEBUT_PERIODE, origineId, "Loyer");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(origine, successeur), 2026);

            assertThat(evts).hasSize(1);
            assertThat(evts.get(0).type()).isEqualTo(TypeEvenement.REVISION);
        }

        @Test
        void posteTrimestrielMensualiseSansSuccesseurEmetToujoursLaFin() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 300, 3, null, LocalDate.of(2026, 9, 30),
                    MENSUALISE, DEBUT_PERIODE, null, "Assurance lissée");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            assertThat(evts).hasSize(1);
            EvenementCalcul e = evts.get(0);
            assertThat(e.type()).isEqualTo(TypeEvenement.FIN);
            assertThat(e.mois()).isEqualTo(10);
            assertThat(e.montant()).isCloseTo(300.0, within(TOL));
        }

        @Test
        void finEnDecembreEstAbsenteDeLAnneeCouranteEtApparaitLAnneeSuivante() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 300, 1, null, LocalDate.of(2026, 12, 31),
                    MENSUALISE, DEBUT_PERIODE, null, "Abonnement");

            assertThat(MoteurCalcul.evenements(List.of(p), 2026)).isEmpty();

            List<EvenementCalcul> evts2027 = MoteurCalcul.evenements(List.of(p), 2027);
            assertThat(evts2027).hasSize(1);
            EvenementCalcul e = evts2027.get(0);
            assertThat(e.type()).isEqualTo(TypeEvenement.FIN);
            assertThat(e.mois()).isEqualTo(1);
        }
    }

    @Nested
    @DisplayName("REVISION")
    class Revision {
        @Test
        void augmentation() {
            UUID origineId = UUID.randomUUID();
            PosteCalcul origine = poste(origineId, CHARGE, 300, 1, null, LocalDate.of(2026, 6, 30),
                    MENSUALISE, DEBUT_PERIODE, null, "Loyer");
            PosteCalcul nouveau = poste(UUID.randomUUID(), CHARGE, 350, 1,
                    LocalDate.of(2026, 7, 1), null, MENSUALISE, DEBUT_PERIODE, origineId, "Loyer");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(origine, nouveau), 2026);

            assertThat(evts).hasSize(1);
            EvenementCalcul e = evts.get(0);
            assertThat(e.mois()).isEqualTo(7);
            assertThat(e.type()).isEqualTo(TypeEvenement.REVISION);
            // charge augmente de 50 -> impact négatif supplémentaire de 50
            assertThat(e.montant()).isCloseTo(-50.0, within(TOL));
            assertThat(e.montantOrigine()).isCloseTo(-300.0, within(TOL));
            assertThat(e.periodiciteMoisOrigine()).isEqualTo(1);
            assertThat(e.modeOrigine()).isEqualTo(MENSUALISE);
        }

        @Test
        void diminution() {
            UUID origineId = UUID.randomUUID();
            PosteCalcul origine = poste(origineId, REVENU, 1000, 1, null, LocalDate.of(2026, 3, 31),
                    MENSUALISE, DEBUT_PERIODE, null, "Salaire");
            PosteCalcul nouveau = poste(UUID.randomUUID(), REVENU, 800, 1,
                    LocalDate.of(2026, 4, 1), null, MENSUALISE, DEBUT_PERIODE, origineId, "Salaire");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(origine, nouveau), 2026);

            assertThat(evts).hasSize(1);
            EvenementCalcul e = evts.get(0);
            assertThat(e.mois()).isEqualTo(4);
            assertThat(e.type()).isEqualTo(TypeEvenement.REVISION);
            assertThat(e.montant()).isCloseTo(-200.0, within(TOL));
            assertThat(e.montantOrigine()).isCloseTo(1000.0, within(TOL));
            assertThat(e.periodiciteMoisOrigine()).isEqualTo(1);
            assertThat(e.modeOrigine()).isEqualTo(MENSUALISE);
        }

        @Test
        void chaineDeTroisMaillons() {
            UUID id1 = UUID.randomUUID();
            UUID id2 = UUID.randomUUID();
            PosteCalcul m1 = poste(id1, CHARGE, 300, 1, LocalDate.of(2026, 1, 1),
                    LocalDate.of(2026, 4, 30), MENSUALISE, DEBUT_PERIODE, null, "Loyer");
            PosteCalcul m2 = poste(id2, CHARGE, 320, 1, LocalDate.of(2026, 5, 1),
                    LocalDate.of(2026, 8, 31), MENSUALISE, DEBUT_PERIODE, id1, "Loyer");
            PosteCalcul m3 = poste(UUID.randomUUID(), CHARGE, 340, 1, LocalDate.of(2026, 9, 1),
                    null, MENSUALISE, DEBUT_PERIODE, id2, "Loyer");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(m1, m2, m3), 2026);

            // DEBUT pour m1 (pas d'origine) + REVISION pour m2 et m3 ; aucune FIN (chaque
            // maillon intermédiaire a un successeur)
            assertThat(evts).hasSize(3);
            assertThat(evts).extracting(EvenementCalcul::type)
                    .containsExactly(TypeEvenement.DEBUT, TypeEvenement.REVISION, TypeEvenement.REVISION);
            assertThat(evts).extracting(EvenementCalcul::montant)
                    .containsExactly(-300.0, -20.0, -20.0);
        }
    }

    @Nested
    @DisplayName("Postes périodiques — plus d'échéances intermédiaires")
    class PlusDEcheancesIntermediaires {
        @Test
        void posteTrimestrielPeriodiqueNeGenereQueSonDebut() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 300, 3, LocalDate.of(2025, 1, 1), null,
                    PERIODIQUE, DEBUT_PERIODE, null, "Assurance");

            // Début en 2025 : hors année évaluée -> plus aucune échéance visible en 2026
            // (l'ancien mécanisme OCCURRENCE aurait généré 4 événements ; il n'existe plus)
            assertThat(MoteurCalcul.evenements(List.of(p), 2026)).isEmpty();
        }

        @Test
        void posteAnnuelAvecDebutDansAnneeNEmetQueLeDebut() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 1200, 12, LocalDate.of(2026, 5, 1), null,
                    PERIODIQUE, DEBUT_PERIODE, null, "Assurance annuelle");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            assertThat(evts).hasSize(1);
            assertThat(evts.get(0).type()).isEqualTo(TypeEvenement.DEBUT);
            assertThat(evts.get(0).mois()).isEqualTo(5);
            assertThat(evts.get(0).montant()).isCloseTo(-1200.0, within(TOL));
            assertThat(evts.get(0).periodiciteMois()).isEqualTo(12);
        }

        @Test
        void oneShotNeGenereQueSonDebut() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 2000, 0, LocalDate.of(2026, 6, 15), null,
                    MENSUALISE, DEBUT_PERIODE, null, "Achat exceptionnel");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            assertThat(evts).hasSize(1);
            assertThat(evts.get(0).type()).isEqualTo(TypeEvenement.DEBUT);
            assertThat(evts.get(0).montant()).isCloseTo(-2000.0, within(TOL));
            assertThat(evts.get(0).periodiciteMois()).isEqualTo(0);
        }
    }

    @Nested
    @DisplayName("Aucun changement")
    class AucunChangement {
        @Test
        void posteActifTouteLAnneeSansDateSansPeriodiciteNeGenereRien() {
            PosteCalcul p = poste(UUID.randomUUID(), REVENU, 1000, 1, null, null,
                    MENSUALISE, DEBUT_PERIODE, null, "Salaire stable");
            assertThat(MoteurCalcul.evenements(List.of(p), 2026)).isEmpty();
        }
    }
}
