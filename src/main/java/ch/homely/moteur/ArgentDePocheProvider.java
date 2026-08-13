package ch.homely.moteur;

import java.util.UUID;

/**
 * Fournisseur du montant d'argent de poche à appliquer à un membre pour un mois donné.
 *
 * <p>Le module {@link ch.homely.moteur} reste pur — il ne connaît pas les entités
 * {@code PolitiqueArgentPoche} ni {@code AllocationArgentPoche}. Cette abstraction
 * permet à l'implémentation Spring de brancher son service métier sans polluer le
 * moteur, et de garder la <b>rétro-compatibilité totale</b> avec les vecteurs golden :
 * quand aucune politique n'est configurée (implémentation par défaut {@link #AUCUN}),
 * le montant retourné est {@code 0.0} et le calcul du moteur est strictement
 * inchangé.</p>
 *
 * <p><b>Contrat :</b>
 * <ul>
 *   <li>Le montant retourné est toujours ≥ 0.</li>
 *   <li>{@code ravBrut} est la valeur du RàV membre <b>avant</b> retrait de
 *       l'argent de poche : {@code revenus − charges − réserves} du membre pour ce
 *       mois. C'est cette valeur qui alimente la formule
 *       {@code socle + % × max(0, ravBrut − socle)}.</li>
 *   <li>L'implémentation doit être <b>sans effet de bord</b> et <b>stable</b> :
 *       plusieurs appels pour le même {@code (membreId, année, mois, ravBrut)}
 *       doivent retourner la même valeur.</li>
 * </ul>
 * </p>
 */
@FunctionalInterface
public interface ArgentDePocheProvider {

    /**
     * @param membreId identifiant du membre
     * @param annee    année du calcul
     * @param mois     mois (1..12)
     * @param ravBrut  RàV du membre avant argent de poche
     * @return montant à retirer du RàV membre pour ce mois (≥ 0, en devise de base)
     */
    double montant(UUID membreId, int annee, int mois, double ravBrut);

    /**
     * Implémentation par défaut — retourne {@code 0.0} inconditionnellement.
     * Utilisée par tous les vecteurs golden et par tout appelant qui ne branche
     * pas explicitement le service d'argent de poche.
     */
    ArgentDePocheProvider AUCUN = (membreId, annee, mois, ravBrut) -> 0.0;
}
