package ch.homely.commun;

/** Levée quand un JWT est invalide ou expiré (HTTP 401). */
public class TokenInvalideException extends RuntimeException {
    public TokenInvalideException(String message) {
        super(message);
    }
}
