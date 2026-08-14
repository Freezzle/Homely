package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Indicateur "Prorata des postes partagés" (dashboard) : compare, pour un membre et une
 * période (mois ou année), la quote-part qu'il assume réellement sur les postes
 * {@code CHARGE}/{@code RESERVE} partagés (voir {@link ch.homely.moteur.MoteurCalcul#estPersonnel})
 * — moyenne pondérée par le montant de chaque poste — à la quote-part qui
 * s'appliquerait si la répartition suivait strictement le poids de ses revenus dans le
 * total des revenus du foyer sur la même période.
 *
 * @param prorataMoyenApplique   ∈ [0,1] — {@code Σ(contribution × quotePartEffective)} du
 *                               membre sur les postes partagés, divisé par
 *                               {@code Σ(contribution)} de ces mêmes postes. {@code null}
 *                               si {@code aDesPostesPartages == false}.
 * @param prorataTheoriqueRevenu ∈ [0,1] — revenus du membre / revenus du foyer sur la
 *                               période. {@code null} si le foyer n'a aucun revenu sur la
 *                               période.
 * @param aDesPostesPartages     {@code false} si aucun poste {@code CHARGE}/{@code RESERVE}
 *                               partagé n'a de contribution non nulle sur la période (par
 *                               ex. foyer mono-membre, ou aucun poste partagé défini) —
 *                               permet au frontend de masquer l'indicateur.
 */
public record ProrataPartageMembreDto(
        UUID membreId,
        String nomMembre,
        String couleurMembre,
        BigDecimal prorataMoyenApplique,
        BigDecimal prorataTheoriqueRevenu,
        boolean aDesPostesPartages
) {}
