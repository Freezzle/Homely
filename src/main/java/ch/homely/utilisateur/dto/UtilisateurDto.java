package ch.homely.utilisateur.dto;

import java.util.UUID;

public record UtilisateurDto(UUID id, String email, String nomComplet) {}
