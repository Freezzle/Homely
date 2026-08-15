package ch.homely.dashboard.dto;

/**
 * Seuils d'interprétation du dashboard, centralisés côté backend (auparavant codés en dur
 * dans les composants Angular). Le frontend les consomme pour teinter/qualifier ses
 * indicateurs — aucune règle métier du moteur ici, uniquement des bornes d'affichage.
 *
 * @param moisARisqueSoldeMin   solde disponible mensuel (devise base) en-dessous duquel un
 *                              mois est compté « à risque » (indicateur Mois à risque)
 * @param tauxEffortCorrect     borne % : au-delà, la zone de taux d'effort passe de
 *                              « confortable » à « correct »
 * @param tauxEffortTendu       borne % : au-delà, zone « tendue »
 * @param tauxEffortSature      borne % : au-delà, zone « saturée »
 * @param tauxEffortSoutenu     borne % du niveau d'effort « soutenu » (décomposition)
 * @param tauxEffortCritique    borne % du niveau d'effort « critique » (décomposition)
 * @param besoinsPlaisirsBudget borne % (Besoins / revenus totaux) au-delà de laquelle la
 *                              part des besoins est jugée élevée
 * @param posteAOptimiserScore  score minimal d'un poste pour être compté « à optimiser »
 */
public record SeuilsDashboardDto(
        double moisARisqueSoldeMin,
        double tauxEffortCorrect,
        double tauxEffortTendu,
        double tauxEffortSature,
        double tauxEffortSoutenu,
        double tauxEffortCritique,
        double besoinsPlaisirsBudget,
        double posteAOptimiserScore
) {
    /** Valeurs par défaut reproduisant à l'identique les constantes historiques du frontend. */
    public static SeuilsDashboardDto valeursParDefaut() {
        return new SeuilsDashboardDto(500, 75, 90, 95, 70, 85, 50, 66);
    }
}
