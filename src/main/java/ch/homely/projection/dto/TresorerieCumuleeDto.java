package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Courbe de trésorerie cumulée d'<b>une année</b>, scopée à un sujet (foyer ou membre) —
 * alimente le graphique "trésorerie cumulée" du dashboard.
 *
 * <p>Chaque valeur {@code [m]} (m = 0..11) est la trésorerie en fin de mois {@code m+1} :
 * amorçage à la trésorerie initiale du scénario (prorata de la quote-part de la période
 * ouverte du membre en vue membre) puis cumul des soldes disponibles mensuels du sujet
 * sur l'année demandée. Deux séries : {@code mensualise} (respecte le {@code mode} des
 * postes) et {@code reel} (échéances imputées au mois d'ancrage).</p>
 *
 * <p><b>Note</b> : la courbe repart de la trésorerie initiale à chaque année (elle n'est
 * pas chaînée entre années — pour le chaînage pluriannuel §4, voir {@link TresorerieDto}).</p>
 *
 * @param annee      année de la courbe
 * @param mensualise 12 valeurs cumulées (fin de mois) — vue mensualisée
 * @param reel       12 valeurs cumulées (fin de mois) — vue réelle (échéances)
 */
public record TresorerieCumuleeDto(
        int annee,
        List<BigDecimal> mensualise,
        List<BigDecimal> reel
) {}
