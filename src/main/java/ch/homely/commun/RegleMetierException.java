package ch.homely.commun;

/** Levée lors d'une violation de règle métier (HTTP 422). */
public class RegleMetierException extends RuntimeException {

    private final String code;

    public RegleMetierException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() { return code; }
}
