package ch.homely.poche.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

public record AllocationArgentPocheRequest(
        @NotNull UUID membreId,

        /**
         * Compte source finançant ce versement ponctuel. Null → résolu par le serveur
         * (compte primaire du membre, sinon 1re contrepartie, sinon 1er compte actif).
         */
        UUID comptePivotId,

        /** Comptes de poche crédités ; somme des quotes-parts = 1 (validée en service). */
        @NotEmpty @Valid List<LigneRoutagePocheDto> routage,

        @NotNull YearMonth mois,
        @NotNull @DecimalMin("0.0") BigDecimal montant,
        @Size(max = 255) String raison
) {}
