package ch.homely.moteur;

import java.util.List;

/**
 * Résultat d'une projection pluriannuelle avec trésorerie chaînée.
 *
 * @param annees  projections annuelles dans l'ordre chronologique
 * @param tresorerie liste des entrées de trésorerie (une par année + entrée finale)
 */
public record ProjectionPluriannuelle(
        List<ProjectionAnnuelle> annees,
        List<EntreeTresorerie> tresorerie
) {

    /**
     * Entrée de trésorerie pour une année.
     *
     * @param annee                  année
     * @param soldeAnnuel            solde disponible cumulé sur les 12 mois de cette année
     * @param tresorerieDebutAnnee   trésorerie au 1er janvier de cette année
     * @param tresorerieFinAnnee     trésorerie au 31 décembre de cette année
     */
    public record EntreeTresorerie(
            int annee,
            double soldeAnnuel,
            double tresorerieDebutAnnee,
            double tresorerieFinAnnee
    ) {}
}
