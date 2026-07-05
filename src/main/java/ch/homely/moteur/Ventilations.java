package ch.homely.moteur;

import java.util.Map;
import java.util.UUID;

/**
 * Ventilations d'un mois donné par catégorie et par compte/membre.
 *
 * @param annee              année du mois
 * @param mois               numéro du mois (1-12)
 * @param parCategorie       montant total par catégorie {categorieId → montant}
 * @param parCompteMembre    montant par (compteId, membreId) {compteId → {membreId → montant}}
 */
public record Ventilations(
        int annee,
        int mois,
        Map<UUID, Double> parCategorie,
        Map<UUID, Map<UUID, Double>> parCompteMembre
) {}
