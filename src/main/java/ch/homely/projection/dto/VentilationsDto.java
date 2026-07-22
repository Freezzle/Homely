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
        Map<UUID, Map<UUID, BigDecimal>> parCompteMembre,
        Map<UUID, SplitDto> parMembreSplit
) {
    /** Agrégat foyer ou membre pour un mois donné. */
    public record AggregatDto(
            BigDecimal revenus,
            BigDecimal charges,
            BigDecimal reserves,
            BigDecimal soldeDisponible
    ) {}

    /**
     * Décomposition perso / partagé d'un membre pour un mois donné, par type de poste.
     * {@code xxxPerso + xxxPartage} égale exactement le champ correspondant de
     * {@link AggregatDto} (aucune approximation).
     */
    public record SplitDto(
            BigDecimal revenusPerso,
            BigDecimal revenusPartage,
            BigDecimal chargesPerso,
            BigDecimal chargesPartage,
            BigDecimal reservesPerso,
            BigDecimal reservesPartage
    ) {}
}

