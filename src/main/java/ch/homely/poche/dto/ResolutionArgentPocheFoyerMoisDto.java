package ch.homely.poche.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Résolution d'argent de poche agrégée à l'échelle du foyer pour un mois
 * donné — somme des résolutions de tous les membres actifs du scénario.
 * Exposé sur {@code GET .../argent-poche/resolution-foyer-annee} (12 éléments,
 * janvier = index 0), pour le widget dashboard en mode <b>foyer</b> (KPI,
 * graphique, barre) — l'argent de poche individuel n'a pas de sens agrégé
 * autrement qu'en somme brute, aucune action d'édition unitaire n'est possible
 * depuis cette vue (voir {@code ArgentPocheController}).
 */
public record ResolutionArgentPocheFoyerMoisDto(
        int mois,
        /** Somme des montants résolus de tous les membres, ce mois-là. */
        BigDecimal total,
        List<ResolutionArgentPocheMembreMoisDto> parMembre
) {}
