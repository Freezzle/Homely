package ch.homely.poste.dto;

import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.MomentPeriode;
import ch.homely.poste.NaturePoste;
import ch.homely.poste.TypePoste;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PosteRequest(
        @NotNull TypePoste type,
        @NotBlank @Size(max = 255) String description,
        UUID categorieId,
        @NotNull @DecimalMin("0.0") BigDecimal montant,
        @Size(min = 3, max = 3) String devise,
        @Min(1) int periodiciteMois,
        LocalDate debut,
        LocalDate fin,
        @NotNull ModeComptabilisation mode,
        @NotNull MomentPeriode moment,
        @NotNull NaturePoste nature,
        UUID compteSource,
        int ordre,
        @Valid List<RepartitionPosteDto> repartitions,
        @Valid List<VentilationCompteDto> ventilations
) {
    public record RepartitionPosteDto(
            @NotNull UUID membreId,
            @NotNull @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal quotePart) {}

    public record VentilationCompteDto(
            @NotNull UUID membreId,
            @NotNull UUID compteId) {}
}
