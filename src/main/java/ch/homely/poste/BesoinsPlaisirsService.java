package ch.homely.poste;

import ch.homely.foyer.RoleFoyer;
import ch.homely.moteur.MoteurCalcul;
import ch.homely.moteur.ParametresScenario;
import ch.homely.moteur.PosteCalcul;
import ch.homely.poste.dto.BesoinsPlaisirsDto;
import ch.homely.poste.dto.BesoinsPlaisirsDto.PosteBesoinDto;
import ch.homely.poste.dto.PosteDto;
import ch.homely.projection.ProjectionService;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Calcule la répartition "Besoins vs Plaisirs" des charges du foyer (ou d'un membre),
 * pour le dashboard mensuel et annuel — indicateur basé sur {@code necessite} (1 non
 * nécessaire à 5 nécessaire) déjà porté par chaque poste : 1 à 3 → Plaisirs, 4 à 5 →
 * Besoins.
 *
 * <p>Seuls les postes {@code CHARGE} sont considérés (les {@code RESERVE} sont des
 * mises de côté volontaires, hors périmètre "dépense plaisir/besoin" ; les
 * {@code REVENU} n'ont pas de sens ici). Aucun filtrage d'obsolescence ni de
 * déduplication de chaîne de révision n'est nécessaire : {@link MoteurCalcul#contribution}
 * renvoie déjà 0 en dehors de la fenêtre de validité d'un poste, donc sommer sur tous
 * les postes CHARGE du scénario ne peut pas créer de double-comptage.</p>
 */
@Service
public class BesoinsPlaisirsService {

    /** Seuil de nécessité (inclus) au-delà duquel un poste est classé "Besoin" — en
     *  deçà, il est classé "Plaisir". Cohérent avec le badge nécessité 1-5 déjà affiché
     *  sur les postes ({@code matriceBadgeNecessite}). */
    private static final int SEUIL_NECESSITE_BESOIN = 4;

    private final PosteService posteService;
    private final ProjectionService projectionService;
    private final MultiTenantService multiTenant;

    public BesoinsPlaisirsService(PosteService posteService, ProjectionService projectionService,
                                   MultiTenantService multiTenant) {
        this.posteService = posteService;
        this.projectionService = projectionService;
        this.multiTenant = multiTenant;
    }

    /** Variante mensuelle : ne considère que le mois {@code mois} de l'année {@code annee}. */
    @Transactional(readOnly = true)
    public BesoinsPlaisirsDto calculerMois(UUID foyerId, UUID scenarioId, int annee, int mois, UUID membreId) {
        return calculer(foyerId, scenarioId, annee, mois, mois, membreId);
    }

    /** Variante annuelle : cumule les 12 mois de l'année {@code annee}. */
    @Transactional(readOnly = true)
    public BesoinsPlaisirsDto calculerAnnee(UUID foyerId, UUID scenarioId, int annee, UUID membreId) {
        return calculer(foyerId, scenarioId, annee, 1, 12, membreId);
    }

    private BesoinsPlaisirsDto calculer(UUID foyerId, UUID scenarioId, int annee, int moisDebut, int moisFin,
                                         UUID membreId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);

        List<PosteDto> tousLesPostes = posteService.lister(foyerId, scenarioId);
        List<PosteDto> charges = tousLesPostes.stream()
                .filter(p -> p.type() == TypePoste.CHARGE)
                .toList();

        ParametresScenario params = projectionService.chargerParametres(foyerId, scenarioId);
        Map<UUID, PosteCalcul> postesCalculParId = new LinkedHashMap<>();
        for (PosteCalcul pc : params.postes()) postesCalculParId.put(pc.id(), pc);

        List<PosteEntree> entrees = charges.stream()
                .map(p -> new PosteEntree(p.id(), p.description(), p.importance(),
                        montantReel(postesCalculParId.get(p.id()), membreId, annee, moisDebut, moisFin, params)))
                .toList();

        return bucketer(entrees);
    }

    /** Somme des contributions réelles (fenêtre de validité, prorata, périodicité) du
     *  poste entre {@code moisDebut} et {@code moisFin} (inclus) de {@code annee},
     *  pondérée par la quote-part effective du membre le cas échéant
     *  ({@code membreId == null} → foyer entier, quote-part 1). */
    private double montantReel(PosteCalcul posteCalcul, UUID membreId, int annee, int moisDebut, int moisFin,
                                ParametresScenario params) {
        if (posteCalcul == null) return 0.0;
        double total = 0.0;
        for (int mois = moisDebut; mois <= moisFin; mois++) {
            double contribution = MoteurCalcul.contribution(posteCalcul, annee, mois);
            if (contribution == 0.0) continue;
            if (membreId != null) {
                contribution *= MoteurCalcul.quotePartEffective(
                        posteCalcul, membreId, annee, mois, params.periodesDefaut(), params.membres().size());
            }
            total += contribution;
        }
        return total;
    }

    // ── Bucketing (0 dépendance BDD, testable indépendamment) ───────────────────

    /** Poste d'entrée du bucketing, découplé de {@link PosteDto}/{@link PosteCalcul}
     *  pour rester facilement testable unitairement (pas de dépendance JPA). */
    public record PosteEntree(UUID id, String description, int necessite, double montant) {}

    /** Classe chaque poste en Besoin ({@code necessite >= 4}) ou Plaisir
     *  ({@code necessite <= 3}), retourne les montants sommés par catégorie ainsi que le
     *  détail des postes "Besoin" (triés par montant décroissant), pour la liste
     *  affichée sous les stats du drawer. Un poste à montant nul (inactif sur la
     *  période, ou — vue membre — quote-part effective nulle pour ce membre) n'a pas de
     *  sens dans la liste et en est exclu, mais reste sans effet sur les totaux (déjà
     *  nuls dans ce cas). */
    public static BesoinsPlaisirsDto bucketer(List<PosteEntree> postes) {
        double totalBesoins = 0.0;
        double totalPlaisirs = 0.0;
        List<PosteEntree> besoins = new ArrayList<>();
        for (PosteEntree p : postes) {
            if (p.necessite() >= SEUIL_NECESSITE_BESOIN) {
                totalBesoins += p.montant();
                besoins.add(p);
            } else {
                totalPlaisirs += p.montant();
            }
        }
        List<PosteBesoinDto> postesBesoins = besoins.stream()
                .filter(p -> p.montant() > 0)
                .sorted(Comparator.comparingDouble(PosteEntree::montant).reversed())
                .map(p -> new PosteBesoinDto(p.id(), p.description(), p.necessite(), bd(p.montant())))
                .toList();
        return new BesoinsPlaisirsDto(bd(totalBesoins), bd(totalPlaisirs), postesBesoins);
    }

    private static BigDecimal bd(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}
