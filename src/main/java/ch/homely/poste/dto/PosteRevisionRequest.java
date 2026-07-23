package ch.homely.poste.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Requête de révision de montant planifiée d'un poste récurrent. */
public record PosteRevisionRequest(
        @NotNull @Positive BigDecimal nouveauMontant,
        @NotNull LocalDate dateEffet
) {}
