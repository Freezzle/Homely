package ch.homely.commun;

/** Levée lors d'un conflit (HTTP 409 — ex. 2e scénario de référence). */
public class ConflitException extends RuntimeException {

    private final String code;

    public ConflitException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() { return code; }
}
