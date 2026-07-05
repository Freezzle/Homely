package ch.homely.moteur;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Paramètres d'entrée complets d'un scénario passés au moteur.
 *
 * @param deviseBase          devise de base du foyer (ex. "CHF")
 * @param anneeDepart         première année de la projection
 * @param tresorerieInitiale  trésorerie au 1er janvier de anneeDepart (T0)
 * @param horizonAnnees       nombre d'années à projeter
 * @param repartitionDefaut   quotes-parts par défaut {membreId → quotePart}
 * @param taux                taux de conversion vers deviseBase {devise → tauxVersBase}
 * @param postes              liste des postes du scénario
 * @param membres             liste des identifiants de membres actifs
 */
public record ParametresScenario(
        String deviseBase,
        int anneeDepart,
        double tresorerieInitiale,
        int horizonAnnees,
        List<RepartitionCalcul> repartitionDefaut,
        Map<String, Double> taux,
        List<PosteCalcul> postes,
        List<UUID> membres
) {}
