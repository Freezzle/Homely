package ch.homely.objectif.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ObjectifRequest(
        @NotBlank @Size(max = 160) String libelle,
        UUID categorieProjetId,
        @NotNull @DecimalMin("0.0") BigDecimal montantCible,
        LocalDate echeance,
        /** exactement un des deux doit être renseigné */
        UUID compteId,
        UUID actifId
) {}
