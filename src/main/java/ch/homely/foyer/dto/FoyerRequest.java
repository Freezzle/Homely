package ch.homely.foyer.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record FoyerRequest(
        @NotBlank @Size(max = 255) String nom,
        @Size(min = 3, max = 3) String deviseBase,
        @Valid List<MembreCreationRequest> membres
) {
    public record MembreCreationRequest(
            @NotBlank @Size(max = 120) String nom,
            @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Couleur hexadécimale invalide (ex. #3B82F6)")
            String couleur
    ) {}
}
