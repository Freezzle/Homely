package ch.homely.moteur;

/**
 * Détail des flux d'un membre sur un compte donné, pour un mois donné — distingue la
 * vision <b>mensualisée</b> (lissée, cf. {@link MoteurCalcul#contribution}) de la vision
 * <b>échue</b> (montant plein sur son mois d'ancrage, cf.
 * {@link MoteurCalcul#contributionReelle}).
 *
 * <p>Les charges et réserves sont suivies séparément pour permettre au frontend de
 * distinguer mouvements externes (charges) et internes (réserves/transferts). Les
 * accesseurs {@link #chargesReservesMensualise()} et {@link #chargesReservesEchu()}
 * restent disponibles pour la rétrocompatibilité (somme des deux).</p>
 *
 * @param revenusMensualise    revenus (poste REVENU) mensualisés du membre sur ce compte
 * @param revenusEchu          revenus échus ce mois (montant plein sur mois d'ancrage)
 * @param chargesMensualise    charges (poste CHARGE) mensualisées du membre sur ce compte
 * @param chargesEchu          charges échues ce mois
 * @param reservesMensualise   réserves (poste RESERVE) mensualisées du membre sur ce compte
 * @param reservesEchu         réserves échues ce mois
 */
public record DetailCompteMembre(
        double revenusMensualise,
        double revenusEchu,
        double chargesMensualise,
        double chargesEchu,
        double reservesMensualise,
        double reservesEchu
) {
    /** Somme charges + réserves mensualisées (rétrocompatibilité). */
    public double chargesReservesMensualise() {
        return chargesMensualise + reservesMensualise;
    }

    /** Somme charges + réserves échues (rétrocompatibilité). */
    public double chargesReservesEchu() {
        return chargesEchu + reservesEchu;
    }

    public static DetailCompteMembre zero() {
        return new DetailCompteMembre(0, 0, 0, 0, 0, 0);
    }

    public DetailCompteMembre plus(DetailCompteMembre autre) {
        return new DetailCompteMembre(
                revenusMensualise + autre.revenusMensualise,
                revenusEchu + autre.revenusEchu,
                chargesMensualise + autre.chargesMensualise,
                chargesEchu + autre.chargesEchu,
                reservesMensualise + autre.reservesMensualise,
                reservesEchu + autre.reservesEchu);
    }
}
