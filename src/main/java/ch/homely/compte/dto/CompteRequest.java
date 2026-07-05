package ch.homely.compte.dto;

import ch.homely.compte.TypeCompte;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CompteRequest(
        @NotBlank @Size(max = 120) String libelle,
        @NotNull TypeCompte type,
        BigDecimal soldeInitial,
        @Size(min = 3, max = 3) String devise,
        int ordre
) {}
