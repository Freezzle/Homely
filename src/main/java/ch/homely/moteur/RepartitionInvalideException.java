package ch.homely.moteur;

/**
 * Levée lorsque la somme des quotes-parts d'une répartition n'est pas égale à 1
 * (tolérance ±1e-6). Correspond au code métier {@code REPARTITION_INVALIDE} (HTTP 422).
 */
public class RepartitionInvalideException extends RuntimeException {

    private final double sommeTrouvee;

    public RepartitionInvalideException(double sommeTrouvee) {
        super("La somme des quotes-parts doit valoir 1 (obtenu %.6f)".formatted(sommeTrouvee));
        this.sommeTrouvee = sommeTrouvee;
    }

    public double getSommeTrouvee() {
        return sommeTrouvee;
    }
}
