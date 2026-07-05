package ch.homely.foyer.dto;

import ch.homely.foyer.RoleFoyer;
import java.util.UUID;

public record AccesFoyerDto(UUID id, UUID utilisateurId, String email, String nomComplet, RoleFoyer role) {}
