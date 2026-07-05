package ch.homely.foyer.dto;

import ch.homely.foyer.RoleFoyer;
import java.util.UUID;

public record FoyerDto(UUID id, String nom, String deviseBase, RoleFoyer monRole) {}
