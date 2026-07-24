package ch.homely.poste.dto;

/**
 * Résultat d'un déplacement de date d'effet : le maillon précédent (fin ajustée) et le
 * maillon édité (début ajusté), tous deux à jour après l'opération atomique.
 */
public record PosteDecalerDateEffetResponse(PosteDto postePrecedent, PosteDto posteEdite) {}
