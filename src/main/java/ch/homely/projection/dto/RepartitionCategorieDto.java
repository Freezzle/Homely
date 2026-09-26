package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Part d'une catégorie dans le total de son type (ex. part de « Logement » dans les
 * charges) pour un sujet (foyer ou membre) et une période (mois ou année).
 *
 * @param categorieId identifiant de la catégorie
 * @param libelle     libellé courant de la catégorie
 * @param montant     montant mensualisé de la catégorie sur la période, en devise de base
 * @param part        part ∈ [0,1] du montant dans le total du type sur la période
 */
public record RepartitionCategorieDto(
        UUID categorieId,
        String libelle,
        BigDecimal montant,
        BigDecimal part
) {}
