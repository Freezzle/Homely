package ch.homely.poche.dto;

import ch.homely.poche.SourceArgentPoche;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Résolution du montant d'argent de poche pour un {@code (membre, mois)} donné.
 * Exposé sur {@code GET .../argent-poche/resolution}.
 */
public record ResolutionArgentPocheDto(
        /** Montant résolu en devise de base (≥ 0). */
        BigDecimal montant,
        SourceArgentPoche source,
        /** Politique appliquée, si {@code source = POLITIQUE}. */
        UUID politiqueId,
        /** Allocation appliquée, si {@code source = ALLOCATION}. */
        UUID allocationId,
        /** RàV du membre avant retrait de l'argent de poche (contexte). */
        BigDecimal rav
) {}
