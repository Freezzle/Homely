package ch.homely.poche.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.UUID;

public record AllocationArgentPocheRequest(
        @NotNull UUID membreId,
        @NotNull UUID compteId,
        @NotNull YearMonth mois,
        @NotNull @DecimalMin("0.0") BigDecimal montant,
        @Size(max = 255) String raison
) {}
