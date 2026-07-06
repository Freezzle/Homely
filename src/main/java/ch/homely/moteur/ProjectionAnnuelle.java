package ch.homely.moteur;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Résultat de la projection pour une année donnée.
 *
 * @param annee              année concernée
 * @param mois               12 agrégats mensuels FOYER — projection <b>mensualisée</b>
 *                           (respecte le {@code mode} de chaque poste, doc 01 §3.5)
 * @param moisReel           12 agrégats mensuels FOYER — projection <b>réelle</b> :
 *                           tout poste dont {@code periodicité > 1} est imputé au
 *                           montant plein sur son mois d'ancrage, quel que soit son
 *                           {@code mode} (utile pour visualiser les décaissements réels)
 * @param totalAnnuel        somme des 12 mois (FOYER, mensualisée = réelle sur l'année)
 * @param parMembre          agrégats annuels par membre {membreId → total annuel}
 * @param moisParMembre      agrégats mensuels par membre — mensualisés
 * @param moisParMembreReel  agrégats mensuels par membre — réels
 */
public record ProjectionAnnuelle(
        int annee,
        List<AggregatMensuel> mois,
        List<AggregatMensuel> moisReel,
        AggregatMensuel totalAnnuel,
        Map<UUID, AggregatMensuel> parMembre,
        Map<UUID, List<AggregatMensuel>> moisParMembre,
        Map<UUID, List<AggregatMensuel>> moisParMembreReel
) {}
