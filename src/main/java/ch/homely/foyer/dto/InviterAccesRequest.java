package ch.homely.foyer.dto;

import ch.homely.foyer.RoleFoyer;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record InviterAccesRequest(
        @Email @NotBlank String email,
        @NotNull RoleFoyer role
) {}
