package ch.homely.poste.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

/** Requête de suppression groupée de postes par leurs identifiants. */
public record PosteSuppressionGroupeeRequest(
        @NotEmpty List<UUID> ids
) {}
