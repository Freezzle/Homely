package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Récapitulatif mensuel de trésorerie d'un compte (dashboard, vue membre).
 *
 * <p>Toutes les valeurs sont scopées à la part du membre demandé sur ce compte (pas le
 * flux de caisse total du compte, qui regrouperait tous les co-titulaires — prévu pour
 * une future vue "foyer"). Le tri du compte dans la liste de retour est filtré côté
 * service aux comptes dont le membre demandé est co-titulaire, ainsi qu'à tout autre
 * compte sur lequel il a un montant non nul — notamment un compte (primaire ou non) dont
 * il est co-titulaire, sans y avoir lui-même de part active, mais qu'un AUTRE membre
 * finance ce mois-là (poste ventilé ou argent de poche crédité depuis son propre
 * primaire) : le co-titulaire voit alors, lui aussi, ce montant comme virement entrant.</p>
 *
 * <p>Si les co-titulaires ont désigné un compte primaire, {@code virementsEntrants} et
 * {@code virementsSortants} reflètent les virements réels simulés (budget planifié +
 * comblement de trésorerie si nécessaire) ; sinon (mode "legacy"), {@code virementsEntrants}
 * reste égal au budget planifié (mensualisé) et {@code virementsSortants} est nul.</p>
 *
 * @param compteId             identifiant du compte
 * @param libelleCompte        libellé du compte
 * @param virementsEntrants    montant réellement viré vers ce compte ce mois pour la part
 *                             du membre (budget planifié financé par un primaire externe +
 *                             comblement éventuel), ou budget planifié seul en mode legacy
 * @param entrees              revenus échus ce mois du membre sur ce compte (montant plein sur mois d'ancrage)
 * @param sortiesPlanifiees    charges + réserves mensualisées (lissées) de la part du membre pour ce mois
 * @param sortiesEchues        charges + réserves réellement échues ce mois pour la part du membre
 * @param virementsSortants    montant que la part du membre sur ce compte doit fournir ce mois pour
 *                             financer ses propres postes ventilés sur d'autres comptes dont celui-ci est son primaire
 * @param soldeRestant         entrees + virementsEntrants − sortiesEchues − virementsSortants
 */
public record CompteRecapMensuelDto(
        UUID compteId,
        String libelleCompte,
        BigDecimal virementsEntrants,
        BigDecimal entrees,
        BigDecimal sortiesPlanifiees,
        BigDecimal sortiesEchues,
        BigDecimal virementsSortants,
        BigDecimal soldeRestant
) {}
