package ch.homely.poche.dto;

import ch.homely.poche.SourceArgentPoche;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Résolution d'argent de poche d'un membre pour un mois donné, dans le
 * contexte de l'agrégat foyer (voir {@link ResolutionArgentPocheFoyerMoisDto}).
 */
public record ResolutionArgentPocheMembreMoisDto(
        UUID membreId,
        BigDecimal montant,
        SourceArgentPoche source
) {}
