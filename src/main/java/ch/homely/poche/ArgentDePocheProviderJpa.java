package ch.homely.poche;

import ch.homely.moteur.ArgentDePocheProvider;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Pont Spring entre le service métier {@link ArgentPocheService} et l'interface
 * pure {@link ArgentDePocheProvider} du moteur.
 *
 * <p>Cette classe est construite à la volée dans
 * {@code ProjectionService#buildParametres(...)} avec un {@code scenarioId} déjà
 * résolu, puis passée au constructeur de {@code ParametresScenario}. Le moteur
 * l'appelle sans savoir qu'elle est câblée à Spring/JPA.</p>
 *
 * <p>Note : l'instance est <b>par-scénario</b> — ne pas la marquer singleton
 * globale sans revoir le contrat. On la crée à la demande via
 * {@link ArgentDePocheProviderFactory}.</p>
 */
public final class ArgentDePocheProviderJpa implements ArgentDePocheProvider {

    private final ArgentPocheService service;
    private final UUID scenarioId;

    ArgentDePocheProviderJpa(ArgentPocheService service, UUID scenarioId) {
        this.service    = service;
        this.scenarioId = scenarioId;
    }

    @Override
    public double montant(UUID membreId, int annee, int mois, double ravBrut) {
        return service.resoudre(
                scenarioId, membreId, java.time.YearMonth.of(annee, mois), ravBrut
        ).montant();
    }

    /**
     * Fabrique d'instances liées à un scénario. Injectée dans les services qui
     * construisent des {@link ch.homely.moteur.ParametresScenario}.
     */
    @Component
    public static class ArgentDePocheProviderFactory {

        private final ArgentPocheService service;

        public ArgentDePocheProviderFactory(ArgentPocheService service) {
            this.service = service;
        }

        public ArgentDePocheProvider pourScenario(UUID scenarioId) {
            return new ArgentDePocheProviderJpa(service, scenarioId);
        }
    }
}
