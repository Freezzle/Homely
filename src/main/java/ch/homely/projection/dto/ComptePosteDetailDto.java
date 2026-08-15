package ch.homely.projection.dto;

import ch.homely.poste.TypePoste;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Détail d'une ligne alimentant un compte (dashboard, vue membre) — poste ou argent de
 * poche — affichée sous forme de liste lorsqu'un compte est sélectionné dans la vue
 * "Virements des comptes" (org-chart hub & rayons).
 *
 * <p>Montant échu de ce mois, déjà proratisé selon la quote-part effective du membre
 * demandé — toujours positif (magnitude), le {@code type} indique le sens (revenu vs
 * charge/réserve). L'argent de poche n'est pas un poste : {@code posteId}/{@code libelle}
 * sont alors {@code null} (le frontend affiche le libellé i18n dédié), {@code quotePart}
 * est {@code null} (pas de notion de prorata pour l'argent de poche) et {@code type} vaut
 * toujours {@code CHARGE} — elle est comptée comme une dépense, pas un revenu (voir
 * {@link ch.homely.projection.ComptesFluxSimulateur}).</p>
 *
 * @param posteId    identifiant du poste, {@code null} si {@code argentPoche}
 * @param libelle    libellé du poste, {@code null} si {@code argentPoche}
 * @param type       REVENU | CHARGE | RESERVE
 * @param argentPoche vrai si cette ligne représente l'argent de poche crédité sur ce
 *                    compte plutôt qu'un poste
 * @param montant    montant échu (positif), part du membre déjà proratisée
 * @param quotePart  quote-part effective (∈]0,1]) appliquée à {@code montant}, {@code null}
 *                   pour l'argent de poche
 */
public record ComptePosteDetailDto(
        UUID posteId,
        String libelle,
        TypePoste type,
        boolean argentPoche,
        BigDecimal montant,
        BigDecimal quotePart
) {}
