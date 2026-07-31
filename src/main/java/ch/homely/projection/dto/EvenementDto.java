package ch.homely.projection.dto;

import ch.homely.moteur.TypeEvenement;
import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.NaturePoste;
import ch.homely.poste.TypePoste;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Un événement budgétaire ("ce qui change") pour le dashboard annuel/mensuel :
 * début, fin ou révision de montant d'un poste, converti en devise du foyer.
 *
 * <p>{@code montant} est brut (non mensualisé) — la couche d'affichage le formate selon
 * {@code periodiciteMois}/{@code mode} (ex. "-1000/mois", "-30/3mois", "2000/ponctuel").</p>
 *
 * <p>Pour une REVISION, {@code montantOrigine}/{@code periodiciteMoisOrigine}/
 * {@code modeOrigine} portent les valeurs du poste d'origine (avant révision), permettant
 * à la couche d'affichage de construire un rendu "avant → après" ; {@code null} pour
 * DEBUT/FIN.</p>
 *
 * <p>{@code quotePart} : quote-part effective (∈]0,1]) du membre demandé (voir
 * {@code ?membreId=} sur l'endpoint), déjà appliquée à {@code montant}/{@code montantOrigine}
 * — calculée côté backend via {@link ch.homely.moteur.MoteurCalcul#quotePartEffective}
 * (jamais recalculée côté frontend). Vaut {@code 1} quand aucun membre n'est demandé
 * (vue foyer).</p>
 */
public record EvenementDto(
        int mois,
        TypeEvenement type,
        UUID posteId,
        String description,
        UUID categorieId,
        TypePoste typePoste,
        NaturePoste nature,
        BigDecimal montant,
        int periodiciteMois,
        ModeComptabilisation mode,
        BigDecimal montantOrigine,
        Integer periodiciteMoisOrigine,
        ModeComptabilisation modeOrigine,
        BigDecimal quotePart
) {}
