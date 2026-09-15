package ch.homely.poste;

/**
 * Champ ciblé par une mise à jour groupée de postes (voir {@code PosteActionGroupeeRequest}).
 * Ces champs sont purement descriptifs : aucun impact sur le moteur de calcul.
 */
public enum ChampGroupable {
    CATEGORIE,
    IMPORTANCE,
    POTENTIEL_OPTIMISATION,
    DERIVE_EXTERNE
}
