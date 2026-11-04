package ch.homely.moteur;

import ch.homely.poste.TypePoste;

import java.util.UUID;

/**
 * Part d'un poste <b>imputée</b> sur un compte donné, pour un membre et un mois donnés —
 * montant déjà proratisé (quote-part effective appliquée) et converti dans la devise du
 * foyer. Désagrégation poste par poste de
 * {@link MoteurCalcul#ventilationsCompteMembreDetail}, qui permet de remonter en couche
 * service la composition d'un virement inter-comptes simulé.
 *
 * @param posteId    id du poste
 * @param libelle    description/libellé du poste
 * @param categorieId catégorie du poste ({@code null} si non catégorisé)
 * @param type       REVENU | CHARGE | RESERVE
 * @param mensualise part selon la vision mensualisée ({@code contribution})
 * @param echu       part selon la vision échue ({@code contributionReelle})
 */
public record PosteImputationDetail(
        UUID posteId,
        String libelle,
        UUID categorieId,
        TypePoste type,
        double mensualise,
        double echu
) {}
