package ch.homely.poche.dto;

import java.math.BigDecimal;

/**
 * RàV brut d'un membre pour un mois — <b>avant</b> tout retrait d'argent de
 * poche et <b>indépendant</b> de toute {@code PolitiqueArgentPoche}/
 * {@code AllocationArgentPoche} persistée. Utilisé côté frontend pour
 * l'aperçu "6 prochains mois" de la popin politique : la formule (mode,
 * socle, pourcentage, plafond) y est appliquée côté client sur ce RàV brut,
 * y compris pour une politique en cours d'édition non encore enregistrée.
 */
public record RavBrutMoisDto(
        int mois,
        BigDecimal rav
) {}
