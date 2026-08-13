package ch.homely.poche;

/**
 * Origine du montant retourné par {@link ArgentPocheService#resoudre}.
 *
 * <ul>
 *   <li>{@link #ALLOCATION} : une {@link AllocationArgentPoche} existe pour
 *       {@code (scenario, membre, mois)} — son montant remplace tout calcul.</li>
 *   <li>{@link #POLITIQUE}  : aucune allocation, une {@link PolitiqueArgentPoche}
 *       est active pour ce mois — sa formule est appliquée sur le RàV du membre.</li>
 *   <li>{@link #AUCUNE}     : rien de configuré → montant 0.</li>
 * </ul>
 */
public enum SourceArgentPoche {
    ALLOCATION,
    POLITIQUE,
    AUCUNE
}
