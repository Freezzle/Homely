package ch.homely.utilisateur.dto;

/**
 * Réponse HTTP exposée par les endpoints login/refresh : contrairement à
 * {@link TokensResponse}, elle n'expose jamais le refresh token dans le corps
 * JSON — celui-ci est transmis exclusivement via un cookie httpOnly/Secure
 * (voir {@code AuthController}), afin de ne pas être accessible en
 * JavaScript (protection XSS).
 */
public record AuthResponse(
        String accessToken,
        long expiresIn,
        UtilisateurDto utilisateur
) {
    public static AuthResponse from(TokensResponse tokens) {
        return new AuthResponse(tokens.accessToken(), tokens.expiresIn(), tokens.utilisateur());
    }
}
