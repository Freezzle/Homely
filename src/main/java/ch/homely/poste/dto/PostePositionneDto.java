package ch.homely.poste.dto;

import ch.homely.poste.TypePoste;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Poste positionné pour la matrice budgétaire "Nécessité vs Priorité d'action"
 * (dashboard annuel) — tous les calculs (montant annualisé, scores 0-100 par rang
 * percentile, poids du montant, classification en quadrant) sont faits côté serveur
 * par {@code MatriceBudgetaireService} ; le frontend ne fait plus que du rendu.
 *
 * @param prioriteScore   axe X (0-100) : priorité d'action — rang percentile combinant
 *                        {@code optimisable} et le montant annualisé.
 * @param necessiteScore  axe Y (0-100) : nécessité — rang percentile combinant
 *                        {@code necessite} et le montant annualisé (jitter d'affichage inclus).
 * @param poidsMontant    poids relatif (0-1) du montant annualisé de ce poste parmi les
 *                        postes affichés — pilote la taille du point à l'affichage.
 * @param quadrant        "rigides" | "negocier" | "bruit" | "couper".
 */
public record PostePositionneDto(
        UUID id,
        String nom,
        TypePoste type,
        BigDecimal montantMensuel,
        BigDecimal montantAnnuel,
        int necessite,
        int optimisable,
        BigDecimal prioriteScore,
        BigDecimal necessiteScore,
        BigDecimal poidsMontant,
        String quadrant
) {}
