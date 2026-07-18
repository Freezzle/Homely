package ch.homely.scenario.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ScenarioRequest(
        @NotBlank @Size(max = 160) String nom,
        @NotNull @Min(2020) int anneeDepart,
        BigDecimal tresorerieInitiale,
        @Min(1) @Max(100) int horizonAnnees,
        @NotEmpty @Valid List<RepartitionDefautDto> repartitions
) {
    public record RepartitionDefautDto(
            @NotNull UUID membreId,
            @NotNull @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal quotePart
    ) {}
}
