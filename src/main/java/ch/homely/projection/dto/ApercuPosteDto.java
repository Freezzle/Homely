package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.List;

/** DTO pour l'aperçu mensuel d'un poste (T8.6). */
public record ApercuPosteDto(
        int annee,
        List<MoisContributionDto> contributions
) {
    public record MoisContributionDto(int mois, BigDecimal contribution) {}
}
