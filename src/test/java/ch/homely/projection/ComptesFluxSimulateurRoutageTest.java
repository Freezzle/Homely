package ch.homely.projection;

import ch.homely.compte.Compte;
import ch.homely.compte.CompteMembre;
import ch.homely.membre.Membre;
import ch.homely.moteur.ParametresScenario;
import ch.homely.moteur.PosteCalcul;
import ch.homely.moteur.RepartitionCalcul;
import ch.homely.moteur.RepartitionPeriodeCalcul;
import ch.homely.moteur.VentilationCalcul;
import ch.homely.poche.ArgentPocheService;
import ch.homely.poche.ResolutionArgentPoche;
import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.MomentPeriode;
import ch.homely.poste.NaturePoste;
import ch.homely.poste.TypePoste;
import ch.homely.poste.TypeRepartition;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Virements inter-comptes issus du <b>routage explicite</b> des postes (compte pivot +
 * contreparties), au niveau du simulateur — complète les vecteurs golden du moteur pur
 * ({@code MoteurCalculRoutageTest}) en vérifiant les paires réellement exposées au dashboard.
 */
class ComptesFluxSimulateurRoutageTest {

    static final UUID MEMBRE_1 = UUID.fromString("00000000-0000-0000-0000-000000000001");
    static final UUID MEMBRE_2 = UUID.fromString("00000000-0000-0000-0000-000000000002");

    private Compte compte1, compte2, compte3;
    private ArgentPocheService argentPoche;

    @BeforeEach
    void setUp() {
        compte1 = compte("Compte 1", MEMBRE_1);
        compte2 = compte("Compte 2", MEMBRE_2);
        compte3 = compte("Compte 3", MEMBRE_1);

        argentPoche = mock(ArgentPocheService.class);
        when(argentPoche.resoudre(any(), any(), any(), anyDouble()))
                .thenAnswer(inv -> ResolutionArgentPoche.aucune(inv.getArgument(3)));
    }

    @Test
    @DisplayName("A2 — charge sur le compte 1 : seule la part du membre 2 transite (compte 2 → compte 1)")
    void a2ChargeAlimenteeParLaContrepartie() {
        // Charge mensuelle de 100, pivot = compte 1, répartition 60/40.
        // Membre 1 route sur le compte 1 lui-même (l'argent y est déjà) → aucun virement.
        PosteCalcul charge = poste(TypePoste.CHARGE, 100, TypeRepartition.AUTO, List.of(),
                List.of(new VentilationCalcul(MEMBRE_1, compte1.getId(), 1.0),
                        new VentilationCalcul(MEMBRE_2, compte2.getId(), 1.0)),
                compte1.getId());

        List<ComptesFluxSimulateur.VirementPaire> paires = pairesDuMois(
                scenario(List.of(charge), List.of(MEMBRE_1, MEMBRE_2)),
                List.of(compte1, compte2));

        assertThat(paires).hasSize(1);
        assertThat(paires.getFirst().compteSourceId()).isEqualTo(compte2.getId());
        assertThat(paires.getFirst().compteDestinationId()).isEqualTo(compte1.getId());
        assertThat(paires.getFirst().montant()).isCloseTo(40.0, within(0.01));
    }

    @Test
    @DisplayName("A3 — revenu de 260 encaissé sur le compte 1 : 156 vers le compte 2, 104 vers le compte 3")
    void a3RevenuRedistribueAuProrata() {
        PosteCalcul allocations = poste(TypePoste.REVENU, 260,
                TypeRepartition.CUSTOM, List.of(new RepartitionCalcul(MEMBRE_1, 1.0)),
                List.of(new VentilationCalcul(MEMBRE_1, compte2.getId(), 0.6),
                        new VentilationCalcul(MEMBRE_1, compte3.getId(), 0.4)),
                compte1.getId());

        List<ComptesFluxSimulateur.VirementPaire> paires = pairesDuMois(
                scenario(List.of(allocations), List.of(MEMBRE_1)),
                List.of(compte1, compte2, compte3));

        assertThat(paires).hasSize(2);
        assertThat(paires).allSatisfy(p ->
                assertThat(p.compteSourceId()).isEqualTo(compte1.getId()));
        assertThat(montantVers(paires, compte2)).isCloseTo(156.0, within(0.01));
        assertThat(montantVers(paires, compte3)).isCloseTo(104.0, within(0.01));
    }

    @Test
    @DisplayName("Le routage du poste prime sur le compte primaire du membre")
    void leRoutagePrimeSurLeComptePrimaire() {
        // Membre 1 a le compte 3 comme primaire, mais le poste route explicitement
        // depuis le compte 2 : c'est le routage qui doit être retenu.
        PosteCalcul charge = poste(TypePoste.CHARGE, 100,
                TypeRepartition.CUSTOM, List.of(new RepartitionCalcul(MEMBRE_1, 1.0)),
                List.of(new VentilationCalcul(MEMBRE_1, compte2.getId(), 1.0)),
                compte1.getId());

        Map<UUID, UUID> primaires = new HashMap<>();
        primaires.put(MEMBRE_1, compte3.getId());

        Map<YearMonth, ComptesFluxSimulateur.PairesMois> parMois =
                ComptesFluxSimulateur.simulerPaires(
                        scenario(List.of(charge), List.of(MEMBRE_1)),
                        List.of(compte1, compte2, compte3), primaires,
                        2026, 1, argentPoche, UUID.randomUUID());

        List<ComptesFluxSimulateur.VirementPaire> paires = parMois.get(YearMonth.of(2026, 1)).paires();
        assertThat(paires).hasSize(1);
        assertThat(paires.getFirst().compteSourceId()).isEqualTo(compte2.getId());
        assertThat(paires.getFirst().compteDestinationId()).isEqualTo(compte1.getId());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private List<ComptesFluxSimulateur.VirementPaire> pairesDuMois(
            ParametresScenario params, List<Compte> comptes) {
        return ComptesFluxSimulateur.simulerPaires(
                        params, comptes, Map.of(), 2026, 1, argentPoche, UUID.randomUUID())
                .get(YearMonth.of(2026, 1)).paires();
    }

    private double montantVers(List<ComptesFluxSimulateur.VirementPaire> paires, Compte destination) {
        return paires.stream()
                .filter(p -> p.compteDestinationId().equals(destination.getId()))
                .mapToDouble(ComptesFluxSimulateur.VirementPaire::montant)
                .sum();
    }

    private static PosteCalcul poste(TypePoste type, double montant, TypeRepartition typeRepartition,
                                     List<RepartitionCalcul> repartitions,
                                     List<VentilationCalcul> ventilations, UUID comptePivotId) {
        return new PosteCalcul(UUID.randomUUID(), type, montant, "CHF", 1,
                LocalDate.of(2026, 1, 1), null, ModeComptabilisation.MENSUALISE,
                MomentPeriode.DEBUT_PERIODE, NaturePoste.EFFECTIF, typeRepartition,
                repartitions, ventilations, null, null, null, true, comptePivotId);
    }

    private static ParametresScenario scenario(List<PosteCalcul> postes, List<UUID> membres) {
        List<RepartitionCalcul> repDef = membres.size() == 2
                ? List.of(new RepartitionCalcul(MEMBRE_1, 0.6), new RepartitionCalcul(MEMBRE_2, 0.4))
                : List.of(new RepartitionCalcul(MEMBRE_1, 1.0));
        List<RepartitionPeriodeCalcul> periodes = List.of(
                new RepartitionPeriodeCalcul(LocalDate.of(2020, 1, 1), null, repDef));
        return new ParametresScenario("CHF", 2026, 0.0, 1, periodes, Map.of(), postes, membres);
    }

    private static Compte compte(String libelle, UUID membreId) {
        Compte c = new Compte();
        c.setId(UUID.randomUUID());
        c.setLibelle(libelle);
        // Solde initial confortable : évite tout comblement "topUp" parasite, pour n'observer
        // que les virements induits par le routage.
        c.setSoldeInitial(BigDecimal.valueOf(100_000));
        Membre m = new Membre();
        m.setId(membreId);
        c.getCompteMembres().add(new CompteMembre(c, m));
        return c;
    }
}
