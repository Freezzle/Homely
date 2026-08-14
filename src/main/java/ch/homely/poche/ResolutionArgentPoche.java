package ch.homely.poche;

import java.util.UUID;

/**
 * Résultat de {@link ArgentPocheService#resoudre}.
 *
 * <p>Priorité de résolution (spec §1) : {@link SourceArgentPoche#ALLOCATION}
 * &gt; {@link SourceArgentPoche#POLITIQUE} &gt; {@link SourceArgentPoche#AUCUNE}.</p>
 *
 * @param montant       montant résolu (≥ 0) en devise de base
 * @param source        origine du montant
 * @param politiqueId   id de la politique appliquée si {@code source = POLITIQUE}, sinon {@code null}
 * @param allocationId  id de l'allocation appliquée si {@code source = ALLOCATION}, sinon {@code null}
 * @param compteId      compte crédité par la politique/allocation appliquée, {@code null} si {@code source = AUCUNE}
 * @param rav           RàV du membre avant retrait de l'argent de poche (pour affichage/contexte)
 */
public record ResolutionArgentPoche(
        double montant,
        SourceArgentPoche source,
        UUID politiqueId,
        UUID allocationId,
        UUID compteId,
        double rav
) {
    public static ResolutionArgentPoche aucune(double rav) {
        return new ResolutionArgentPoche(0.0, SourceArgentPoche.AUCUNE, null, null, null, rav);
    }

    public static ResolutionArgentPoche parAllocation(double montant, UUID allocationId, UUID compteId, double rav) {
        return new ResolutionArgentPoche(montant, SourceArgentPoche.ALLOCATION, null, allocationId, compteId, rav);
    }

    public static ResolutionArgentPoche parPolitique(double montant, UUID politiqueId, UUID compteId, double rav) {
        return new ResolutionArgentPoche(montant, SourceArgentPoche.POLITIQUE, politiqueId, null, compteId, rav);
    }
}
