package ch.homely.foyer.dto;

import ch.homely.foyer.RoleFoyer;
import jakarta.validation.constraints.NotNull;

public record ChangerRoleRequest(@NotNull RoleFoyer role) {}
