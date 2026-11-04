package ch.homely.moteur;

import java.util.UUID;

/**
 * Ligne de <b>routage</b> d'un poste : compte contrepartie d'un membre.
 *
 * <p>Le sens est dérivé du type du poste : pour une {@code CHARGE}/{@code RESERVE} ce
 * compte <i>alimente</i> le compte pivot ({@link PosteCalcul#comptePivotId()}) ; pour un
 * {@code REVENU} il est <i>alimenté</i> par lui. Quand le compte est le pivot lui-même,
 * aucun virement n'est à simuler.</p>
 *
 * @param membreId  identifiant du membre
 * @param compteId  identifiant du compte contrepartie
 * @param quotePart part <b>dans la part du membre</b> (pas dans le total du poste),
 *                  ∈ [0,1] ; la somme des quotes-parts d'un même membre vaut 1
 */
public record VentilationCalcul(
        UUID membreId,
        UUID compteId,
        double quotePart
) {
    /** Constructeur de compatibilité : un seul compte par membre ⇒ quote-part 1. */
    public VentilationCalcul(UUID membreId, UUID compteId) {
        this(membreId, compteId, 1.0);
    }
}
