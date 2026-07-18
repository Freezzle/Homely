package ch.homely.foyer.dto;

import ch.homely.categorie.TypeCategorie;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * DTO complet pour la création guidée (wizard) d'un foyer.
 * Toutes les entités liées sont créées en une seule transaction.
 * Les membres sont référencés par leur ordre local (index+1) dans la liste.
 */
public record FoyerOnboardingRequest(

        @NotBlank @Size(max = 255)
        String nom,

        @Size(min = 3, max = 3)
        String deviseBase,

        @NotNull @Valid @Size(min = 1, max = 3)
        List<MembreCreation> membres,

        @NotNull @Valid @Size(min = 1, max = 10)
        List<CompteCreation> comptes,

        @NotNull @Valid
        List<CategorieCreation> categories,

        @NotNull @Valid
        ScenarioCreation scenario
) {

    /** Un membre du foyer. L'ordre est déduit de la position dans la liste (index + 1). */
    public record MembreCreation(
            @NotBlank @Size(max = 120)
            String nom,

            @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Couleur hexadécimale invalide (ex. #3B82F6)")
            String couleur
    ) {}

    /**
     * Un compte bancaire.
     * {@code membreOrdres} référence les ordres locaux (1-based) des membres déclarés dans {@code membres}.
     */
    public record CompteCreation(
            @NotBlank @Size(max = 120)
            String libelle,

            BigDecimal soldeInitial,

            @NotEmpty
            List<Integer> membreOrdres
    ) {}

    /** Une catégorie de poste. */
    public record CategorieCreation(
            @NotBlank @Size(max = 120)
            String libelle,

            @NotNull
            TypeCategorie typePoste
    ) {}

    /** Le scénario de référence initial. */
    public record ScenarioCreation(
            @NotBlank @Size(max = 160)
            String nom,

            @Min(2020)
            int anneeDepart,

            BigDecimal tresorerieInitiale,

            @NotEmpty @Valid
            List<RepartitionCreation> repartitions
    ) {}

    /**
     * Quote-part d'un membre dans la répartition du scénario.
     * {@code membreOrdre} est l'ordre local (1-based) du membre.
     */
    public record RepartitionCreation(
            @NotNull
            Integer membreOrdre,

            @NotNull @DecimalMin("0.0") @DecimalMax("1.0")
            BigDecimal quotePart
    ) {}
}

