package ch.homely.poste.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/** Requête de clôture rapide d'un poste (action « Terminer »). */
public record PosteClotureRequest(
        @NotNull LocalDate fin
) {}
