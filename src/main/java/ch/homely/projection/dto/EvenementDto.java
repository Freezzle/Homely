package ch.homely.projection.dto;

import ch.homely.moteur.TypeEvenement;
import ch.homely.poste.NaturePoste;
import ch.homely.poste.TypePoste;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Un événement budgétaire ("ce qui change") pour le dashboard annuel/mensuel :
 * début, fin, révision de montant ou occurrence réelle d'un poste, converti en devise
 * du foyer.
 */
public record EvenementDto(
        int mois,
        TypeEvenement type,
        UUID posteId,
        String description,
        UUID categorieId,
        TypePoste typePoste,
        NaturePoste nature,
        BigDecimal montantMensualiseDelta,
        BigDecimal montantEcheance
) {}
