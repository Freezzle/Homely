package ch.homely.moteur;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Résultat de la projection pour une année donnée.
 *
 * @param annee         année concernée
 * @param mois          liste des 12 agrégats mensuels (périmètre FOYER)
 * @param totalAnnuel   somme des 12 mois (FOYER)
 * @param parMembre     agrégats annuels par membre {membreId → total annuel}
 * @param moisParMembre agrégats mensuels par membre {membreId → [12 mois]}
 */
public record ProjectionAnnuelle(
        int annee,
        List<AggregatMensuel> mois,
        AggregatMensuel totalAnnuel,
        Map<UUID, AggregatMensuel> parMembre,
        Map<UUID, List<AggregatMensuel>> moisParMembre
) {}
