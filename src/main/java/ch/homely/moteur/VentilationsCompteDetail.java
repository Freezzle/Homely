package ch.homely.moteur;

import java.util.Map;
import java.util.UUID;

/**
 * Ventilation détaillée par (compte, membre) pour un mois donné — extension de
 * {@link Ventilations#parCompteMembre()} qui sépare mensualisé/échu et revenus/sorties
 * (cf. {@link DetailCompteMembre}). Alimente le récapitulatif mensuel par compte du
 * dashboard (vue membre).
 *
 * @param annee           année du mois
 * @param mois            numéro du mois (1-12)
 * @param parCompteMembre détail par (compteId, membreId) {compteId → {membreId → détail}}
 */
public record VentilationsCompteDetail(
        int annee,
        int mois,
        Map<UUID, Map<UUID, DetailCompteMembre>> parCompteMembre
) {}
