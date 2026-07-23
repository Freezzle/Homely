package ch.homely.poste.dto;

/**
 * Résultat d'une révision de montant : le poste clôturé (ancien) et le poste
 * créé (nouveau), tous deux à jour après l'opération atomique.
 */
public record PosteRevisionResponse(PosteDto posteCloture, PosteDto posteCree) {}
