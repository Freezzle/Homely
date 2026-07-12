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
        /** Rétro-compat : répartitions de la période ouverte (pour le bouton "Par défaut" dans postes). */
        List<RepartitionDefautDto> repartitions,
        /** Liste complète des périodes de répartition (ordonnées par début). */
        List<RepartitionPeriodeDto> periodes,
        Instant dateModification
) {
    public record RepartitionDefautDto(UUID membreId, String nomMembre, BigDecimal quotePart) {}
}
