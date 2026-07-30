package ch.homely.moteur;

/**
 * Type d'événement budgétaire détecté par {@link MoteurCalcul#evenements(java.util.List, int)}.
 *
 * <p>Ne représente que des <b>changements</b> — pas le calendrier des échéances récurrentes.</p>
 *
 * <ul>
 *   <li>{@code DEBUT} — un nouveau poste démarre (pas issu d'une révision).</li>
 *   <li>{@code FIN} — un poste se termine définitivement (aucun successeur).</li>
 *   <li>{@code REVISION} — un poste est remplacé par un successeur (chaîne de révisions) :
 *       montant modifié (hausse ou baisse).</li>
 * </ul>
 */
public enum TypeEvenement {
    DEBUT,
    FIN,
    REVISION
}
