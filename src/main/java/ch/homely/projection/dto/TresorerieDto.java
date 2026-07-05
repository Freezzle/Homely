package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.List;

/** DTO de réponse pour la trésorerie chaînée pluriannuelle (T8.2). */
public record TresorerieDto(
        List<EntreeTresorerieDto> annees,
        List<MoisCourbeDto> courbe
) {
    public record EntreeTresorerieDto(
            int annee,
            BigDecimal soldeAnnuel,
            BigDecimal tresorerieDebutAnnee,
            BigDecimal tresorerieFinAnnee
    ) {}

    public record MoisCourbeDto(int annee, int mois, BigDecimal tresorerie) {}
}
