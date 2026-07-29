package ch.homely.moteur;

/**
 * Type d'événement budgétaire détecté par {@link MoteurCalcul#evenements(java.util.List, int)}.
 *
 * <ul>
 *   <li>{@code DEBUT} — un nouveau poste démarre (pas issu d'une révision).</li>
 *   <li>{@code FIN} — un poste se termine définitivement (aucun successeur).</li>
 *   <li>{@code REVISION} — un poste est remplacé par un successeur (chaîne de révisions) :
 *       montant modifié (hausse ou baisse).</li>
 *   <li>{@code OCCURRENCE} — échéance réelle non nulle d'un poste périodique non mensuel
 *       (D&gt;1), en dehors du mois de son DEBUT/REVISION/FIN.</li>
 * </ul>
 */
public enum TypeEvenement {
    DEBUT,
    FIN,
    REVISION,
    OCCURRENCE
}
