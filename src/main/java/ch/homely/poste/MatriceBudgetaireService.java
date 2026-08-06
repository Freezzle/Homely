package ch.homely.poste;

import ch.homely.foyer.RoleFoyer;
import ch.homely.moteur.MoteurCalcul;
import ch.homely.moteur.ParametresScenario;
import ch.homely.moteur.PosteCalcul;
import ch.homely.poste.dto.PosteDto;
import ch.homely.poste.dto.PostePositionneDto;
import ch.homely.projection.ProjectionService;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Calcule le classement des postes "à optimiser en priorité" (dashboard annuel) —
 * tout le calcul est fait ici côté serveur (montant annualisé, score unique 0-100, tri
 * décroissant, troncature au top 30), le frontend ne fait plus que du rendu.
 *
 * <p>Nomenclature du modèle réel ({@link PosteDto}) vs vocabulaire du score :
 * {@code necessite} = {@code importance} (1 non vital à 5 vital) ; {@code optimisable}
 * = {@code potentielOptimisation} (1 non optimisable à 5 très optimisable).</p>
 *
 * <p><b>Formule de score</b> (calculée sur <i>tous</i> les postes candidats de l'année,
 * avant troncature) :</p>
 * <ul>
 *   <li>{@code inutilite = 1 - (necessite - 1) / 4} — un poste peu important a une
 *       inutilité proche de 1.</li>
 *   <li>{@code poidsMontant} = rang percentile (0-1) de {@code log(montantAnnuel + 1)}
 *       parmi tous les postes candidats de l'année (robuste aux valeurs extrêmes).</li>
 *   <li>{@code opportunite = optimisableNorm × poidsMontant} — optimisable et montant
 *       sont calculés <b>ensemble</b> (produit, pas somme) : un gros montant sur un
 *       poste peu optimisable ne doit pas faire remonter le score autant qu'un gros
 *       montant optimisable.</li>
 *   <li>{@code score = (POIDS_IMPORTANCE × inutilite + POIDS_OPTIMISABLE_MONTANT ×
 *       opportunite) × 100} — l'importance pèse plus que l'optimisable/montant
 *       (0.7 &gt; 0.3) : supprimer un poste inutile fait plus de bien qu'optimiser son
 *       coût.</li>
 * </ul>
 *
 * <p>Seuls les {@value #TOP_N} postes au score le plus élevé sont retournés, avec leur
 * rang (1 = score le plus élevé).</p>
 *
 * <p>Trois règles de filtrage, basées sur la <b>date du jour</b> (pas l'année consultée) :</p>
 * <ul>
 *   <li>Seuls les postes {@code CHARGE}/{@code RESERVE} sont retenus (les {@code REVENU}
 *       n'ont pas de sens à optimiser).</li>
 *   <li>Un poste <b>obsolète</b> (date de fin déjà passée aujourd'hui) est exclu.</li>
 *   <li>Pour une chaîne de révisions ({@code posteOrigineId}/{@code posteSuivantId}), un
 *       seul maillon est représenté : celui qui a le plus de mois encore à courir d'ici
 *       la fin de l'année sélectionnée à partir d'aujourd'hui.</li>
 * </ul>
 */
@Service
public class MatriceBudgetaireService {

    /** Poids de l'inutilité (importance inversée) dans le score final — volontairement
     *  supérieur au poids optimisable/montant : réduire/couper un poste inutile fait
     *  plus de bien qu'optimiser son coût (on n'optimise souvent qu'à la marge). */
    private static final double POIDS_IMPORTANCE = 0.7;

    /** Poids du couple optimisable×montant dans le score final. */
    private static final double POIDS_OPTIMISABLE_MONTANT = 0.3;

    /** Nombre maximal de postes retournés (les {@value} au score le plus élevé). */
    public static final int TOP_N = 30;

    private final PosteService posteService;
    private final ProjectionService projectionService;
    private final MultiTenantService multiTenant;

    public MatriceBudgetaireService(PosteService posteService, ProjectionService projectionService,
                                     MultiTenantService multiTenant) {
        this.posteService = posteService;
        this.projectionService = projectionService;
        this.multiTenant = multiTenant;
    }

    @Transactional(readOnly = true)
    public List<PostePositionneDto> calculer(UUID foyerId, UUID scenarioId, int annee, UUID membreId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);

        List<PosteDto> tousLesPostes = posteService.lister(foyerId, scenarioId);
        Map<UUID, PosteDto> index = new LinkedHashMap<>();
        for (PosteDto p : tousLesPostes) index.put(p.id(), p);

        LocalDate aujourdhui = LocalDate.now();

        List<PosteDto> candidats = tousLesPostes.stream()
                .filter(p -> p.type() == TypePoste.CHARGE || p.type() == TypePoste.RESERVE)
                .filter(p -> !estObsolete(p, aujourdhui))
                .filter(p -> estActifSurAnnee(p, annee))
                .toList();

        // Un seul représentant par chaîne de révisions : celui avec le plus de mois
        // encore à courir d'ici la fin de l'année, à partir d'aujourd'hui.
        Map<UUID, List<PosteDto>> groupes = new LinkedHashMap<>();
        for (PosteDto p : candidats) {
            UUID racine = racineChaine(p, index);
            groupes.computeIfAbsent(racine, k -> new ArrayList<>()).add(p);
        }
        List<PosteDto> representants = groupes.values().stream()
                .map(membres -> membres.stream()
                        .max(Comparator.comparingInt(p -> moisEncoreEnCours(p, annee, aujourdhui)))
                        .orElseThrow())
                .toList();

        // Chargé systématiquement : nécessaire à la fois pour le filtrage membre et pour
        // le montant annuel réel (prorata de la fenêtre de validité + quote-part membre).
        ParametresScenario params = projectionService.chargerParametres(foyerId, scenarioId);
        Map<UUID, PosteCalcul> postesCalculParId = new LinkedHashMap<>();
        for (PosteCalcul pc : params.postes()) postesCalculParId.put(pc.id(), pc);

        List<PosteDto> filtresMembre = representants;
        if (membreId != null) {
            filtresMembre = representants.stream()
                    .filter(p -> concerneMembreSurAnnee(p, postesCalculParId.get(p.id()), membreId, annee, params))
                    .toList();
        }

        List<PosteEntree> entrees = filtresMembre.stream()
                .map(p -> new PosteEntree(p.id(), p.description(), p.type(), p.montantMensualise(),
                        montantAnnuelReel(postesCalculParId.get(p.id()), membreId, annee, params),
                        p.importance(), p.potentielOptimisation()))
                .toList();

        return classerEntrees(entrees);
    }

    /** Montant annuel <b>réel</b> pour l'année sélectionnée : somme des contributions
     *  mensuelles effectives (respectant la fenêtre de validité, la périodicité et le
     *  prorata du poste — {@link MoteurCalcul#contribution}), pondérée par la quote-part
     *  effective du membre le cas échéant ({@code membreId == null} → foyer entier, quote-part 1). */
    private BigDecimal montantAnnuelReel(PosteCalcul posteCalcul, UUID membreId, int annee, ParametresScenario params) {
        if (posteCalcul == null) return BigDecimal.ZERO;
        double total = 0.0;
        for (int mois = 1; mois <= 12; mois++) {
            double contribution = MoteurCalcul.contribution(posteCalcul, annee, mois);
            if (contribution == 0.0) continue;
            if (membreId != null) {
                contribution *= MoteurCalcul.quotePartEffective(
                        posteCalcul, membreId, annee, mois, params.periodesDefaut(), params.membres().size());
            }
            total += contribution;
        }
        return bd(total);
    }

    // ── Filtrage par date / chaîne de révisions ─────────────────────────────────

    private boolean estObsolete(PosteDto poste, LocalDate aujourdhui) {
        return poste.fin() != null && poste.fin().isBefore(aujourdhui);
    }

    private boolean estActifSurMois(PosteDto poste, int annee, int mois) {
        LocalDate debutMois = LocalDate.of(annee, mois, 1);
        LocalDate finMois = debutMois.plusMonths(1).minusDays(1);
        boolean debutOk = poste.debut() == null || !poste.debut().isAfter(finMois);
        boolean finOk = poste.fin() == null || !poste.fin().isBefore(debutMois);
        return debutOk && finOk;
    }

    private boolean estActifSurAnnee(PosteDto poste, int annee) {
        LocalDate debutAnnee = LocalDate.of(annee, 1, 1);
        LocalDate finAnnee = LocalDate.of(annee, 12, 31);
        boolean debutOk = poste.debut() == null || !poste.debut().isAfter(finAnnee);
        boolean finOk = poste.fin() == null || !poste.fin().isBefore(debutAnnee);
        return debutOk && finOk;
    }

    /** Racine (id du tout premier maillon) de la chaîne de révisions à laquelle
     *  appartient {@code poste}, en remontant via {@code posteOrigineId}. */
    private UUID racineChaine(PosteDto poste, Map<UUID, PosteDto> index) {
        PosteDto courant = poste;
        java.util.Set<UUID> visites = new java.util.HashSet<>();
        while (courant.posteOrigineId() != null && index.containsKey(courant.posteOrigineId())
                && !visites.contains(courant.id())) {
            visites.add(courant.id());
            courant = index.get(courant.posteOrigineId());
        }
        return courant.id();
    }

    /** Nombre de mois, entre aujourd'hui et la fin de l'année {@code annee}, où
     *  {@code poste} est encore actif. Si l'année est déjà entièrement révolue par
     *  rapport à aujourd'hui, se rabat sur le total des mois actifs de l'année (pour
     *  départager tout de même les révisions d'une même chaîne). */
    private int moisEncoreEnCours(PosteDto poste, int annee, LocalDate aujourdhui) {
        int moisDebut;
        if (annee == aujourdhui.getYear()) {
            moisDebut = aujourdhui.getMonthValue();
        } else if (annee > aujourdhui.getYear()) {
            moisDebut = 1;
        } else {
            moisDebut = 13; // année déjà révolue
        }
        int count = 0;
        for (int mois = moisDebut; mois <= 12; mois++) {
            if (estActifSurMois(poste, annee, mois)) count++;
        }
        if (moisDebut > 12) {
            for (int mois = 1; mois <= 12; mois++) {
                if (estActifSurMois(poste, annee, mois)) count++;
            }
        }
        return count;
    }

    /** Vrai si {@code poste} concerne le membre sur au moins un mois de l'année (quote-part
     *  effective &gt; 0), en ne testant que les mois où le poste est actif. */
    private boolean concerneMembreSurAnnee(PosteDto poste, PosteCalcul posteCalcul, UUID membreId, int annee,
                                            ParametresScenario params) {
        if (posteCalcul == null) return false;
        for (int mois = 1; mois <= 12; mois++) {
            if (!estActifSurMois(poste, annee, mois)) continue;
            double quotePart = MoteurCalcul.quotePartEffective(
                    posteCalcul, membreId, annee, mois, params.periodesDefaut(), params.membres().size());
            if (quotePart > 0) return true;
        }
        return false;
    }

    // ── Scoring (0-100, testable indépendamment de la BDD) ──────────────────────

    /** Poste d'entrée du calcul de score, découplé de {@link PosteDto} pour rester
     *  facilement testable de façon unitaire (pas de dépendance JPA).
     *
     * @param montantAnnuel montant annuel <b>réel</b> déjà calculé (prorata de la fenêtre
     *                       de validité + quote-part membre le cas échéant) — voir
     *                       {@link #montantAnnuelReel}. Ce n'est volontairement pas
     *                       {@code montantMensuel * 12} : un poste actif seulement quelques
     *                       mois dans l'année, ou dont seule une part revient au membre
     *                       consulté, ne doit pas peser comme un montant plein-année. */
    public record PosteEntree(UUID id, String nom, TypePoste type, BigDecimal montantMensuel,
                               BigDecimal montantAnnuel, int necessite, int optimisable) {}

    /** Surcharge testable directement avec des {@link PosteEntree}, sans passer par
     *  {@link PosteDto}. Calcule le score sur l'ensemble de {@code postes}, puis ne
     *  retourne que les {@value #TOP_N} premiers par score décroissant. */
    public static List<PostePositionneDto> classerEntrees(List<PosteEntree> postes) {
        if (postes.isEmpty()) return List.of();

        Map<UUID, Double> montantAnnuelLog = new LinkedHashMap<>();
        for (PosteEntree p : postes) {
            montantAnnuelLog.put(p.id(), Math.log(p.montantAnnuel().doubleValue() + 1));
        }
        Map<UUID, Double> poidsMontantParPoste = rangsPercentile01(montantAnnuelLog);

        Map<UUID, Double> scoresParPoste = new LinkedHashMap<>();
        for (PosteEntree p : postes) {
            double importanceNorm = (p.necessite() - 1) / 4.0;
            double optimisableNorm = (p.optimisable() - 1) / 4.0;
            double poidsMontant = poidsMontantParPoste.get(p.id());

            double inutilite = 1 - importanceNorm;
            double opportunite = optimisableNorm * (poidsMontant * 1.4);

            double score = (POIDS_IMPORTANCE * inutilite + POIDS_OPTIMISABLE_MONTANT * opportunite) * 100.0;
            scoresParPoste.put(p.id(), score);
        }

        List<PosteEntree> triesParScoreDesc = postes.stream()
                .sorted(Comparator.comparingDouble((PosteEntree p) -> scoresParPoste.get(p.id())).reversed())
                .toList();

        List<PostePositionneDto> resultat = new ArrayList<>();
        int rang = 1;
        for (PosteEntree p : triesParScoreDesc) {
            if (rang > TOP_N) break;
            resultat.add(new PostePositionneDto(
                    p.id(), p.nom(), p.type(),
                    bd(p.montantMensuel().doubleValue()), bd(p.montantAnnuel().doubleValue()),
                    p.necessite(), p.optimisable(),
                    bd(scoresParPoste.get(p.id())), rang));
            rang++;
        }
        return resultat;
    }

    /** Rang percentile (0-1) de chaque élément parmi l'ensemble fourni, avec ranking
     *  fractionnaire pour les égalités (même rang moyen) — stable et déterministe.
     *  0.5 (neutre) si un seul élément ou si tous égaux. */
    private static Map<UUID, Double> rangsPercentile01(Map<UUID, Double> valeurs) {
        int n = valeurs.size();
        if (n == 1) {
            UUID seul = valeurs.keySet().iterator().next();
            return Map.of(seul, 0.5);
        }
        List<Map.Entry<UUID, Double>> tries = new ArrayList<>(valeurs.entrySet());
        tries.sort(Map.Entry.comparingByValue());

        Map<UUID, Double> rangs = new LinkedHashMap<>();
        int i = 0;
        while (i < n) {
            int j = i;
            while (j + 1 < n && tries.get(j + 1).getValue().doubleValue() == tries.get(i).getValue().doubleValue()) j++;
            double rangMoyen = (i + j) / 2.0;
            double percentile01 = rangMoyen / (n - 1);
            for (int k = i; k <= j; k++) rangs.put(tries.get(k).getKey(), percentile01);
            i = j + 1;
        }
        return rangs;
    }

    private static BigDecimal bd(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}
