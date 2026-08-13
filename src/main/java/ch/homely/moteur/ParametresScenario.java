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
 * @param periodesDefaut      fenêtres temporelles de répartition par défaut, triées par début
 * @param taux                taux de conversion vers deviseBase {devise → tauxVersBase}
 * @param postes              liste des postes du scénario
 * @param membres             liste des identifiants de membres actifs (période ouverte)
 * @param argentDePoche       fournisseur du montant d'argent de poche par membre/mois ;
 *                            {@link ArgentDePocheProvider#AUCUN} par défaut (aucun impact)
 */
public record ParametresScenario(
        String deviseBase,
        int anneeDepart,
        double tresorerieInitiale,
        int horizonAnnees,
        List<RepartitionPeriodeCalcul> periodesDefaut,
        Map<String, Double> taux,
        List<PosteCalcul> postes,
        List<UUID> membres,
        ArgentDePocheProvider argentDePoche
) {
    /**
     * Constructeur canonique — normalise {@code argentDePoche == null} vers
     * {@link ArgentDePocheProvider#AUCUN} pour garantir qu'aucun appel du moteur
     * ne rencontre un provider nul.
     */
    public ParametresScenario {
        if (argentDePoche == null) {
            argentDePoche = ArgentDePocheProvider.AUCUN;
        }
    }

    /**
     * Constructeur de compatibilité (avant l'introduction de l'argent de poche) —
     * utilisé par les vecteurs golden et par tout appelant qui n'a pas besoin
     * du provider. Délègue au canonique avec {@link ArgentDePocheProvider#AUCUN}.
     */
    public ParametresScenario(
            String deviseBase,
            int anneeDepart,
            double tresorerieInitiale,
            int horizonAnnees,
            List<RepartitionPeriodeCalcul> periodesDefaut,
            Map<String, Double> taux,
            List<PosteCalcul> postes,
            List<UUID> membres) {
        this(deviseBase, anneeDepart, tresorerieInitiale, horizonAnnees,
             periodesDefaut, taux, postes, membres, ArgentDePocheProvider.AUCUN);
    }
}
