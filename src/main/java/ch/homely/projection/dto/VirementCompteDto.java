package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Virement inter-comptes simulé (dashboard "Virements des comptes", vue foyer — pas scopée à
 * un membre, à la différence de {@link CompteRecapMensuelDto}). Une paire {@code compteSourceId}
 * (compte primaire qui finance) → {@code compteDestinationId} (compte crédité) par ligne, montant
 * agrégé sur la période (mois, ou somme des 12 mois pour la variante annuelle).
 *
 * <p>Ne porte pas d'état "fait/pas fait" : ce statut est géré côté frontend uniquement (état
 * local, non persisté), le périmètre de l'application restant limité à la prévision.</p>
 *
 * @param compteSourceId          identifiant du compte source (primaire qui finance)
 * @param libelleCompteSource     libellé du compte source
 * @param compteDestinationId     identifiant du compte destination (crédité)
 * @param libelleCompteDestination libellé du compte destination
 * @param montant                 montant du virement (agrégé, toujours positif)
 */
public record VirementCompteDto(
        UUID compteSourceId,
        String libelleCompteSource,
        UUID compteDestinationId,
        String libelleCompteDestination,
        BigDecimal montant
) {}
