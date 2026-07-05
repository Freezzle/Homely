package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** DTO pour la projection patrimoniale (T8.4). */
public record PatrimoineDto(
        List<AnneePatrimoineDto> annees
) {
    public record AnneePatrimoineDto(
            int annee,
            BigDecimal patrimoineNet,
            Map<UUID, BigDecimal> soldesComptes,
            Map<UUID, BigDecimal> soldesActifs
    ) {}
}
