package ch.homely.moteur;

import java.util.UUID;

/**
 * Ventilation d'un poste vers un compte pour un membre donné.
 *
 * @param membreId  identifiant du membre
 * @param compteId  identifiant du compte cible
 */
public record VentilationCalcul(
        UUID membreId,
        UUID compteId
) {}
