package ch.homely.poche;

/**
 * Mode de calcul d'une {@link PolitiqueArgentPoche}.
 *
 * <ul>
 *     <li>{@link #VARIABLE} : {@code socle + pourcentage × max(0, RàV − socle)},
 *         plafonné par {@code plafond}. Le socle est toujours versé intégralement.</li>
 *     <li>{@link #FIXE} : un montant constant chaque mois, indépendant du RàV.</li>
 * </ul>
 *
 * <p>Dans les deux modes, le montant peut créer un découvert (RàV négatif après
 * versement) — c'est un comportement voulu, jamais bloqué.</p>
 */
public enum ModePolitiqueArgentPoche {
    VARIABLE,
    FIXE
}
