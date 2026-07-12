package ch.homely.scenario.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Requête de création ou modification d'une période de répartition.
 */
public record RepartitionPeriodeRequest(
        LocalDate debut,
        LocalDate fin,
        @NotEmpty @Valid List<PartRequest> parts
) {
    public record PartRequest(
            @NotNull UUID membreId,
            @NotNull @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal quotePart
    ) {}
}

