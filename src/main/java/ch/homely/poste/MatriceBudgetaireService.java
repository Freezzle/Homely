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
 * Calcule le positionnement des postes pour la matrice budgétaire "Nécessité vs
 * Priorité d'action" du dashboard annuel — tout le calcul est fait ici côté serveur
 * (montant annualisé, scores 0-100 par rang percentile, poids du montant pour la
 * taille du point, classification en quadrant), le frontend ne fait plus que du rendu.
 *
 * <p>Nomenclature du modèle réel ({@link PosteDto}) vs vocabulaire de la matrice :
 * {@code necessite} = {@code importance} (1 non vital à 5 vital) ; {@code optimisable}
 * = {@code potentielOptimisation} (1 non optimisable à 5 très optimisable).</p>
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

    /** Part du montant annualisé dans le score de chaque axe (0-1) — le reste revient à
     *  la note saisie (necessite ou optimisable). Le montant peut donc faire remonter un
     *  poste au-dessus d'un autre nominalement mieux noté mais avec un montant négligeable,
     *  sans pour autant écraser le ressenti/l'optimisable saisis (poids volontairement modéré). */
    private static final double POIDS_MONTANT = 0.2;

    /** Croisement des 2 axes (quadrants) sur l'échelle 0-100. */
    private static final double CENTRE_ECHELLE = 50.0;

    /** Amplitude du jitter vertical déterministe (±) appliqué à l'axe Y pour l'affichage. */
    private static final double JITTER_Y = 4.0;

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

        return positionnerEntrees(entrees);
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

    // ── Scoring (0-100, rang percentile, testable indépendamment de la BDD) ─────

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

    /** Surcharge testable directement avec des {@link PosteEntree}, sans passer par {@link PosteDto}. */
    public static List<PostePositionneDto> positionnerEntrees(List<PosteEntree> postes) {
        if (postes.isEmpty()) return List.of();

        Map<UUID, Double> montantAnnuelLog = new LinkedHashMap<>();
        for (PosteEntree p : postes) {
            montantAnnuelLog.put(p.id(), Math.log(p.montantAnnuel().doubleValue() + 1));
        }
        Map<UUID, Double> poidsMontantParPoste = normaliserMinMax(montantAnnuelLog);

        Map<UUID, Double> scoresXBruts = new LinkedHashMap<>();
        Map<UUID, Double> scoresYBruts = new LinkedHashMap<>();
        for (PosteEntree p : postes) {
            double optimisableNorm = (p.optimisable() - 1) / 4.0;
            double necessiteNorm = (p.necessite() - 1) / 4.0;
            double poidsMontant = poidsMontantParPoste.get(p.id());
            scoresXBruts.put(p.id(), (1 - POIDS_MONTANT) * optimisableNorm + POIDS_MONTANT * poidsMontant);
            scoresYBruts.put(p.id(), (1 - POIDS_MONTANT) * necessiteNorm + POIDS_MONTANT * poidsMontant);
        }

        Map<UUID, Double> prioriteScores = rangsPercentile(scoresXBruts);
        Map<UUID, Double> necessiteScoresBruts = rangsPercentile(scoresYBruts);

        List<PostePositionneDto> resultat = new ArrayList<>();
        for (PosteEntree p : postes) {
            double prioriteScore = prioriteScores.get(p.id());
            double necessiteScoreBrut = necessiteScoresBruts.get(p.id());
            double necessiteScoreAffiche = clamp(necessiteScoreBrut + jitterY(p.id().toString()), 0, 100);
            double montantAnnuel = p.montantAnnuel().doubleValue();
            resultat.add(new PostePositionneDto(
                    p.id(), p.nom(), p.type(),
                    bd(p.montantMensuel().doubleValue()), bd(montantAnnuel),
                    p.necessite(), p.optimisable(),
                    bd(prioriteScore), bd(necessiteScoreAffiche), bd(poidsMontantParPoste.get(p.id())),
                    classifierQuadrant(necessiteScoreBrut, prioriteScore)));
        }
        return resultat;
    }

    /** Classifie un poste dans l'un des 4 quadrants selon ses scores 0-100 (non jitterés). */
    public static String classifierQuadrant(double necessiteScore, double prioriteScore) {
        boolean necessiteHaute = necessiteScore > CENTRE_ECHELLE;
        boolean prioriteHaute = prioriteScore > CENTRE_ECHELLE;
        if (necessiteHaute && !prioriteHaute) return "rigides";
        if (necessiteHaute) return "negocier";
        if (!prioriteHaute) return "bruit";
        return "couper";
    }

    /** Normalisation min-max sur [0, 1]. 0.5 (neutre) si un seul élément ou si tous égaux. */
    private static Map<UUID, Double> normaliserMinMax(Map<UUID, Double> valeurs) {
        if (valeurs.size() == 1) {
            UUID seul = valeurs.keySet().iterator().next();
            return Map.of(seul, 0.5);
        }
        double min = valeurs.values().stream().mapToDouble(Double::doubleValue).min().orElse(0);
        double max = valeurs.values().stream().mapToDouble(Double::doubleValue).max().orElse(0);
        double ecart = max - min;
        Map<UUID, Double> resultat = new LinkedHashMap<>();
        valeurs.forEach((id, v) -> resultat.put(id, ecart == 0 ? 0.5 : (v - min) / ecart));
        return resultat;
    }

    /** Rang percentile (0-100) de chaque élément parmi l'ensemble fourni, avec ranking
     *  fractionnaire pour les égalités (même rang moyen) — stable et déterministe. */
    private static Map<UUID, Double> rangsPercentile(Map<UUID, Double> valeurs) {
        int n = valeurs.size();
        if (n == 1) {
            UUID seul = valeurs.keySet().iterator().next();
            return Map.of(seul, CENTRE_ECHELLE);
        }
        List<Map.Entry<UUID, Double>> tries = new ArrayList<>(valeurs.entrySet());
        tries.sort(Map.Entry.comparingByValue());

        Map<UUID, Double> rangs = new LinkedHashMap<>();
        int i = 0;
        while (i < n) {
            int j = i;
            while (j + 1 < n && tries.get(j + 1).getValue().doubleValue() == tries.get(i).getValue().doubleValue()) j++;
            double rangMoyen = (i + j) / 2.0;
            double percentile = (rangMoyen / (n - 1)) * 100.0;
            for (int k = i; k <= j; k++) rangs.put(tries.get(k).getKey(), percentile);
            i = j + 1;
        }
        return rangs;
    }

    /** Jitter vertical déterministe dans [-4, 4], seedé par l'id du poste — stable d'un
     *  appel à l'autre. Évite les superpositions parfaites entre postes de score identique. */
    private static double jitterY(String id) {
        int hash = 0;
        for (int i = 0; i < id.length(); i++) {
            hash = (hash * 31 + id.charAt(i));
        }
        double unitaire = (Math.abs(hash) % 1000) / 1000.0;
        return (unitaire - 0.5) * 2 * JITTER_Y;
    }

    private static double clamp(double valeur, double min, double max) {
        return Math.min(max, Math.max(min, valeur));
    }

    private static BigDecimal bd(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}
