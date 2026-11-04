package ch.homely.moteur;

import ch.homely.poste.TypePoste;

import java.util.UUID;

/**
 * Mouvement inter-comptes induit par le <b>routage</b> d'un poste, pour un membre et un mois.
 *
 * <p>Le sens est dérivé du type du poste :</p>
 * <ul>
 *   <li>{@code CHARGE}/{@code RESERVE} : le compte contrepartie <i>alimente</i> le compte
 *       pivot → {@code compteSourceId} = contrepartie, {@code compteDestinationId} = pivot ;</li>
 *   <li>{@code REVENU} : le compte pivot <i>redistribue</i> vers la contrepartie →
 *       {@code compteSourceId} = pivot, {@code compteDestinationId} = contrepartie.</li>
 * </ul>
 *
 * <p>Les routages dont la contrepartie <b>est</b> le pivot ne produisent aucun mouvement
 * (l'argent est déjà au bon endroit) et ne sont jamais présents dans ces résultats.</p>
 *
 * <p>Un mouvement est émis par <b>(poste, membre, ligne de routage)</b> : {@code posteId}
 * permet donc de remonter, en couche service, la composition poste par poste d'un virement
 * simulé (popin « de quoi est fait ce virement »).</p>
 *
 * @param posteId             poste à l'origine du mouvement
 * @param membreId            membre dont la part transite
 * @param type                type du poste à l'origine du mouvement (détermine le sens)
 * @param compteSourceId      compte débité
 * @param compteDestinationId compte crédité
 * @param mensualise          montant selon la vision mensualisée ({@code contribution})
 * @param echu                montant selon la vision échue ({@code contributionReelle})
 */
public record VirementRoutage(
        UUID posteId,
        UUID membreId,
        TypePoste type,
        UUID compteSourceId,
        UUID compteDestinationId,
        double mensualise,
        double echu
) {}
