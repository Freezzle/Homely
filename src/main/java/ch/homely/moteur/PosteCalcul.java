package ch.homely.moteur;

import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.MomentPeriode;
import ch.homely.poste.TypePoste;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Représentation d'un poste budgétaire passée au moteur de calcul.
 * Aucune dépendance Spring/JPA/horloge.
 *
 * @param id             identifiant du poste (pour le groupement ventilations)
 * @param type           REVENU | CHARGE | RESERVE
 * @param montant        montant brut ≥ 0 (double, fidèle à Excel)
 * @param devise         code ISO devise (ex. "CHF")
 * @param periodiciteMois longueur du cycle en mois (0 traité comme 1)
 * @param debut          début de la fenêtre de validité (null = toujours actif)
 * @param fin            fin de la fenêtre de validité (null = toujours actif)
 * @param mode           MENSUALISE | PERIODIQUE
 * @param moment         DEBUT_PERIODE | FIN_PERIODE (utilisé si mode=PERIODIQUE et D>1)
 * @param repartitions   quotes-parts par membre
 * @param ventilations   compte cible par membre
 * @param categorieId    id de la catégorie (pour les ventilations par catégorie)
 * @param compteSourceId id du compte source pour les postes RESERVE
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
        List<RepartitionCalcul> repartitions,
        List<VentilationCalcul> ventilations,
        UUID categorieId,
        UUID compteSourceId
) {}
