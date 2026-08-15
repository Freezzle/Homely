package ch.homely.moteur;

import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.MomentPeriode;
import ch.homely.poste.NaturePoste;
import ch.homely.poste.TypePoste;
import ch.homely.poste.TypeRepartition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static ch.homely.poste.ModeComptabilisation.*;
import static ch.homely.poste.MomentPeriode.*;
import static ch.homely.poste.TypePoste.*;
import static org.assertj.core.api.Assertions.*;

/**
 * Tests pour {@link MoteurCalcul#posteContributionsCompteMembre} — détail poste par
 * poste alimentant la liste affichée lorsqu'un compte est sélectionné dans la vue
 * "Virements des comptes" du dashboard. Réutilise les mêmes briques que
 * {@link MoteurCalcul#ventilationsCompteMembreDetail} (déjà golden-testé) — ces tests
 * vérifient uniquement la désagrégation par poste et le filtrage par compte.
 */
class MoteurCalculPosteContributionsCompteMembreTest {

    static final UUID DYLAN   = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID MELANIE = UUID.fromString("00000000-0000-0000-0000-000000000002");
    static final UUID COMPTE_COMMUN = UUID.fromString("00000000-0000-0000-0000-0000000000c1");
    static final UUID COMPTE_DYLAN  = UUID.fromString("00000000-0000-0000-0000-0000000000c2");

    static final double TOLERANCE = 1e-6;

    private static PosteCalcul poste(TypePoste type, double montant, int dMois,
                                      LocalDate debut, LocalDate fin,
                                      ModeComptabilisation mode, MomentPeriode moment,
                                      TypeRepartition typeRepartition, List<RepartitionCalcul> repartitions,
                                      List<VentilationCalcul> ventilations, String description) {
        return new PosteCalcul(UUID.randomUUID(), type, montant, "CHF", dMois,
                debut, fin, mode, moment, NaturePoste.EFFECTIF, typeRepartition,
                repartitions, ventilations, null, null, description);
    }

    private static ParametresScenario scenario(List<PosteCalcul> postes) {
        List<RepartitionCalcul> repDef = List.of(
                new RepartitionCalcul(DYLAN, 0.6),
                new RepartitionCalcul(MELANIE, 0.4)
        );
        List<RepartitionPeriodeCalcul> periodes = List.of(
                new RepartitionPeriodeCalcul(LocalDate.of(2020, 1, 1), null, repDef)
        );
        return new ParametresScenario("CHF", 2026, 0.0, 1, periodes, java.util.Map.of(), postes, List.of(DYLAN, MELANIE));
    }

    @Test
    @DisplayName("Poste ventilé seul pour un membre (quote-part CUSTOM 1.0) : montant et quote-part exacts")
    void posteSeulPourUnMembre() {
        PosteCalcul revenu = poste(REVENU, 1000, 1, null, null, MENSUALISE, DEBUT_PERIODE,
                TypeRepartition.CUSTOM, List.of(new RepartitionCalcul(DYLAN, 1.0)),
                List.of(new VentilationCalcul(DYLAN, COMPTE_DYLAN)), "Salaire Dylan");
        ParametresScenario params = scenario(List.of(revenu));

        List<PosteContributionDetail> details =
                MoteurCalcul.posteContributionsCompteMembre(params, COMPTE_DYLAN, DYLAN, 2026, 3);

        assertThat(details).hasSize(1);
        PosteContributionDetail d = details.get(0);
        assertThat(d.posteId()).isEqualTo(revenu.id());
        assertThat(d.libelle()).isEqualTo("Salaire Dylan");
        assertThat(d.type()).isEqualTo(REVENU);
        assertThat(d.montant()).isCloseTo(1000.0, within(TOLERANCE));
        assertThat(d.quotePart()).isCloseTo(1.0, within(TOLERANCE));
    }

    @Test
    @DisplayName("Compte joint : quote-part effective (AUTO) répartie 60/40 correctement par membre")
    void compteJointProrata() {
        PosteCalcul charge = poste(CHARGE, 1000, 1, null, null, MENSUALISE, DEBUT_PERIODE,
                TypeRepartition.AUTO, List.of(),
                List.of(new VentilationCalcul(DYLAN, COMPTE_COMMUN), new VentilationCalcul(MELANIE, COMPTE_COMMUN)),
                "Loyer");
        ParametresScenario params = scenario(List.of(charge));

        List<PosteContributionDetail> detailsDylan =
                MoteurCalcul.posteContributionsCompteMembre(params, COMPTE_COMMUN, DYLAN, 2026, 3);
        assertThat(detailsDylan).hasSize(1);
        assertThat(detailsDylan.get(0).montant()).isCloseTo(600.0, within(TOLERANCE));
        assertThat(detailsDylan.get(0).quotePart()).isCloseTo(0.6, within(TOLERANCE));

        List<PosteContributionDetail> detailsMelanie =
                MoteurCalcul.posteContributionsCompteMembre(params, COMPTE_COMMUN, MELANIE, 2026, 3);
        assertThat(detailsMelanie).hasSize(1);
        assertThat(detailsMelanie.get(0).montant()).isCloseTo(400.0, within(TOLERANCE));
        assertThat(detailsMelanie.get(0).quotePart()).isCloseTo(0.4, within(TOLERANCE));
    }

    @Test
    @DisplayName("Poste non ventilé sur le compte demandé pour ce membre : absent du détail")
    void posteNonVentileSurLeCompteDemande() {
        PosteCalcul charge = poste(CHARGE, 400, 1, null, null, MENSUALISE, DEBUT_PERIODE,
                TypeRepartition.AUTO, List.of(),
                List.of(new VentilationCalcul(DYLAN, COMPTE_DYLAN)), "Charge Dylan seul"); // Mélanie non ventilée
        ParametresScenario params = scenario(List.of(charge));

        assertThat(MoteurCalcul.posteContributionsCompteMembre(params, COMPTE_DYLAN, MELANIE, 2026, 1)).isEmpty();
        assertThat(MoteurCalcul.posteContributionsCompteMembre(params, COMPTE_COMMUN, DYLAN, 2026, 1)).isEmpty();
    }

    @Test
    @DisplayName("Charge MENSUALISE annuelle (D=12) : présente uniquement sur le mois d'ancrage (montant plein échu)")
    void chargeAnnuelleUniquementSurMoisAncrage() {
        PosteCalcul charge = poste(CHARGE, 1200, 12, LocalDate.of(2026, 1, 1), null,
                MENSUALISE, DEBUT_PERIODE, TypeRepartition.CUSTOM, List.of(new RepartitionCalcul(DYLAN, 1.0)),
                List.of(new VentilationCalcul(DYLAN, COMPTE_DYLAN)), "3e pilier");
        ParametresScenario params = scenario(List.of(charge));

        List<PosteContributionDetail> janvier =
                MoteurCalcul.posteContributionsCompteMembre(params, COMPTE_DYLAN, DYLAN, 2026, 1);
        assertThat(janvier).hasSize(1);
        assertThat(janvier.get(0).montant()).isCloseTo(1200.0, within(TOLERANCE));

        List<PosteContributionDetail> fevrier =
                MoteurCalcul.posteContributionsCompteMembre(params, COMPTE_DYLAN, DYLAN, 2026, 2);
        assertThat(fevrier).isEmpty();
    }
}
