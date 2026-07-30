package ch.homely.moteur;

import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.NaturePoste;
import ch.homely.poste.TypePoste;

import java.util.UUID;

/**
 * Un événement budgétaire ("ce qui change") détecté pour un poste (doc 01 — voir
 * {@link MoteurCalcul#evenements(java.util.List, int)}).
 *
 * <p>Le montant est transporté <b>brut</b> (non mensualisé) : c'est à la couche
 * d'affichage (voir {@code periodiciteMois}/{@code mode}) de le formater — le moteur ne
 * fait aucun formatage de texte.</p>
 *
 * @param mois            mois 1..12 auquel l'événement est daté
 * @param type             type d'événement (DEBUT, FIN, REVISION)
 * @param posteId          id du poste concerné (le nouveau maillon pour REVISION)
 * @param description      libellé du poste
 * @param categorieId      id de catégorie du poste (nullable)
 * @param typePoste        REVENU | CHARGE | RESERVE
 * @param nature           EFFECTIF | ESTIMATION
 * @param devise           devise d'origine du poste (avant conversion FX, faite en couche service)
 * @param montant              montant signé (+ REVENU, − CHARGE/RESERVE) ; plein montant du poste pour
 *                             DEBUT/FIN, delta (après − avant) pour REVISION — toujours brut, non mensualisé
 * @param periodiciteMois      périodicité du poste concerné (successeur pour REVISION), pour l'affichage
 * @param mode                 MENSUALISE | PERIODIQUE du poste concerné, pour l'affichage
 * @param montantOrigine       uniquement pour REVISION (origine résolue) : montant signé du poste
 *                             d'origine (même convention que {@code montant}) ; {@code null} sinon
 * @param periodiciteMoisOrigine uniquement pour REVISION : périodicité du poste d'origine ; {@code null} sinon
 * @param modeOrigine          uniquement pour REVISION : mode du poste d'origine ; {@code null} sinon
 */
public record EvenementCalcul(
        int mois,
        TypeEvenement type,
        UUID posteId,
        String description,
        UUID categorieId,
        TypePoste typePoste,
        NaturePoste nature,
        String devise,
        double montant,
        int periodiciteMois,
        ModeComptabilisation mode,
        Double montantOrigine,
        Integer periodiciteMoisOrigine,
        ModeComptabilisation modeOrigine
) {
}
