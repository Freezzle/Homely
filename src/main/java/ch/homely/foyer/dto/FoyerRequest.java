package ch.homely.foyer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FoyerRequest(
        @NotBlank @Size(max = 255) String nom,
        @Size(min = 3, max = 3) String deviseBase
) {}
