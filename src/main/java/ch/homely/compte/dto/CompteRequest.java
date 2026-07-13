package ch.homely.compte.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;

public record CompteRequest(
        @NotBlank @Size(max = 120) String libelle,
        BigDecimal soldeInitial,
        @Size(min = 3, max = 3) String devise,
        int ordre,
        @NotEmpty Set<UUID> membreIds
) {}
