package ch.homely.projection.dto;

import ch.homely.poste.TypePoste;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Une ligne de la composition d'un virement inter-comptes simulé — « de quoi est fait ce
 * virement ». Affichée dans la popin ouverte depuis une ligne de destination du dashboard
 * "Virements des comptes" (carte et drawer).
 *
 * <p>Le montant est toujours <b>positif</b> (magnitude) ; la somme des lignes d'un virement
 * égale le montant de ce virement. Toutes les lignes ne sont pas rattachables à un poste :</p>
 * <ul>
 *   <li>{@link OrigineVirement#POSTE} : {@code posteId}/{@code libelle} renseignés ;</li>
 *   <li>{@link OrigineVirement#ARGENT_POCHE} : argent de poche versé au membre — ce n'est pas
 *       un poste, {@code posteId}/{@code libelle}/{@code categorieId} sont {@code null} et le
 *       frontend affiche un libellé i18n dédié ;</li>
 *   <li>{@link OrigineVirement#COMBLEMENT_TRESORERIE} : part du virement qui ne finance aucun
 *       poste de ce mois mais comble le découvert du compte destination (mêmes champs à
 *       {@code null}).</li>
 * </ul>
 *
 * @param posteId        poste à l'origine de la ligne, {@code null} hors origine POSTE
 * @param libelle        libellé du poste, {@code null} hors origine POSTE
 * @param categorieId    catégorie du poste, {@code null} si non catégorisé ou hors origine POSTE
 * @param categorieNom   libellé de la catégorie, {@code null} si non catégorisé ou hors origine POSTE
 * @param type           REVENU | CHARGE | RESERVE du poste ; CHARGE pour l'argent de poche et
 *                       le comblement de trésorerie
 * @param origine        nature de la ligne
 * @param montant        part de cette ligne dans le virement (positive)
 */
public record VirementDetailLigneDto(
        UUID posteId,
        String libelle,
        UUID categorieId,
        String categorieNom,
        TypePoste type,
        OrigineVirement origine,
        BigDecimal montant
) {}
