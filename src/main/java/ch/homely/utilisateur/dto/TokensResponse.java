package ch.homely.utilisateur.dto;

/** Réponse après login ou refresh (tokens + infos utilisateur). */
public record TokensResponse(
        String accessToken,
        String refreshToken,
        long expiresIn,
        UtilisateurDto utilisateur
) {}
