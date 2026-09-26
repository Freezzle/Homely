package ch.homely.projection;

import ch.homely.categorie.Categorie;
import ch.homely.categorie.CategorieRepository;
import ch.homely.categorie.TypeCategorie;
import ch.homely.projection.dto.RepartitionCategorieDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Répartition des montants d'un type de poste par catégorie (part de chaque catégorie
 * dans le total du type), pour un sujet (foyer ou membre) et une période (mois ou année).
 *
 * <p>S'appuie sur les ventilations déjà calculées (et mises en cache) par
 * {@link ProjectionService} — aucune nouvelle règle moteur. Les catégories sont relues à
 * chaque appel pour que les libellés restent à jour même si la ventilation vient du
 * cache (le cache n'est invalidé que par les modifications du scénario).</p>
 */
@Service
@Transactional(readOnly = true)
public class RepartitionCategoriesService {

    private final ProjectionService projectionService;
    private final CategorieRepository categorieRepo;

    public RepartitionCategoriesService(ProjectionService projectionService, CategorieRepository categorieRepo) {
        this.projectionService = projectionService;
        this.categorieRepo = categorieRepo;
    }

    /**
     * @param mois     mois 1..12, ou {@code null} pour l'année entière (somme des 12 mois)
     * @param membreId membre ciblé, ou {@code null} pour le foyer entier
     * @return catégories du type ayant un montant &gt; 0, triées par montant décroissant
     */
    public List<RepartitionCategorieDto> repartition(UUID foyerId, UUID scenarioId, int annee, Integer mois,
                                                     TypeCategorie type, UUID membreId) {
        Map<UUID, BigDecimal> parCategorie;
        Map<UUID, Map<UUID, BigDecimal>> parCategorieMembre;
        if (mois == null) {
            var v = projectionService.ventilationsAnnuelle(foyerId, scenarioId, annee);
            parCategorie = v.parCategorie();
            parCategorieMembre = v.parCategorieMembre();
        } else {
            var v = projectionService.ventilations(foyerId, scenarioId, annee, mois);
            parCategorie = v.parCategorie();
            parCategorieMembre = v.parCategorieMembre();
        }

        List<Categorie> categories = categorieRepo.findAllByFoyerIdAndTypePosteOrderByLibelleAsc(foyerId, type);
        List<Ligne> lignes = categories.stream()
                .map(c -> new Ligne(c, montantSujet(c.getId(), membreId, parCategorie, parCategorieMembre)))
                .filter(l -> l.montant().signum() > 0)
                .sorted(Comparator.comparing(Ligne::montant).reversed()
                        .thenComparing(l -> l.categorie().getLibelle()))
                .toList();

        BigDecimal total = lignes.stream().map(Ligne::montant).reduce(BigDecimal.ZERO, BigDecimal::add);
        return lignes.stream()
                .map(l -> new RepartitionCategorieDto(
                        l.categorie().getId(),
                        l.categorie().getLibelle(),
                        l.montant(),
                        total.signum() == 0 ? BigDecimal.ZERO : l.montant().divide(total, 6, RoundingMode.HALF_UP)))
                .toList();
    }

    private static BigDecimal montantSujet(UUID categorieId, UUID membreId,
                                           Map<UUID, BigDecimal> parCategorie,
                                           Map<UUID, Map<UUID, BigDecimal>> parCategorieMembre) {
        BigDecimal montant = membreId == null
                ? parCategorie.get(categorieId)
                : parCategorieMembre.getOrDefault(categorieId, Map.of()).get(membreId);
        return montant == null ? BigDecimal.ZERO : montant;
    }

    private record Ligne(Categorie categorie, BigDecimal montant) {}
}
