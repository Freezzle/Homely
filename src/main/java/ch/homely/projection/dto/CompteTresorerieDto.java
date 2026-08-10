package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Timeline de trésorerie cumulée d'un compte (dashboard, vue membre) — utilisée pour le
 * mini-graphique linéaire des 3 derniers mois + mois courant.
 *
 * @param compteId      identifiant du compte
 * @param libelleCompte libellé du compte
 * @param points        points de la timeline, triés par (annee, mois) croissant
 */
public record CompteTresorerieDto(
        UUID compteId,
        String libelleCompte,
        List<PointTresorerieDto> points
) {
    /** @param tresorerieCumulee soldeInitial(compte) + Σ des soldes restants mensuels depuis l'origine du scénario */
    public record PointTresorerieDto(int annee, int mois, BigDecimal tresorerieCumulee) {}
}
