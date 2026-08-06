package ch.homely.poste;

import ch.homely.poste.MatriceBudgetaireService.PosteEntree;
import ch.homely.poste.dto.PostePositionneDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests unitaires purs (aucune dépendance Spring/BDD) de {@link MatriceBudgetaireService},
 * qui vérifient la formule de score unique "à optimiser en priorité" : l'importance
 * (inversée) pèse plus que l'optimisable, optimisable et montant sont calculés
 * ensemble (produit), et seuls les {@value MatriceBudgetaireService#TOP_N} postes au
 * score le plus élevé sont retournés.
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
        assertThat(MatriceBudgetaireService.classerEntrees(List.of())).isEmpty();
    }

    @Test
    @DisplayName("Le score est toujours dans [0, 100] et le rang est 1-based sans trou")
    void scoresDansLIntervalleEtRangsCorrects() {
        List<PostePositionneDto> resultat = MatriceBudgetaireService.classerEntrees(posteExemple());
        assertThat(resultat).hasSize(14);
        for (PostePositionneDto p : resultat) {
            assertThat(p.score()).isBetween(BigDecimal.ZERO, BigDecimal.valueOf(100));
        }
        List<Integer> rangs = resultat.stream().map(PostePositionneDto::rang).toList();
        assertThat(rangs).containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1, 14).boxed().toList());
    }

    @Test
    @DisplayName("Le classement est bien trié par score strictement décroissant (ou égal)")
    void classementTrieParScoreDecroissant() {
        List<PostePositionneDto> resultat = MatriceBudgetaireService.classerEntrees(posteExemple());
        for (int i = 1; i < resultat.size(); i++) {
            assertThat(resultat.get(i - 1).score()).isGreaterThanOrEqualTo(resultat.get(i).score());
        }
    }

    @Test
    @DisplayName("Le montant annualisé est bien mensuel x 12")
    void montantAnnuelEstMensuelFoisDouze() {
        List<PostePositionneDto> resultat = MatriceBudgetaireService.classerEntrees(posteExemple());
        PostePositionneDto loyer = parNom(resultat).get("Loyer");
        assertThat(loyer.montantAnnuel()).isEqualByComparingTo(BigDecimal.valueOf(1450 * 12).setScale(2));
    }

    @Test
    @DisplayName("Le score le plus faible du jeu de test appartient à un poste de nécessité maximale (5)")
    void scoreLePlusFaibleAppartientAUnPosteTresImportant() {
        Map<String, PostePositionneDto> parNom = parNom(MatriceBudgetaireService.classerEntrees(posteExemple()));
        BigDecimal scoreMin = parNom.values().stream().map(PostePositionneDto::score)
                .min(BigDecimal::compareTo).orElseThrow();
        PostePositionneDto posteScoreMin = parNom.values().stream()
                .filter(p -> p.score().compareTo(scoreMin) == 0).findFirst().orElseThrow();
        assertThat(posteScoreMin.necessite()).isEqualTo(5);
    }

    @Test
    @DisplayName("À montant identique, faible importance + peu optimisable domine importance forte + optimisable fort")
    void faibleImportanceDomineOptimisableSeul() {
        // Deux postes de montant identique : l'un très important et très optimisable,
        // l'autre peu important et peu optimisable. Le second (peu important) doit
        // scorer plus haut : l'importance pèse plus que l'optimisable.
        PosteEntree importantEtOptimisable = new PosteEntree(UUID.nameUUIDFromBytes("A".getBytes()), "A",
                TypePoste.CHARGE, BigDecimal.valueOf(500), BigDecimal.valueOf(6000), 5, 5);
        PosteEntree peuImportantPeuOptimisable = new PosteEntree(UUID.nameUUIDFromBytes("B".getBytes()), "B",
                TypePoste.CHARGE, BigDecimal.valueOf(500), BigDecimal.valueOf(6000), 1, 1);
        Map<String, PostePositionneDto> parNom = parNom(
                MatriceBudgetaireService.classerEntrees(List.of(importantEtOptimisable, peuImportantPeuOptimisable)));

        assertThat(parNom.get("B").score()).isGreaterThan(parNom.get("A").score());
    }

    @Test
    @DisplayName("Un gros montant à faible importance dépasse un gros montant à forte optimisabilité (à importance haute)")
    void grosMontantFaibleImportanceDepasseGrosMontantOptimisableSeul() {
        PosteEntree grosMontantFaibleImportance = new PosteEntree(UUID.nameUUIDFromBytes("GrosFaibleImportance".getBytes()),
                "GrosFaibleImportance", TypePoste.CHARGE, BigDecimal.valueOf(2000), BigDecimal.valueOf(24000), 1, 1);
        PosteEntree grosMontantOptimisableForteImportance = new PosteEntree(
                UUID.nameUUIDFromBytes("GrosOptimisableImportant".getBytes()), "GrosOptimisableImportant",
                TypePoste.CHARGE, BigDecimal.valueOf(2000), BigDecimal.valueOf(24000), 5, 5);
        Map<String, PostePositionneDto> parNom = parNom(MatriceBudgetaireService.classerEntrees(
                List.of(grosMontantFaibleImportance, grosMontantOptimisableForteImportance)));

        assertThat(parNom.get("GrosFaibleImportance").score())
                .isGreaterThan(parNom.get("GrosOptimisableImportant").score());
    }

    @Test
    @DisplayName("Optimisable et montant sont calculés ensemble (produit) : peu optimisable neutralise l'effet du montant")
    void optimisableEtMontantCalculesEnsemble() {
        // Même nécessité (3) pour les trois : seule la composante optimisable×montant diffère.
        // "GrosPeuOptimisable" a optimisableNorm=0 -> opportunite=0 quel que soit le montant
        // -> son score doit être exactement celui obtenu sans aucune opportunité.
        // Un 3e poste ("MontantMoyen") sert à éviter que "PetitTresOptimisable" ne soit le
        // minimum absolu du groupe (rang percentile 0 -> opportunite nulle aussi).
        PosteEntree grosMontantPeuOptimisable = new PosteEntree(UUID.nameUUIDFromBytes("GrosPeuOptimisable".getBytes()),
                "GrosPeuOptimisable", TypePoste.CHARGE, BigDecimal.valueOf(2000), BigDecimal.valueOf(24000), 3, 1);
        PosteEntree petitMontantTresOptimisable = new PosteEntree(UUID.nameUUIDFromBytes("PetitTresOptimisable".getBytes()),
                "PetitTresOptimisable", TypePoste.CHARGE, BigDecimal.valueOf(300), BigDecimal.valueOf(3600), 3, 5);
        PosteEntree montantMinimal = new PosteEntree(UUID.nameUUIDFromBytes("MontantMinimal".getBytes()),
                "MontantMinimal", TypePoste.CHARGE, BigDecimal.valueOf(10), BigDecimal.valueOf(120), 3, 5);
        Map<String, PostePositionneDto> parNom = parNom(MatriceBudgetaireService.classerEntrees(
                List.of(grosMontantPeuOptimisable, petitMontantTresOptimisable, montantMinimal)));

        double importanceNorm = (3 - 1) / 4.0;
        double inutilite = 1 - importanceNorm;
        BigDecimal scoreAttenduSansOpportunite = BigDecimal.valueOf(0.7 * inutilite * 100.0).setScale(2, RoundingMode.HALF_UP);
        assertThat(parNom.get("GrosPeuOptimisable").score()).isEqualByComparingTo(scoreAttenduSansOpportunite);
        // "PetitTresOptimisable" n'est ni le montant min ni le montant max du groupe -> son
        // rang percentile de montant est strictement entre 0 et 1, donc opportunite > 0.
        assertThat(parNom.get("PetitTresOptimisable").score()).isGreaterThan(scoreAttenduSansOpportunite);
    }

    @Test
    @DisplayName("Troncature au top 30 : seuls les 30 meilleurs scores sont retournés, rang 1..30")
    void troncatureAuTop30() {
        List<PosteEntree> beaucoupDePostes = new ArrayList<>();
        for (int i = 0; i < 50; i++) {
            // Nécessité/optimisable variés pour garantir des scores distincts.
            int necessite = 1 + (i % 5);
            int optimisable = 1 + ((i + 2) % 5);
            beaucoupDePostes.add(poste("Poste" + i, TypePoste.CHARGE, 100 + i, necessite, optimisable));
        }
        List<PostePositionneDto> resultat = MatriceBudgetaireService.classerEntrees(beaucoupDePostes);

        assertThat(resultat).hasSize(MatriceBudgetaireService.TOP_N);
        assertThat(resultat.get(0).rang()).isEqualTo(1);
        assertThat(resultat.get(resultat.size() - 1).rang()).isEqualTo(MatriceBudgetaireService.TOP_N);
        for (int i = 1; i < resultat.size(); i++) {
            assertThat(resultat.get(i - 1).score()).isGreaterThanOrEqualTo(resultat.get(i).score());
        }
    }
}
