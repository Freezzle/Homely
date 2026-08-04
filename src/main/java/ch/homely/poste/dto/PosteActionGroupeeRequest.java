package ch.homely.poste.dto;

import ch.homely.poste.ChampGroupable;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/**
 * Requête de mise à jour groupée : applique la même valeur d'un unique champ
 * descriptif (catégorie, importance ou potentiel d'optimisation) à une liste de postes.
 * Seul le champ correspondant à {@code champ} est pris en compte ; les autres sont ignorés.
 */
public record PosteActionGroupeeRequest(
        @NotEmpty List<UUID> ids,
        @NotNull ChampGroupable champ,
        UUID categorieId,                 // requis si champ=CATEGORIE (null = désélection autorisée)
        @Min(1) @Max(5) Integer importance,               // requis si champ=IMPORTANCE
        @Min(1) @Max(5) Integer potentielOptimisation      // requis si champ=POTENTIEL_OPTIMISATION
) {}
