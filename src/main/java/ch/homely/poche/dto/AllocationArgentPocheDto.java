package ch.homely.poche.dto;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.UUID;

public record AllocationArgentPocheDto(
        UUID id,
        UUID scenarioId,
        UUID membreId,
        UUID compteId,
        YearMonth mois,
        BigDecimal montant,
        String raison
) {}
