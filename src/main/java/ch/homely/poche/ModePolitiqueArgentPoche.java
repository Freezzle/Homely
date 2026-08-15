package ch.homely.poche;

/**
 * Mode de calcul d'une {@link PolitiqueArgentPoche}.
 *
 * <ul>
 *     <li>{@link #VARIABLE} : {@code min(max(RàV × pourcentage / 100, socle), plafond)}.
 *         Le pourcentage s'applique au RàV brut ; le socle est un plancher (toujours
 *         versé au minimum) et le plafond un maximum absolu.</li>
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
