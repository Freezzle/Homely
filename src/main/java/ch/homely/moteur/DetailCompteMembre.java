package ch.homely.moteur;

/**
 * Détail des flux d'un membre sur un compte donné, pour un mois donné — distingue la
 * vision <b>mensualisée</b> (lissée, cf. {@link MoteurCalcul#contribution}) de la vision
 * <b>échue</b> (montant plein sur son mois d'ancrage, cf.
 * {@link MoteurCalcul#contributionReelle}).
 *
 * <p>Réserves regroupées avec les charges (toutes deux des sorties du compte) — seule la
 * distinction revenus / charges+réserves est pertinente pour le récapitulatif de
 * trésorerie par compte.</p>
 *
 * @param revenusMensualise           revenus (poste REVENU) mensualisés du membre sur ce compte
 * @param revenusEchu                 revenus échus ce mois (montant plein sur mois d'ancrage)
 * @param chargesReservesMensualise   charges + réserves mensualisées du membre sur ce compte
 * @param chargesReservesEchu         charges + réserves échues ce mois
 */
public record DetailCompteMembre(
        double revenusMensualise,
        double revenusEchu,
        double chargesReservesMensualise,
        double chargesReservesEchu
) {
    public static DetailCompteMembre zero() {
        return new DetailCompteMembre(0, 0, 0, 0);
    }

    public DetailCompteMembre plus(DetailCompteMembre autre) {
        return new DetailCompteMembre(
                revenusMensualise + autre.revenusMensualise,
                revenusEchu + autre.revenusEchu,
                chargesReservesMensualise + autre.chargesReservesMensualise,
                chargesReservesEchu + autre.chargesReservesEchu);
    }
}
