package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

/**
 * DTO de réponse pour la décomposition annuelle agrégée (somme des 12 mois), calculée en
 * une seule requête serveur — évite au frontend de faire 12 appels {@code /mensuelle} pour
 * obtenir les décompositions par catégorie / compte / membre sur une année complète.
 *
 * <p>Même forme que {@link VentilationsDto} (sans le champ {@code mois}, puisqu'il s'agit
 * d'une somme sur l'année entière).
 */
public record VentilationAnnuelleDto(
        int annee,
        AggregatDto agregat,
        Map<UUID, AggregatDto> parMembre,
        Map<UUID, BigDecimal> parCategorie,
        Map<UUID, Map<UUID, BigDecimal>> parCategorieMembre,
        Map<UUID, Map<UUID, BigDecimal>> parCompteMembre,
        Map<UUID, SplitDto> parMembreSplit
) {
    /** Agrégat foyer ou membre pour l'année entière. */
    public record AggregatDto(
            BigDecimal revenus,
            BigDecimal charges,
            BigDecimal reserves,
            BigDecimal soldeDisponible
    ) {}

    /** Décomposition perso / partagé d'un membre pour l'année entière, par type de poste. */
    public record SplitDto(
            BigDecimal revenusPerso,
            BigDecimal revenusPartage,
            BigDecimal chargesPerso,
            BigDecimal chargesPartage,
            BigDecimal reservesPerso,
            BigDecimal reservesPartage
    ) {}
}
