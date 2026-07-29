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
 * Tests purs (test-first) de {@link MoteurCalcul#evenements(List, int)} — voir le plan
 * "Liste d'événements budgétaires" : détection de début/fin/révision/occurrence de poste.
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
            assertThat(e.montantMensualiseDelta()).isCloseTo(1000.0, within(TOL));
            assertThat(e.montantEcheance()).isCloseTo(1000.0, within(TOL));
        }

        @Test
        void chargeSigneNegatif() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 500, 1, LocalDate.of(2026, 6, 1), null,
                    MENSUALISE, DEBUT_PERIODE, null, "Loyer");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            assertThat(evts).hasSize(1);
            assertThat(evts.get(0).montantMensualiseDelta()).isCloseTo(-500.0, within(TOL));
            assertThat(evts.get(0).montantEcheance()).isCloseTo(-500.0, within(TOL));
        }

        @Test
        void debutHorsAnneeIgnore() {
            PosteCalcul p = poste(UUID.randomUUID(), REVENU, 1000, 1, LocalDate.of(2025, 3, 1), null,
                    MENSUALISE, DEBUT_PERIODE, null, "Salaire");
            assertThat(MoteurCalcul.evenements(List.of(p), 2026)).isEmpty();
        }

        @Test
        void posteTrimestrielMensualiseSansOrigineNEmetPasDeDebut() {
            // Périodique + lissé + pas de mutation : aucun DEBUT (impact déjà lissé, non perçu)
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 300, 3, LocalDate.of(2026, 4, 1), null,
                    MENSUALISE, DEBUT_PERIODE, null, "Assurance lissée");
            assertThat(MoteurCalcul.evenements(List.of(p), 2026)).isEmpty();
        }

        @Test
        void posteTrimestrielMensualiseIssuDUneRevisionEmetTOujoursLeDebut() {
            // Périodique + lissé mais issu d'une mutation (posteOrigineId) : REVISION reste émis
            UUID origineId = UUID.randomUUID();
            PosteCalcul origine = poste(origineId, CHARGE, 300, 3, null, LocalDate.of(2026, 5, 31),
                    MENSUALISE, DEBUT_PERIODE, null, "Assurance lissée");
            PosteCalcul successeur = poste(UUID.randomUUID(), CHARGE, 340, 3,
                    LocalDate.of(2026, 6, 1), null, MENSUALISE, DEBUT_PERIODE, origineId, "Assurance lissée");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(origine, successeur), 2026);

            assertThat(evts).hasSize(1);
            assertThat(evts.get(0).type()).isEqualTo(TypeEvenement.REVISION);
            assertThat(evts.get(0).mois()).isEqualTo(6);
        }
    }

    @Nested
    @DisplayName("FIN")
    class Fin {
        @Test
        void finSansSuccesseur() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 300, 1, null, LocalDate.of(2026, 9, 30),
                    MENSUALISE, DEBUT_PERIODE, null, "Abonnement");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            assertThat(evts).hasSize(1);
            EvenementCalcul e = evts.get(0);
            assertThat(e.mois()).isEqualTo(9);
            assertThat(e.type()).isEqualTo(TypeEvenement.FIN);
            assertThat(e.montantMensualiseDelta()).isCloseTo(300.0, within(TOL)); // perte de charge = delta positif (soulagement)
            assertThat(e.montantEcheance()).isCloseTo(300.0, within(TOL));
        }

        @Test
        void finAvecSuccesseurNEmetPasDEvenement() {
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
        void posteTrimestrielMensualiseSansSuccesseurNEmetPasDeFin() {
            // Périodique + lissé qui se termine sans mutation : aucune FIN (impact déjà lissé)
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 300, 3, null, LocalDate.of(2026, 9, 30),
                    MENSUALISE, DEBUT_PERIODE, null, "Assurance lissée");
            assertThat(MoteurCalcul.evenements(List.of(p), 2026)).isEmpty();
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
            assertThat(e.montantMensualiseDelta()).isCloseTo(-50.0, within(TOL));
            assertThat(e.montantEcheance()).isCloseTo(-50.0, within(TOL));
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
            assertThat(e.montantMensualiseDelta()).isCloseTo(-200.0, within(TOL));
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

            // DEBUT pour m1 (pas d'origine) + REVISION pour m2 et m3 ; aucune FIN
            assertThat(evts).hasSize(3);
            assertThat(evts).extracting(EvenementCalcul::type)
                    .containsExactly(TypeEvenement.DEBUT, TypeEvenement.REVISION, TypeEvenement.REVISION);
        }
    }

    @Nested
    @DisplayName("OCCURRENCE")
    class Occurrence {
        @Test
        void posteTrimestrielPeriodiqueHorsMoisAncrage() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 300, 3, LocalDate.of(2025, 1, 1), null,
                    PERIODIQUE, DEBUT_PERIODE, null, "Assurance");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            // ancre = janvier -> échéances en janvier, avril, juillet, octobre
            assertThat(evts).extracting(EvenementCalcul::mois).containsExactly(1, 4, 7, 10);
            assertThat(evts).allMatch(e -> e.type() == TypeEvenement.OCCURRENCE);
            assertThat(evts.get(0).montantEcheance()).isCloseTo(-300.0, within(TOL));
            assertThat(evts.get(0).montantMensualiseDelta()).isCloseTo(0.0, within(TOL));
        }

        @Test
        void posteTrimestrielMensualiseNeGenerePasDOccurrence() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 300, 3, LocalDate.of(2025, 1, 1), null,
                    MENSUALISE, DEBUT_PERIODE, null, "Assurance lissée");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            // Poste lissé (MENSUALISE) : aucune alerte d'échéance, même périodique
            assertThat(evts).isEmpty();
        }

        @Test
        void posteAnnuelAvecDebutDansAnneeExclutOccurrenceDuMoisDeDebut() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 1200, 12, LocalDate.of(2026, 5, 1), null,
                    PERIODIQUE, DEBUT_PERIODE, null, "Assurance annuelle");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            // Un seul événement : le DEBUT en mai (pas de doublon OCCURRENCE le même mois)
            assertThat(evts).hasSize(1);
            assertThat(evts.get(0).type()).isEqualTo(TypeEvenement.DEBUT);
            assertThat(evts.get(0).mois()).isEqualTo(5);
        }

        @Test
        void oneShotNeGenerePasDOccurrence() {
            PosteCalcul p = poste(UUID.randomUUID(), CHARGE, 2000, 0, LocalDate.of(2026, 6, 15), null,
                    MENSUALISE, DEBUT_PERIODE, null, "Achat exceptionnel");

            List<EvenementCalcul> evts = MoteurCalcul.evenements(List.of(p), 2026);

            assertThat(evts).hasSize(1);
            assertThat(evts.get(0).type()).isEqualTo(TypeEvenement.DEBUT);
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
