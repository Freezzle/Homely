package ch.homely.moteur;

import ch.homely.poste.NaturePoste;
import ch.homely.poste.TypePoste;

import java.util.UUID;

/**
 * Un événement budgétaire détecté pour un poste à un mois donné (doc 01 — voir
 * {@link MoteurCalcul#evenements(java.util.List, int)}).
 *
 * @param mois                     mois 1..12 auquel l'événement est daté
 * @param type                     type d'événement
 * @param posteId                  id du poste concerné (le nouveau maillon pour REVISION)
 * @param description              libellé du poste
 * @param categorieId              id de catégorie du poste (nullable)
 * @param typePoste                REVENU | CHARGE | RESERVE
 * @param nature                   EFFECTIF | ESTIMATION
 * @param devise                   devise d'origine du poste (avant conversion FX, faite en couche service)
 * @param montantMensualiseDelta   variation du montant mensualisé, signée (+ REVENU, − CHARGE/RESERVE) ;
 *                                 pour REVISION = delta (après − avant) déjà signé ; pour DEBUT/FIN = plein
 *                                 montant mensualisé signé ; {@code 0.0} pour OCCURRENCE.
 * @param montantEcheance          montant réel de l'échéance/occurrence, signé ; utilisé pour
 *                                 DEBUT/FIN/OCCURRENCE et pour l'après-révision (REVISION) ; {@code 0.0}
 *                                 si sans objet (ex. poste MENSUALISE en DEBUT/FIN — dans ce cas seul
 *                                 montantMensualiseDelta est pertinent).
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
        double montantMensualiseDelta,
        double montantEcheance
) {
}
