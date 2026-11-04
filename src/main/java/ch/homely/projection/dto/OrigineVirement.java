package ch.homely.projection.dto;

/**
 * Nature d'une ligne composant un virement inter-comptes simulé
 * (voir {@link VirementDetailLigneDto}).
 */
public enum OrigineVirement {
    /** Part d'un poste du scénario routée via ce virement. */
    POSTE,
    /** Argent de poche d'un membre, versé depuis le compte source vers le compte crédité. */
    ARGENT_POCHE,
    /** Part qui ne finance aucun poste du mois mais comble le découvert du compte destination. */
    COMBLEMENT_TRESORERIE
}
