package ch.homely.scenario.dto;

import ch.homely.poste.TypeRepartition;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * DTO d'une période de répartition par défaut d'un scénario.
 */
public record RepartitionPeriodeDto(
        UUID id,
        LocalDate debut,
        LocalDate fin,
        List<PartDto> parts
) {
    public record PartDto(
            UUID membreId,
            String nomMembre,
            String couleurMembre,
            BigDecimal quotePart,
            int ordre
    ) {}
}

