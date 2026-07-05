package ch.homely.poste;

/**
 * Mode de comptabilisation d'un poste.
 * <ul>
 *   <li>{@code MENSUALISE} – montant lissé : {@code montant / périodicité} chaque mois actif.</li>
 *   <li>{@code PERIODIQUE} – montant plein imputé une seule fois par cycle.</li>
 * </ul>
 */
public enum ModeComptabilisation {
    MENSUALISE,
    PERIODIQUE
}
