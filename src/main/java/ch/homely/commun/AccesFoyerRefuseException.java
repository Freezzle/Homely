package ch.homely.commun;

/** Levée quand un utilisateur tente d'accéder à un foyer auquel il n'appartient pas (HTTP 403). */
public class AccesFoyerRefuseException extends RuntimeException {
    public AccesFoyerRefuseException(Object foyerId) {
        super("Accès refusé au foyer : " + foyerId);
    }
}
