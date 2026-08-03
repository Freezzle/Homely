package ch.homely.poste;

/**
 * Moment d'imputation pour un poste PERIODIQUE (utilisé aussi côté "réel" pour un
 * poste MENSUALISE, cf. {@code contributionReelle}) : début ou fin de la période,
 * ou {@link #INCONNU} lorsque la date de paiement effective n'est pas connue
 * (ex. "dentiste 1x/an", provision pour imprévu).
 *
 * <p>{@code INCONNU} impose {@code mode == MENSUALISE} (seule stratégie possible :
 * pas de choix PERIODIQUE) et fait traiter le poste comme un montant mensuel lissé
 * y compris dans les calculs "réels" (aucun mois d'ancrage où le montant plein
 * tombe en une fois).</p>
 */
public enum MomentPeriode {
    DEBUT_PERIODE,
    FIN_PERIODE,
    INCONNU
}
