package ch.homely.scenario.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ScenarioDto(
        UUID id,
        String nom,
        boolean estReference,
        int anneeDepart,
        BigDecimal tresorerieInitiale,
        int horizonAnnees,
        List<RepartitionDefautDto> repartitions,
        Instant dateModification
) {
    public record RepartitionDefautDto(UUID membreId, String nomMembre, BigDecimal quotePart) {}
}
