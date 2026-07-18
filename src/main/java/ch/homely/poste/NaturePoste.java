package ch.homely.poste;

/**
 * Nature d'un poste (usage descriptif — n'altère pas les calculs du moteur).
 * <ul>
 *   <li>{@code EFFECTIF} — dépense/revenu contractuel ou récurrent bien connu
 *       (loyer, salaire, facture, cotisation…).</li>
 *   <li>{@code ANTICIPE} — provision pour frais variables estimés (alimentation,
 *       habits, loisirs, sorties, cadeaux…).</li>
 * </ul>
 * Sert notamment à filtrer/étiqueter les postes dans les tableaux de bord ;
 * le comportement des projections (mensualisée et réelle) reste identique quelle
 * que soit la nature.
 */
public enum NaturePoste {
    EFFECTIF,
    ESTIMATION
}


