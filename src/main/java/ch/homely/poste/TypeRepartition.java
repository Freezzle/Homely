package ch.homely.poste;

/**
 * Mode de calcul de la quote-part d'un membre pour un poste.
 *
 * <ul>
 *   <li>{@link #AUTO} — hérite de la répartition de la <em>période active</em> du scénario.</li>
 *   <li>{@link #REVERSE_AUTO} — inverse normalisé de la période active :
 *       {@code (1 − pᵢ) / (N − 1)} ; pour N=2, permute exactement les parts (58/42 → 42/58).</li>
 *   <li>{@link #CUSTOM} — répartition manuelle fixée ligne par ligne,
 *       stockée dans {@code repartition_poste}.</li>
 * </ul>
 *
 * <p>Cas mono-membre : le moteur retourne toujours 1,0 quelle que soit la valeur de ce champ.</p>
 */
public enum TypeRepartition {
    AUTO,
    REVERSE_AUTO,
    CUSTOM
}

