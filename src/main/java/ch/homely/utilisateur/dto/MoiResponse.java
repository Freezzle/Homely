package ch.homely.utilisateur.dto;

import java.util.List;

/** Réponse de GET /api/auth/moi. */
public record MoiResponse(UtilisateurDto utilisateur, List<FoyerAccesDto> foyers) {}
