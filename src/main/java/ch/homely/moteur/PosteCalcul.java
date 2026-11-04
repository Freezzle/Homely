package ch.homely.moteur;

import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.MomentPeriode;
import ch.homely.poste.NaturePoste;
import ch.homely.poste.TypePoste;
import ch.homely.poste.TypeRepartition;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Représentation d'un poste budgétaire passée au moteur de calcul.
 * Aucune dépendance Spring/JPA/horloge.
 *
 * @param id              identifiant du poste (pour le groupement ventilations)
 * @param type            REVENU | CHARGE | RESERVE
 * @param montant         montant brut ≥ 0 (double, fidèle à Excel)
 * @param devise          code ISO devise (ex. "CHF")
 * @param periodiciteMois longueur du cycle en mois (0 traité comme 1)
 * @param debut           début de la fenêtre de validité (null = toujours actif)
 * @param fin             fin de la fenêtre de validité (null = toujours actif)
 * @param mode            MENSUALISE | PERIODIQUE
 * @param moment          DEBUT_PERIODE | FIN_PERIODE (utilisé si mode=PERIODIQUE et D>1)
 *                        ou INCONNU (date de paiement effective inconnue — impose
 *                        mode=MENSUALISE et lisse aussi la contribution "réelle")
 * @param nature          EFFECTIF | ANTICIPE — descriptif ; n'altère pas les calculs
 * @param typeRepartition AUTO | REVERSE_AUTO | CUSTOM (null → AUTO)
 * @param repartitions    quotes-parts par membre (utilisé uniquement si typeRepartition=CUSTOM)
 * @param ventilations    comptes contreparties par membre, avec leur quote-part (routage)
 * @param categorieId     id de la catégorie (pour les ventilations par catégorie)
 * @param posteOrigineId  id du poste dont ce poste est issu par révision de montant planifiée
 *                        (null si ce poste n'appartient pas à une chaîne de révisions).
 *                        Transporté uniquement pour {@link #evenements(List, int)} — n'altère
 *                        aucun autre calcul.
 * @param description     libellé du poste (descriptif uniquement, pour {@link #evenements(List, int)})
 * @param inclureProrataTheorique prise en compte du poste (si {@code type=REVENU}) dans le calcul
 *                        du prorata théorique des membres — voir
 *                        {@link ch.homely.projection.ProjectionService#prorataPartage}. Sans effet
 *                        pour les postes {@code CHARGE}/{@code RESERVE}. Défaut {@code true}.
 * @param comptePivotId   compte où la transaction a physiquement lieu : débité pour une
 *                        {@code CHARGE}/{@code RESERVE}, crédité pour un {@code REVENU}.
 *                        Quand il est renseigné, <b>toute</b> la contribution du poste est
 *                        imputée sur ce compte (les {@code ventilations} ne servent alors
 *                        qu'à déterminer les virements inter-comptes, en couche service).
 *                        {@code null} = mode hérité : la part de chaque membre est imputée
 *                        directement sur ses comptes de {@code ventilations}.
 */
public record PosteCalcul(
        UUID id,
        TypePoste type,
        double montant,
        String devise,
        int periodiciteMois,
        LocalDate debut,
        LocalDate fin,
        ModeComptabilisation mode,
        MomentPeriode moment,
        NaturePoste nature,
        TypeRepartition typeRepartition,
        List<RepartitionCalcul> repartitions,
        List<VentilationCalcul> ventilations,
        UUID categorieId,
        UUID posteOrigineId,
        String description,
        boolean inclureProrataTheorique,
        UUID comptePivotId
) {
    /** Compact constructor : defaults {@code nature} → EFFECTIF, {@code typeRepartition} → AUTO. */
    public PosteCalcul {
        if (nature == null) nature = NaturePoste.EFFECTIF;
        if (typeRepartition == null) typeRepartition = TypeRepartition.AUTO;
    }

    /**
     * Constructeur de compatibilité (sans {@code comptePivotId}, défaut {@code null} = mode
     * hérité d'imputation directe sur les comptes de {@code ventilations}).
     */
    public PosteCalcul(UUID id, TypePoste type, double montant, String devise, int periodiciteMois,
                        LocalDate debut, LocalDate fin, ModeComptabilisation mode, MomentPeriode moment,
                        NaturePoste nature, TypeRepartition typeRepartition,
                        List<RepartitionCalcul> repartitions, List<VentilationCalcul> ventilations,
                        UUID categorieId, UUID posteOrigineId, String description,
                        boolean inclureProrataTheorique) {
        this(id, type, montant, devise, periodiciteMois, debut, fin, mode, moment, nature,
                typeRepartition, repartitions, ventilations, categorieId, posteOrigineId, description,
                inclureProrataTheorique, null);
    }

    /**
     * Constructeur de compatibilité (sans {@code inclureProrataTheorique}, défaut {@code true}) —
     * conservé pour ne pas casser les tests existants qui construisent un {@code PosteCalcul}
     * sans ce champ.
     */
    public PosteCalcul(UUID id, TypePoste type, double montant, String devise, int periodiciteMois,
                        LocalDate debut, LocalDate fin, ModeComptabilisation mode, MomentPeriode moment,
                        NaturePoste nature, TypeRepartition typeRepartition,
                        List<RepartitionCalcul> repartitions, List<VentilationCalcul> ventilations,
                        UUID categorieId, UUID posteOrigineId, String description) {
        this(id, type, montant, devise, periodiciteMois, debut, fin, mode, moment, nature,
                typeRepartition, repartitions, ventilations, categorieId, posteOrigineId, description,
                true, null);
    }

    /**
     * Constructeur de compatibilité (sans {@code posteOrigineId}/{@code description}/
     * {@code inclureProrataTheorique}/{@code comptePivotId}) — conservé pour ne pas casser les
     * tests existants qui construisent un {@code PosteCalcul} sans ces champs descriptifs.
     */
    public PosteCalcul(UUID id, TypePoste type, double montant, String devise, int periodiciteMois,
                        LocalDate debut, LocalDate fin, ModeComptabilisation mode, MomentPeriode moment,
                        NaturePoste nature, TypeRepartition typeRepartition,
                        List<RepartitionCalcul> repartitions, List<VentilationCalcul> ventilations,
                        UUID categorieId) {
        this(id, type, montant, devise, periodiciteMois, debut, fin, mode, moment, nature,
                typeRepartition, repartitions, ventilations, categorieId, null, null, true, null);
    }
}
