package ch.homely.poste;

import ch.homely.poste.MatriceBudgetaireService.PosteEntree;
import ch.homely.poste.dto.PostePositionneDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires purs (aucune dépendance Spring/BDD) de {@link MatriceBudgetaireService},
 * miroir de {@code matrice-budgetaire.utils.spec.ts} côté frontend — mêmes formules,
 * mêmes vecteurs de test (jeu de données {@code POSTES_EXEMPLE} de la spec métier), pour
 * garantir que le calcul serveur (désormais la seule source de vérité) reste cohérent.
 */
class MatriceBudgetaireServiceTest {

    /** Jeu de données de la spec métier (id lisible -> nécessité/optimisable/montant mensuel). */
    private static PosteEntree poste(String nom, TypePoste type, double montantMensuel, int necessite, int optimisable) {
        return new PosteEntree(UUID.nameUUIDFromBytes(nom.getBytes()), nom, type,
                BigDecimal.valueOf(montantMensuel), BigDecimal.valueOf(montantMensuel * 12), necessite, optimisable);
    }

    private static List<PosteEntree> posteExemple() {
        return List.of(
                poste("Loyer", TypePoste.CHARGE, 1450, 5, 1),
                poste("Assurance maladie", TypePoste.CHARGE, 380, 5, 2),
                poste("Electricite", TypePoste.CHARGE, 95, 4, 3),
                poste("Internet", TypePoste.CHARGE, 65, 4, 3),
                poste("Abonnement mobile", TypePoste.CHARGE, 45, 4, 3),
                poste("Netflix", TypePoste.CHARGE, 18, 2, 5),
                poste("Spotify", TypePoste.CHARGE, 13, 2, 5),
                poste("Salle de sport", TypePoste.CHARGE, 79, 3, 4),
                poste("Courses alimentaires", TypePoste.CHARGE, 550, 5, 3),
                poste("Restaurants", TypePoste.CHARGE, 220, 2, 5),
                poste("Fonds urgence", TypePoste.RESERVE, 300, 5, 2),
                poste("3e pilier", TypePoste.RESERVE, 588, 5, 1),
                poste("Vacances", TypePoste.RESERVE, 200, 3, 4),
                poste("Renovation", TypePoste.RESERVE, 100, 2, 5));
    }

    private static Map<String, PostePositionneDto> parNom(List<PostePositionneDto> resultat) {
        return resultat.stream().collect(java.util.stream.Collectors.toMap(PostePositionneDto::nom, Function.identity()));
    }

    @Test
    @DisplayName("Liste vide -> résultat vide")
    void listeVide() {
        assertThat(MatriceBudgetaireService.positionnerEntrees(List.of())).isEmpty();
    }

    @Test
    @DisplayName("Les scores sont toujours dans [0, 100] et le poidsMontant dans [0, 1]")
    void scoresDansLIntervalle() {
        List<PostePositionneDto> resultat = MatriceBudgetaireService.positionnerEntrees(posteExemple());
        assertThat(resultat).hasSize(14);
        for (PostePositionneDto p : resultat) {
            assertThat(p.prioriteScore()).isBetween(BigDecimal.ZERO, BigDecimal.valueOf(100));
            assertThat(p.necessiteScore()).isBetween(BigDecimal.ZERO, BigDecimal.valueOf(100));
            assertThat(p.poidsMontant()).isBetween(BigDecimal.ZERO, BigDecimal.ONE);
        }
    }

    @Test
    @DisplayName("Le montant annualisé est bien mensuel x 12")
    void montantAnnuelEstMensuelFoisDouze() {
        List<PostePositionneDto> resultat = MatriceBudgetaireService.positionnerEntrees(posteExemple());
        PostePositionneDto loyer = parNom(resultat).get("Loyer");
        assertThat(loyer.montantAnnuel()).isEqualByComparingTo(BigDecimal.valueOf(1450 * 12).setScale(2));
    }

    @Test
    @DisplayName("Répartition par quadrant conforme aux vecteurs golden vérifiés (matrice-budgetaire.utils.spec.ts)")
    void repartitionParQuadrant() {
        Map<String, PostePositionneDto> parNom = parNom(MatriceBudgetaireService.positionnerEntrees(posteExemple()));

        assertThat(parNom.get("Loyer").quadrant()).isEqualTo("rigides");
        assertThat(parNom.get("Assurance maladie").quadrant()).isEqualTo("rigides");
        assertThat(parNom.get("Electricite").quadrant()).isEqualTo("rigides");
        assertThat(parNom.get("Internet").quadrant()).isEqualTo("rigides");
        assertThat(parNom.get("Fonds urgence").quadrant()).isEqualTo("rigides");
        assertThat(parNom.get("3e pilier").quadrant()).isEqualTo("rigides");

        assertThat(parNom.get("Abonnement mobile").quadrant()).isEqualTo("bruit");
        assertThat(parNom.get("Netflix").quadrant()).isEqualTo("couper");
        assertThat(parNom.get("Spotify").quadrant()).isEqualTo("couper");
        assertThat(parNom.get("Salle de sport").quadrant()).isEqualTo("couper");
        assertThat(parNom.get("Restaurants").quadrant()).isEqualTo("couper");
        assertThat(parNom.get("Vacances").quadrant()).isEqualTo("couper");
        assertThat(parNom.get("Renovation").quadrant()).isEqualTo("couper");

        assertThat(parNom.get("Courses alimentaires").quadrant()).isEqualTo("negocier");
    }

    @Test
    @DisplayName("classifierQuadrant : les 4 combinaisons de seuils sont correctement mappées")
    void classifierQuadrantSeuils() {
        assertThat(MatriceBudgetaireService.classifierQuadrant(60, 40)).isEqualTo("rigides");
        assertThat(MatriceBudgetaireService.classifierQuadrant(60, 60)).isEqualTo("negocier");
        assertThat(MatriceBudgetaireService.classifierQuadrant(40, 40)).isEqualTo("bruit");
        assertThat(MatriceBudgetaireService.classifierQuadrant(40, 60)).isEqualTo("couper");
    }

    @Test
    @DisplayName("À nécessité saisie égale, un montant supérieur fait remonter le score de nécessité affiché")
    void montantInflueSurLeScoreANecessiteEgale() {
        PosteEntree petit = new PosteEntree(UUID.nameUUIDFromBytes("Petit montant".getBytes()), "Petit montant",
                TypePoste.CHARGE, BigDecimal.valueOf(10), BigDecimal.valueOf(120), 3, 3);
        PosteEntree gros = new PosteEntree(UUID.nameUUIDFromBytes("Gros montant".getBytes()), "Gros montant",
                TypePoste.CHARGE, BigDecimal.valueOf(2000), BigDecimal.valueOf(24000), 3, 3);
        Map<String, PostePositionneDto> parNom = parNom(MatriceBudgetaireService.positionnerEntrees(List.of(petit, gros)));

        // Même nécessité saisie (3/5) pour les deux, mais "Gros montant" pèse 200x plus :
        // son score de nécessité affiché doit dépasser celui de "Petit montant".
        assertThat(parNom.get("Gros montant").necessiteScore())
                .isGreaterThan(parNom.get("Petit montant").necessiteScore());
    }
}
