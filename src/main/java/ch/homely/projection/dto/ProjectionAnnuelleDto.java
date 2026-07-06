package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DTO de réponse pour la projection annuelle (T8.1).
 *
 * @param mois               12 mois — projection mensualisée (respecte le {@code mode}
 *                           de chaque poste ; comportement historique du moteur)
 * @param moisReel           12 mois — projection réelle : montant plein imputé au mois
 *                           d'ancrage pour tout poste {@code periodicité > 1},
 *                           quel que soit son mode
 * @param moisParMembre      idem par membre — mensualisé
 * @param moisParMembreReel  idem par membre — réel
 */
public record ProjectionAnnuelleDto(
        int annee,
        List<MoisDto> mois,
        List<MoisDto> moisReel,
        AggregatDto totalAnnuel,
        Map<UUID, AggregatDto> parMembre,
        Map<UUID, List<AggregatDto>> moisParMembre,
        Map<UUID, List<AggregatDto>> moisParMembreReel
) {
    public record MoisDto(int numero, AggregatDto agregat) {}

    public record AggregatDto(
            BigDecimal revenus,
            BigDecimal charges,
            BigDecimal reserves,
            BigDecimal soldeDisponible
    ) {}
}
