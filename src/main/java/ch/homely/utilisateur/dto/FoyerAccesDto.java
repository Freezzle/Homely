package ch.homely.utilisateur.dto;

import ch.homely.foyer.RoleFoyer;
import java.util.UUID;

/** Résumé d'un foyer accessible à l'utilisateur courant (pour GET /auth/moi). */
public record FoyerAccesDto(UUID foyerId, String nom, RoleFoyer role) {}
