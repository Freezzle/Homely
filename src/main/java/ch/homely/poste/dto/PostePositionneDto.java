package ch.homely.poste.dto;

import ch.homely.poste.TypePoste;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Poste classé pour le graphique "Postes à optimiser en priorité" (dashboard annuel,
 * ex-matrice "Nécessité vs Priorité d'action") — tous les calculs (montant annualisé,
 * score unique 0-100, tri, troncature au top 30) sont faits côté serveur par
 * {@code MatriceBudgetaireService} ; le frontend ne fait plus que du rendu.
 *
 * @param score  score unique (0-100) : combine l'inutilité (importance inversée, poids
 *               dominant 0.6) et l'opportunité d'économie (optimisable × poids du
 *               montant annuel parmi tous les postes de l'année, poids 0.4). Plus le
 *               score est élevé, plus le poste est un candidat prioritaire à réviser ou
 *               supprimer.
 * @param rang   position (1-based) dans le classement décroissant par score, parmi les
 *               30 postes retournés (le plus haut score = rang 1).
 */
public record PostePositionneDto(
        UUID id,
        String nom,
        TypePoste type,
        BigDecimal montantMensuel,
        BigDecimal montantAnnuel,
        int necessite,
        int optimisable,
        BigDecimal score,
        int rang
) {}
