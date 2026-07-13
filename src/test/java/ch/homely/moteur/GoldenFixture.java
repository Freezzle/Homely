package ch.homely.moteur;

import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.MomentPeriode;
import ch.homely.poste.TypePoste;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static ch.homely.poste.ModeComptabilisation.*;
import static ch.homely.poste.MomentPeriode.*;
import static ch.homely.poste.TypePoste.*;

/**
 * Fixture de test reproduisant le jeu de données golden (foyer Charmillot, 2026, CHF).
 * Les postes sont reconstruits pour reproduire <em>exactement</em> les vecteurs T2 du doc 01 §8-bis.
 *
 * <h2>Postes REVENU</h2>
 * <ul>
 *   <li>Salaire Dylan : 6 300 CHF/mois, D=1, MENSUALISE (toujours actif)</li>
 *   <li>Salaire Mélanie base : 4 700 CHF/mois, D=1, fin=2026-07-31</li>
 *   <li>Salaire Mélanie aug+ : 4 930 CHF/mois, D=1, debut=2026-08-01</li>
 *   <li>13e salaire : 6 300, D=12, PERIODIQUE/DEBUT, ancre=novembre</li>
 *   <li>Allocation familiale : 500, D=12, PERIODIQUE/DEBUT, ancre=avril</li>
 *   <li>Prime décembre : 400, D=12, PERIODIQUE/DEBUT, ancre=décembre</li>
 * </ul>
 *
 * <h2>Postes CHARGE</h2>
 * Charges constantes Jan-Juil = 5 172,6667 CHF/mois ; +50 CHF/mois à partir d'août.
 *
 * <h2>Postes RESERVE</h2>
 * Épargne mensuelle 410 + 3e pilier 3 600 en novembre.
 */
public final class GoldenFixture {

    private GoldenFixture() {}

    public static ParametresScenario buildScenario2026(UUID dylan, UUID melanie) {

        List<RepartitionCalcul> repDef = List.of(
                new RepartitionCalcul(dylan, 0.58),
                new RepartitionCalcul(melanie, 0.42)
        );

        // Période unique ouverte (couvre toute la projection)
        List<RepartitionPeriodeCalcul> periodes = List.of(
                new RepartitionPeriodeCalcul(LocalDate.of(2020, 1, 1), null, repDef)
        );

        List<PosteCalcul> postes = List.of(
                // ── REVENUS ──────────────────────────────────────────────────
                p(REVENU, 6300, 1, null, null, MENSUALISE, DEBUT_PERIODE),
                p(REVENU, 4700, 1, null, d(2026, 7, 31), MENSUALISE, DEBUT_PERIODE),
                p(REVENU, 4930, 1, d(2026, 8, 1), null, MENSUALISE, DEBUT_PERIODE),
                p(REVENU, 6300, 12, d(2026, 11, 1), null, PERIODIQUE, DEBUT_PERIODE),
                p(REVENU, 500, 12, d(2026, 4, 1), null, PERIODIQUE, DEBUT_PERIODE),
                p(REVENU, 400, 12, d(2026, 12, 1), null, PERIODIQUE, DEBUT_PERIODE),

                // ── CHARGES ──────────────────────────────────────────────────
                // Base Jan-Juil = 5 172,6667/mois  (somme des postes ci-dessous)
                //   1 500 + 43 + 100                              = 1 643  (D=1)
                //   360/3 = 120                                   = 120    (D=3)
                //   (630+335+111+1 169)/12 = 185,4167             = 185,42 (D=12)
                //   (12 000+9 600+13 200+3 600+252+19)/12         = 3 222,58 (D=12)
                //   Subtotal = 5 172,6667
                // +50 CHF/mois à partir de août (frais supplémentaires D=1)
                p(CHARGE, 1500, 1, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 43, 1, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 100, 1, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 360, 3, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 630, 12, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 335, 12, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 111, 12, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 1169, 12, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 12000, 12, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 9600, 12, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 13200, 12, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 3600, 12, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 252, 12, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 19, 12, null, null, MENSUALISE, DEBUT_PERIODE),
                p(CHARGE, 50, 1, d(2026, 8, 1), null, MENSUALISE, DEBUT_PERIODE),

                // ── RÉSERVES ─────────────────────────────────────────────────
                p(RESERVE, 410, 1, null, null, MENSUALISE, DEBUT_PERIODE),
                p(RESERVE, 3600, 12, d(2026, 11, 1), null, PERIODIQUE, DEBUT_PERIODE)
        );

        return new ParametresScenario(
                "CHF", 2026, 0.0, 9,
                periodes, Map.of(), postes, List.of(dylan, melanie)
        );
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static PosteCalcul p(TypePoste type, double montant, int dMois,
                                  LocalDate debut, LocalDate fin,
                                  ModeComptabilisation mode, MomentPeriode moment) {
        return new PosteCalcul(UUID.randomUUID(), type, montant, "CHF", dMois,
                debut, fin, mode, moment, null, null, List.of(), List.of(), null);
    }

    private static LocalDate d(int y, int m, int d) {
        return LocalDate.of(y, m, d);
    }
}
