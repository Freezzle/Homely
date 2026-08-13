package ch.homely.poste;

import ch.homely.poste.BesoinsPlaisirsService.PosteEntree;
import ch.homely.poste.dto.BesoinsPlaisirsDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires purs (aucune dépendance Spring/BDD) de {@link BesoinsPlaisirsService},
 * qui vérifient le bucketing "Besoins" (nécessité 4-5) vs "Plaisirs" (nécessité 1-3)
 * utilisé par l'indicateur dashboard "Plaisirs vs Besoins".
 */
class BesoinsPlaisirsServiceTest {

    private static PosteEntree poste(String description, int necessite, double montant) {
        return new PosteEntree(UUID.randomUUID(), description, necessite, montant);
    }

    @Test
    @DisplayName("Liste vide -> montants à zéro")
    void listeVide() {
        BesoinsPlaisirsDto resultat = BesoinsPlaisirsService.bucketer(List.of());

        assertThat(resultat.montantBesoins()).isEqualByComparingTo(BigDecimal.ZERO.setScale(2));
        assertThat(resultat.montantPlaisirs()).isEqualByComparingTo(BigDecimal.ZERO.setScale(2));
        assertThat(resultat.postesBesoins()).isEmpty();
    }

    @Test
    @DisplayName("Nécessité 1 à 3 -> Plaisirs")
    void necessiteBasseEstPlaisir() {
        BesoinsPlaisirsDto resultat = BesoinsPlaisirsService.bucketer(List.of(
                poste("Netflix", 1, 18.0), poste("Spotify", 2, 13.0), poste("Salle de sport", 3, 79.0)));

        assertThat(resultat.montantPlaisirs()).isEqualByComparingTo(BigDecimal.valueOf(110.0).setScale(2));
        assertThat(resultat.montantBesoins()).isEqualByComparingTo(BigDecimal.ZERO.setScale(2));
        assertThat(resultat.postesBesoins()).isEmpty();
    }

    @Test
    @DisplayName("Nécessité 4 à 5 -> Besoins")
    void necessiteHauteEstBesoin() {
        BesoinsPlaisirsDto resultat = BesoinsPlaisirsService.bucketer(List.of(
                poste("Electricite", 4, 95.0), poste("Loyer", 5, 1450.0)));

        assertThat(resultat.montantBesoins()).isEqualByComparingTo(BigDecimal.valueOf(1545.0).setScale(2));
        assertThat(resultat.montantPlaisirs()).isEqualByComparingTo(BigDecimal.ZERO.setScale(2));
        assertThat(resultat.postesBesoins()).extracting("description").containsExactly("Loyer", "Electricite");
    }

    @Test
    @DisplayName("Mélange de nécessités -> répartition correcte des montants sommés")
    void melangeDeNecessites() {
        BesoinsPlaisirsDto resultat = BesoinsPlaisirsService.bucketer(List.of(
                poste("Loyer", 5, 1450.0),           // Besoin
                poste("Electricite", 4, 95.0),       // Besoin
                poste("Netflix", 2, 18.0),           // Plaisir
                poste("Restaurants", 2, 220.0),      // Plaisir
                poste("Salle de sport", 3, 79.0)));  // Plaisir

        assertThat(resultat.montantBesoins()).isEqualByComparingTo(BigDecimal.valueOf(1545.0).setScale(2));
        assertThat(resultat.montantPlaisirs()).isEqualByComparingTo(BigDecimal.valueOf(317.0).setScale(2));
    }

    @Test
    @DisplayName("Montants arrondis au centime (HALF_UP)")
    void arrondiAuCentime() {
        BesoinsPlaisirsDto resultat = BesoinsPlaisirsService.bucketer(List.of(
                poste("A", 1, 10.005), poste("B", 1, 10.005)));

        assertThat(resultat.montantPlaisirs()).isEqualByComparingTo(BigDecimal.valueOf(20.01));
    }

    @Test
    @DisplayName("Les postes Besoins sont triés par montant décroissant")
    void postesBesoinsTriesParMontantDecroissant() {
        BesoinsPlaisirsDto resultat = BesoinsPlaisirsService.bucketer(List.of(
                poste("Assurance maladie", 5, 380.0),
                poste("Loyer", 5, 1450.0),
                poste("Electricite", 4, 95.0)));

        assertThat(resultat.postesBesoins()).extracting("description")
                .containsExactly("Loyer", "Assurance maladie", "Electricite");
        assertThat(resultat.postesBesoins()).extracting("montant")
                .containsExactly(BigDecimal.valueOf(1450.0).setScale(2), BigDecimal.valueOf(380.0).setScale(2),
                        BigDecimal.valueOf(95.0).setScale(2));
        assertThat(resultat.postesBesoins()).extracting("necessite").containsExactly(5, 5, 4);
    }

    @Test
    @DisplayName("Un poste Besoin à montant nul (ex. quote-part membre nulle) est exclu de la liste, sans impact sur les totaux")
    void posteBesoinMontantNulExcluDeLaListe() {
        BesoinsPlaisirsDto resultat = BesoinsPlaisirsService.bucketer(List.of(
                poste("Loyer", 5, 1450.0),
                poste("Assurance maladie du conjoint", 5, 0.0)));

        assertThat(resultat.postesBesoins()).extracting("description").containsExactly("Loyer");
        assertThat(resultat.montantBesoins()).isEqualByComparingTo(BigDecimal.valueOf(1450.0).setScale(2));
    }
}
