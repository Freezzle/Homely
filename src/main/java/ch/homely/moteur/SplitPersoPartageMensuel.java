package ch.homely.moteur;

/**
 * Décomposition perso / partagé d'un membre pour un mois donné, par type de poste
 * (REVENU / CHARGE / RESERVE).
 *
 * <p>Un poste est <b>personnel</b> s'il est réparti en {@code CUSTOM} avec un seul
 * membre bénéficiaire (cf. {@link MoteurCalcul#estPersonnel(PosteCalcul)}) ; sinon il
 * est <b>partagé</b> (y compris tous les postes {@code AUTO} / {@code REVERSE_AUTO}).
 * Par construction, {@code xxxPerso + xxxPartage} égale exactement le total du type
 * correspondant dans {@link AggregatMensuel} — aucune approximation ni redistribution
 * proportionnelle.
 *
 * @param revenusPerso    part des revenus des postes personnels
 * @param revenusPartage  part des revenus des postes partagés
 * @param chargesPerso    part des charges des postes personnels
 * @param chargesPartage  part des charges des postes partagés
 * @param reservesPerso   part des réserves des postes personnels
 * @param reservesPartage part des réserves des postes partagés
 */
public record SplitPersoPartageMensuel(
        double revenusPerso,
        double revenusPartage,
        double chargesPerso,
        double chargesPartage,
        double reservesPerso,
        double reservesPartage
) {
    public static SplitPersoPartageMensuel zero() {
        return new SplitPersoPartageMensuel(0, 0, 0, 0, 0, 0);
    }
}
