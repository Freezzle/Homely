package ch.homely.membre.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record MembreRequest(
        @NotBlank @Size(max = 120) String nom,
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Couleur hexadécimale invalide (ex. #3B82F6)")
        String couleur,
        int ordre
) {}
