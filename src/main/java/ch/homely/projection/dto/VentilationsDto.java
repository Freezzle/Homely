package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/** DTO de réponse pour les ventilations mensuelles (T8.3). */
public record VentilationsDto(
        int annee,
        int mois,
        AggregatDto agregat,
        Map<UUID, AggregatDto> parMembre,
        Map<UUID, BigDecimal> parCategorie,
        Map<UUID, Map<UUID, BigDecimal>> parCategorieMembre,
        Map<UUID, Map<UUID, BigDecimal>> parCompteMembre
) {
    /** Agrégat foyer ou membre pour un mois donné. */
    public record AggregatDto(
            BigDecimal revenus,
            BigDecimal charges,
            BigDecimal reserves,
            BigDecimal soldeDisponible
    ) {}
}

