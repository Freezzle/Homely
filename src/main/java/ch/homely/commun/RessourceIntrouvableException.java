package ch.homely.commun;

/** Levée quand une ressource est introuvable ou hors périmètre (HTTP 404). */
public class RessourceIntrouvableException extends RuntimeException {
    public RessourceIntrouvableException(String message) {
        super(message);
    }
}
