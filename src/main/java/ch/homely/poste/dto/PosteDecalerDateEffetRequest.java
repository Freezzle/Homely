package ch.homely.poste.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/** Requête de déplacement de la date d'effet entre un maillon et son prédécesseur. */
public record PosteDecalerDateEffetRequest(
        @NotNull LocalDate nouvelleDateEffet
) {}
