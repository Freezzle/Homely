package ch.homely.poche;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Résultat de {@link ArgentPocheService#resoudre}.
 *
 * <p>Priorité de résolution (spec §1) : {@link SourceArgentPoche#ALLOCATION}
 * &gt; {@link SourceArgentPoche#POLITIQUE} &gt; {@link SourceArgentPoche#AUCUNE}.</p>
 *
 * <p>Le versement suit le <b>sens REVENU</b> : il part du {@code comptePivotId}
 * (la source qui finance) vers les comptes de {@code routage}. Une contrepartie
 * confondue avec le pivot est un auto-routage — aucun virement n'est à simuler,
 * la dépense reste sur ce compte.</p>
 *
 * @param montant       montant résolu (≥ 0) en devise de base
 * @param source        origine du montant
 * @param politiqueId   id de la politique appliquée si {@code source = POLITIQUE}, sinon {@code null}
 * @param allocationId  id de l'allocation appliquée si {@code source = ALLOCATION}, sinon {@code null}
 * @param comptePivotId compte source finançant le versement, {@code null} si {@code source = AUCUNE}
 * @param routage       comptes de poche crédités (quotes-parts renormalisées, somme = 1),
 *                      vide si {@code source = AUCUNE}
 * @param rav           RàV du membre avant retrait de l'argent de poche (pour affichage/contexte)
 */
public record ResolutionArgentPoche(
        double montant,
        SourceArgentPoche source,
        UUID politiqueId,
        UUID allocationId,
        UUID comptePivotId,
        List<LigneRoutagePoche> routage,
        double rav
) {
    public ResolutionArgentPoche {
        routage = routage == null ? List.of() : List.copyOf(routage);
    }

    public static ResolutionArgentPoche aucune(double rav) {
        return new ResolutionArgentPoche(0.0, SourceArgentPoche.AUCUNE, null, null, null, List.of(), rav);
    }

    /**
     * Montant éclaté par compte de poche crédité, au prorata des quotes-parts.
     * Vide si aucun versement n'est dû.
     */
    public Map<UUID, Double> montantsParCompte() {
        if (montant <= 0) return Map.of();
        Map<UUID, Double> parCompte = new LinkedHashMap<>();
        for (LigneRoutagePoche l : routage) {
            parCompte.merge(l.compteId(), montant * l.quotePart(), Double::sum);
        }
        return parCompte;
    }

    /** Part du versement créditée sur {@code compteId} (0 si ce compte n'est pas concerné). */
    public double montantSurCompte(UUID compteId) {
        return montantsParCompte().getOrDefault(compteId, 0.0);
    }

    public static ResolutionArgentPoche parAllocation(
            double montant, UUID allocationId, UUID comptePivotId,
            List<LigneRoutagePoche> routage, double rav) {
        return new ResolutionArgentPoche(
                montant, SourceArgentPoche.ALLOCATION, null, allocationId,
                comptePivotId, normaliser(routage, comptePivotId), rav);
    }

    public static ResolutionArgentPoche parPolitique(
            double montant, UUID politiqueId, UUID comptePivotId,
            List<LigneRoutagePoche> routage, double rav) {
        return new ResolutionArgentPoche(
                montant, SourceArgentPoche.POLITIQUE, politiqueId, null,
                comptePivotId, normaliser(routage, comptePivotId), rav);
    }

    /**
     * Renormalise les quotes-parts pour qu'elles somment exactement à 1 : les poids
     * stockés peuvent dériver (arrondis, édition partielle) et le simulateur doit
     * verser le montant intégral, ni plus ni moins.
     *
     * <p>Routage vide (donnée incomplète) : repli sur le pivot lui-même, ce qui
     * revient à ne simuler aucun virement plutôt qu'à perdre le montant.</p>
     */
    private static List<LigneRoutagePoche> normaliser(List<LigneRoutagePoche> lignes, UUID comptePivotId) {
        if (lignes == null || lignes.isEmpty()) {
            return comptePivotId == null ? List.of() : List.of(new LigneRoutagePoche(comptePivotId, 1.0));
        }
        double total = lignes.stream().mapToDouble(LigneRoutagePoche::quotePart).sum();
        if (total <= 0) {
            double egale = 1.0 / lignes.size();
            return lignes.stream().map(l -> new LigneRoutagePoche(l.compteId(), egale)).toList();
        }
        return lignes.stream().map(l -> new LigneRoutagePoche(l.compteId(), l.quotePart() / total)).toList();
    }
}
