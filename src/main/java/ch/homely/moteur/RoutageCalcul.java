package ch.homely.moteur;

import java.util.UUID;

/**
 * Compte sur lequel une fraction de la part d'un membre est imputée, pour un poste donné.
 *
 * @param compteId  identifiant du compte
 * @param quotePart fraction de la part du membre imputée sur ce compte, ∈ [0,1]
 *                  (somme = 1 sur l'ensemble des comptes d'un même membre)
 */
public record RoutageCalcul(
        UUID compteId,
        double quotePart
) {}
