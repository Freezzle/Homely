package ch.homely.moteur;

import ch.homely.poste.TypePoste;

import java.util.UUID;

/**
 * Détail de la contribution échue d'un poste sur un compte donné, pour un membre et un
 * mois donnés — montant déjà proratisé (quote-part effective déjà appliquée) et converti
 * dans la devise du foyer. Alimente la liste des postes affichée lorsqu'un compte est
 * sélectionné dans la vue "Virements des comptes" du dashboard.
 *
 * @param posteId   id du poste
 * @param libelle   description/libellé du poste
 * @param type      REVENU | CHARGE | RESERVE
 * @param montant   montant échu (≥ 0), part du membre déjà proratisée
 * @param quotePart quote-part effective (∈]0,1]) appliquée à {@code montant}
 */
public record PosteContributionDetail(
        UUID posteId,
        String libelle,
        TypePoste type,
        double montant,
        double quotePart
) {}
