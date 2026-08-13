package ch.homely.poste.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Répartition des charges du foyer (ou d'un membre) entre "Besoins" et "Plaisirs" pour
 * une période donnée (mois ou année) — indicateur dashboard "Plaisirs vs Besoins".
 *
 * <p>Basé sur le champ {@code necessite} de chaque poste CHARGE (1 non nécessaire à 5
 * nécessaire, cf. {@link PosteDto#importance()}) : {@code necessite} 1 à 3 → Plaisirs,
 * 4 à 5 → Besoins. Le taux de plaisirs (et sa couleur) est calculé côté frontend à
 * partir de ces deux montants, comme {@code TauxEffortCardComponent} le fait pour le
 * taux d'effort — aucun taux pré-calculé ici.</p>
 *
 * @param montantBesoins  somme des contributions réelles (fenêtre de validité, prorata,
 *                        quote-part membre le cas échéant) des postes CHARGE de
 *                        nécessité 4-5, sur la période demandée.
 * @param montantPlaisirs somme équivalente pour les postes CHARGE de nécessité 1-3.
 * @param postesBesoins   détail des postes classés "Besoin" (nécessité 4-5) sur la
 *                        période, triés par montant décroissant — affiché sous les
 *                        stats du drawer "Plaisirs vs Besoins".
 */
public record BesoinsPlaisirsDto(BigDecimal montantBesoins, BigDecimal montantPlaisirs,
                                  List<PosteBesoinDto> postesBesoins) {

    /** Un poste classé "Besoin", tel qu'affiché dans la liste du drawer : description,
     *  nécessité (1-5) et montant réel de la période (mois ou année selon le dashboard). */
    public record PosteBesoinDto(UUID id, String description, int necessite, BigDecimal montant) {}
}
