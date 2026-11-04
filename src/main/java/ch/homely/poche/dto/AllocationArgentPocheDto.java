package ch.homely.poche.dto;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

public record AllocationArgentPocheDto(
        UUID id,
        UUID scenarioId,
        UUID membreId,
        /** Compte source qui finance ce versement ponctuel. */
        UUID comptePivotId,
        /** Comptes de poche crédités et leurs quotes-parts (somme = 1). */
        List<LigneRoutagePocheDto> routage,
        YearMonth mois,
        BigDecimal montant,
        String raison
) {}
