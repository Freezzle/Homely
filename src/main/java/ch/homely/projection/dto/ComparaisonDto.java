package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** DTO pour la comparaison multi-scénarios (T8.5). */
public record ComparaisonDto(
        List<UUID> scenarioIds,
        List<String> nomScenarios,
        List<SerieAnnuelleDto> series
) {
    public record SerieAnnuelleDto(
            int annee,
            /** soldeAnnuel par scenarioId */
            Map<UUID, BigDecimal> soldeparScenario,
            /** tresorerieFinAnnee par scenarioId */
            Map<UUID, BigDecimal> tresorerieParScenario
    ) {}
}
