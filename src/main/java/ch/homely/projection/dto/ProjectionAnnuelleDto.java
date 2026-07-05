package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** DTO de réponse pour la projection annuelle (T8.1). */
public record ProjectionAnnuelleDto(
        int annee,
        List<MoisDto> mois,
        AggregatDto totalAnnuel,
        Map<UUID, AggregatDto> parMembre,
        Map<UUID, List<AggregatDto>> moisParMembre
) {
    public record MoisDto(int numero, AggregatDto agregat) {}

    public record AggregatDto(
            BigDecimal revenus,
            BigDecimal charges,
            BigDecimal reserves,
            BigDecimal soldeDisponible
    ) {}
}
