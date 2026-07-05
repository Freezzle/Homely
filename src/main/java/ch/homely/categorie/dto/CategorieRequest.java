package ch.homely.categorie.dto;

import ch.homely.categorie.TypeCategorie;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CategorieRequest(
        @NotBlank @Size(max = 120) String libelle,
        @NotNull TypeCategorie typePoste,
        int ordre
) {}
