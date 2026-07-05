package ch.homely.moteur;

import java.util.UUID;

/**
 * Quote-part d'un membre dans un poste (ou dans la répartition défaut du scénario).
 *
 * @param membreId  identifiant du membre
 * @param quotePart part ∈ [0,1] ; la somme de toutes les parts d'un poste/scénario doit valoir 1
 */
public record RepartitionCalcul(
        UUID membreId,
        double quotePart
) {}
