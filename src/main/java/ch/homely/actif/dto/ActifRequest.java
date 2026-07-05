package ch.homely.actif.dto;

import ch.homely.actif.TypeActif;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ActifRequest(
        @NotBlank @Size(max = 120) String libelle,
        @NotNull TypeActif typeActif,
        BigDecimal soldeInitial,
        @Size(min = 3, max = 3) String devise,
        BigDecimal tauxCroissanceAnnuel,
        int ordre
) {}
