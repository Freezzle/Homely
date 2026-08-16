package ch.homely.projection;

import ch.homely.compte.Compte;
import ch.homely.compte.CompteMembre;
import ch.homely.compte.CompteMembreRepository;
import ch.homely.compte.CompteRepository;
import ch.homely.membre.Membre;
import ch.homely.membre.MembreRepository;
import ch.homely.moteur.*;
import ch.homely.poche.ArgentDePocheProviderJpa;
import ch.homely.poche.ArgentPocheService;
import ch.homely.poche.ResolutionArgentPoche;
import ch.homely.poste.NaturePoste;
import ch.homely.poste.Poste;
import ch.homely.poste.PosteRepository;
import ch.homely.poste.TypePoste;
import ch.homely.projection.dto.*;
import ch.homely.scenario.RepartitionPeriode;
import ch.homely.scenario.RepartitionPeriodeRepository;
import ch.homely.scenario.Scenario;
import ch.homely.scenario.ScenarioRepository;
import ch.homely.taux.TauxChange;
import ch.homely.taux.TauxChangeRepository;
import jakarta.persistence.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

/**
 * T3.1 / T8.x — Service de projection : charge, calcule, mappe en DTOs.
 * T3.2 — Cache Caffeine invalidé à chaque modification de poste.
 */
@Service
@Transactional(readOnly = true)
public class ProjectionService {

    private static final Logger log = LoggerFactory.getLogger(ProjectionService.class);

    private final ScenarioRepository       scenarioRepo;
    private final PosteRepository          posteRepo;
    private final TauxChangeRepository     tauxRepo;
    private final CompteRepository         compteRepo;
    private final RepartitionPeriodeRepository periodeRepo;
    private final MembreRepository         membreRepo;
    private final CompteMembreRepository   compteMembreRepo;
    private final ArgentDePocheProviderJpa.ArgentDePocheProviderFactory argentPocheFactory;
    private final ArgentPocheService argentPocheService;

    public ProjectionService(ScenarioRepository scenarioRepo, PosteRepository posteRepo,
                             TauxChangeRepository tauxRepo, CompteRepository compteRepo,
                             RepartitionPeriodeRepository periodeRepo, MembreRepository membreRepo,
                             CompteMembreRepository compteMembreRepo,
                             ArgentDePocheProviderJpa.ArgentDePocheProviderFactory argentPocheFactory,
                             ArgentPocheService argentPocheService) {
        this.scenarioRepo = scenarioRepo;
        this.posteRepo    = posteRepo;
        this.tauxRepo     = tauxRepo;
        this.compteRepo   = compteRepo;
        this.periodeRepo  = periodeRepo;
        this.membreRepo   = membreRepo;
        this.compteMembreRepo = compteMembreRepo;
        this.argentPocheFactory = argentPocheFactory;
        this.argentPocheService = argentPocheService;
    }

    // ── T8.1 ─────────────────────────────────────────────────────────────────

    @Cacheable(value = "projections",
               key = "#scenarioId + '-ann-' + #annee + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public ProjectionAnnuelleDto projectionAnnuelle(UUID foyerId, UUID scenarioId, int annee) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);
        return toAnnuelleDto(MoteurCalcul.projectionAnnuelle(params, annee));
    }

    @Cacheable(value = "projections",
               key = "#scenarioId + '-pluri-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public List<ProjectionAnnuelleDto> projectionAnnuelleComplete(UUID foyerId, UUID scenarioId) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);
        return MoteurCalcul.projectionPluriannuelle(params).annees().stream()
                .map(this::toAnnuelleDto).toList();
    }

    // ── T8.2 ─────────────────────────────────────────────────────────────────

    @Cacheable(value = "projections",
               key = "#scenarioId + '-tres-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public TresorerieDto tresorerie(UUID foyerId, UUID scenarioId) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);
        ProjectionPluriannuelle pp = MoteurCalcul.projectionPluriannuelle(params);

        List<TresorerieDto.EntreeTresorerieDto> annees = pp.tresorerie().stream()
                .map(e -> new TresorerieDto.EntreeTresorerieDto(e.annee(),
                        bd(e.soldeAnnuel()), bd(e.tresorerieDebutAnnee()), bd(e.tresorerieFinAnnee())))
                .toList();

        List<TresorerieDto.MoisCourbeDto> courbe = new ArrayList<>();
        double cumul = params.tresorerieInitiale();
        for (ProjectionAnnuelle pa : pp.annees()) {
            for (int m = 0; m < 12; m++) {
                cumul += pa.mois().get(m).soldeDisponible();
                courbe.add(new TresorerieDto.MoisCourbeDto(pa.annee(), m + 1, bd(cumul)));
            }
        }
        return new TresorerieDto(annees, courbe);
    }

    /**
     * Courbe de trésorerie cumulée d'une année, scopée à un sujet (foyer, ou membre si
     * {@code membreId != null}), en séries mensualisée + réelle.
     *
     * <p>Amorçage à la trésorerie initiale du scénario (prorata de la quote-part de la
     * période ouverte du membre en vue membre), puis cumul des soldes disponibles mensuels
     * du sujet sur l'année. La courbe repart de la trésorerie initiale à chaque année (non
     * chaînée — cf. {@link #tresorerie} pour le chaînage §4). Ce calcul, auparavant réalisé
     * côté frontend, est déplacé ici pour que le backend reste seul propriétaire des
     * calculs (aucune logique moteur dupliquée dans le dashboard).</p>
     */
    @Cacheable(value = "projections",
               key = "#scenarioId + '-tresocum-' + #annee + '-' + #membreId + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public TresorerieCumuleeDto tresorerieCumulee(UUID foyerId, UUID scenarioId, int annee, UUID membreId) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);
        double[] mensualise = MoteurCalcul.tresorerieCumuleeAnnee(params, annee, membreId, false);
        double[] reel       = MoteurCalcul.tresorerieCumuleeAnnee(params, annee, membreId, true);
        return new TresorerieCumuleeDto(annee, bdListe(mensualise), bdListe(reel));
    }

    private static List<BigDecimal> bdListe(double[] valeurs) {
        List<BigDecimal> out = new ArrayList<>(valeurs.length);
        for (double v : valeurs) out.add(bd(v));
        return out;
    }

    // ── T8.3 ─────────────────────────────────────────────────────────────────

    @Cacheable(value = "projections",
               key = "#scenarioId + '-vent-' + #annee + '-' + #mois + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public VentilationsDto ventilations(UUID foyerId, UUID scenarioId, int annee, int mois) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);

        // Agrégat foyer du mois
        AggregatMensuel agFoyer = MoteurCalcul.aggregatFoyerMois(params, annee, mois);
        VentilationsDto.AggregatDto agregat = toVentAggregatDto(agFoyer);

        // Agrégat par membre du mois + résolution argent de poche (montant + compte
        // crédité) pour fusion ultérieure dans la ventilation par compte — l'argent de
        // poche n'étant pas un poste, le moteur pur (`MoteurCalcul.ventilations`) ne le
        // voit jamais. Le RàV brut nécessaire à la formule est simplement
        // revenus − charges − réserves de l'agrégat déjà calculé (poche n'affecte que
        // `soldeDisponible`, jamais ces trois composantes — voir
        // `MoteurCalcul.aggregatMembreMoisInterne`).
        Map<UUID, VentilationsDto.AggregatDto> parMembre = new LinkedHashMap<>();
        Map<UUID, VentilationsDto.SplitDto> parMembreSplit = new LinkedHashMap<>();
        Map<UUID, ResolutionArgentPoche> pocheParMembre = new LinkedHashMap<>();
        for (UUID membreId : params.membres()) {
            AggregatMensuel ag = MoteurCalcul.aggregatMembreMois(params, membreId, annee, mois);
            parMembre.put(membreId, toVentAggregatDto(ag));
            SplitPersoPartageMensuel split = MoteurCalcul.aggregatMembreMoisSplit(params, membreId, annee, mois);
            parMembreSplit.put(membreId, toVentSplitDto(split));

            double ravBrut = ag.revenus() - ag.charges() - ag.reserves();
            pocheParMembre.put(membreId,
                    argentPocheService.resoudre(scenarioId, membreId, YearMonth.of(annee, mois), ravBrut));
        }

        // Ventilations par catégorie, par catégorie/membre et par compte/membre
        Ventilations v = MoteurCalcul.ventilations(params, annee, mois);
        Map<UUID, BigDecimal> parCat = v.parCategorie().entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> bd(e.getValue())));
        Map<UUID, Map<UUID, BigDecimal>> parCatMembre = v.parCategorieMembre().entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey,
                        e -> e.getValue().entrySet().stream()
                                .collect(Collectors.toMap(Map.Entry::getKey, ie -> bd(ie.getValue())))));
        Map<UUID, Map<UUID, Double>> parCompteMembreBrut = fusionnerArgentPocheDansComptes(v.parCompteMembre(), pocheParMembre);
        Map<UUID, Map<UUID, BigDecimal>> parCM = parCompteMembreBrut.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey,
                        e -> e.getValue().entrySet().stream()
                                .collect(Collectors.toMap(Map.Entry::getKey, ie -> bd(ie.getValue())))));
        return new VentilationsDto(annee, mois, agregat, parMembre, parCat, parCatMembre, parCM, parMembreSplit);
    }

    // ── Indicateur 04 — Taux d'effort du membre ─────────────────────────────

    /**
     * Taux d'effort par membre pour un mois donné : revenus / charges / réserves du
     * membre, ainsi qu'un scénario "pire cas" où chaque poste CHARGE/RESERVE de nature
     * ESTIMATION est majoré de {@code estimPourcentage}. Le moteur ({@link MoteurCalcul})
     * n'est pas modifié : le pire cas est simulé en reconstruisant une liste alternative
     * de {@link PosteCalcul} avec des montants majorés, puis en rappelant les mêmes
     * fonctions d'agrégation que pour le scénario normal.
     */
    @Cacheable(value = "projections",
               key = "#scenarioId + '-effort-' + #annee + '-' + #mois + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public List<TauxEffortMembreDto> tauxEffort(UUID foyerId, UUID scenarioId, int annee, int mois) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);
        ParametresScenario paramsPireCas = construireParamsPireCas(params, scenarioId, foyerId);
        Map<UUID, Membre> membresParId = membreRepo.findAllById(params.membres()).stream()
                .collect(Collectors.toMap(Membre::getId, m -> m));

        List<TauxEffortMembreDto> resultat = new ArrayList<>();
        for (UUID membreId : params.membres()) {
            AggregatMensuel normal  = MoteurCalcul.aggregatMembreMois(params, membreId, annee, mois);
            AggregatMensuel pireCas = MoteurCalcul.aggregatMembreMois(paramsPireCas, membreId, annee, mois);
            double poche = argentPocheMontant(params, membreId, annee, mois, normal);
            double pochePireCas = argentPocheMontant(paramsPireCas, membreId, annee, mois, pireCas);
            resultat.add(toTauxEffortDto(membreId, membresParId.get(membreId), normal, pireCas, poche, pochePireCas));
        }
        return resultat;
    }

    /**
     * Indicateur 04 — Variante annuelle : même logique que {@link #tauxEffort}, mais les
     * agrégats normal/pire cas sont sommés sur les 12 mois de l'année (mêmes fonctions
     * moteur mois par mois, réutilisant le pattern de {@link #ventilationsAnnuelle}).
     */
    @Cacheable(value = "projections",
               key = "#scenarioId + '-effort-annuelle-' + #annee + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public List<TauxEffortMembreDto> tauxEffortAnnuel(UUID foyerId, UUID scenarioId, int annee) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);
        ParametresScenario paramsPireCas = construireParamsPireCas(params, scenarioId, foyerId);
        Map<UUID, Membre> membresParId = membreRepo.findAllById(params.membres()).stream()
                .collect(Collectors.toMap(Membre::getId, m -> m));

        List<TauxEffortMembreDto> resultat = new ArrayList<>();
        for (UUID membreId : params.membres()) {
            AggregatMensuel normal  = AggregatMensuel.zero();
            AggregatMensuel pireCas = AggregatMensuel.zero();
            double poche = 0, pochePireCas = 0;
            for (int m = 1; m <= 12; m++) {
                AggregatMensuel agNormalMois  = MoteurCalcul.aggregatMembreMois(params, membreId, annee, m);
                AggregatMensuel agPireCasMois = MoteurCalcul.aggregatMembreMois(paramsPireCas, membreId, annee, m);
                normal  = normal.plus(agNormalMois);
                pireCas = pireCas.plus(agPireCasMois);
                poche        += argentPocheMontant(params, membreId, annee, m, agNormalMois);
                pochePireCas += argentPocheMontant(paramsPireCas, membreId, annee, m, agPireCasMois);
            }
            resultat.add(toTauxEffortDto(membreId, membresParId.get(membreId), normal, pireCas, poche, pochePireCas));
        }
        return resultat;
    }

    // ── Indicateur — Prorata des postes partagés ────────────────────────────

    /**
     * Compare, pour chaque membre et pour le mois {@code (annee, mois)}, le prorata
     * moyen réellement appliqué sur les postes {@code CHARGE}/{@code RESERVE} partagés
     * (pondéré par le montant de chaque poste) au prorata théorique qui s'appliquerait
     * si la répartition suivait le poids des revenus de chacun dans le total du foyer.
     * Voir {@link ProrataPartageMembreDto}.
     */
    @Cacheable(value = "projections",
               key = "#scenarioId + '-prorata-' + #annee + '-' + #mois + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public List<ProrataPartageMembreDto> prorataPartage(UUID foyerId, UUID scenarioId, int annee, int mois) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);
        return prorataPartageInterne(params, annee, mois, mois);
    }

    /**
     * Variante annuelle : mêmes règles que {@link #prorataPartage}, mais cumulées sur les
     * 12 mois de l'année (mensuel × 12 équivalent, comme {@link #tauxEffortAnnuel}).
     */
    @Cacheable(value = "projections",
               key = "#scenarioId + '-prorata-annuel-' + #annee + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public List<ProrataPartageMembreDto> prorataPartageAnnuel(UUID foyerId, UUID scenarioId, int annee) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);
        return prorataPartageInterne(params, annee, 1, 12);
    }

    private List<ProrataPartageMembreDto> prorataPartageInterne(ParametresScenario params, int annee,
                                                                  int moisDebut, int moisFin) {
        List<UUID> membreIds = params.membres();
        if (membreIds.size() <= 1) return List.of();

        Map<UUID, Membre> membresParId = membreRepo.findAllById(membreIds).stream()
                .collect(Collectors.toMap(Membre::getId, m -> m));

        // Postes CHARGE/RESERVE réellement partagés (cf. MoteurCalcul#estPersonnel) :
        // les postes personnels (CUSTOM à un seul membre) sont exclus du calcul.
        List<PosteCalcul> postesPartages = params.postes().stream()
                .filter(p -> p.type() == TypePoste.CHARGE || p.type() == TypePoste.RESERVE)
                .filter(p -> !MoteurCalcul.estPersonnel(p))
                .toList();

        double denominateurTotal = 0.0;
        Map<UUID, Double> numerateurParMembre = new LinkedHashMap<>();
        for (UUID membreId : membreIds) numerateurParMembre.put(membreId, 0.0);

        for (PosteCalcul poste : postesPartages) {
            for (int mois = moisDebut; mois <= moisFin; mois++) {
                double contribution = MoteurCalcul.contribution(poste, annee, mois)
                        * MoteurCalcul.tauxConversion(poste.devise(), params.deviseBase(), params.taux());
                if (contribution == 0.0) continue;
                denominateurTotal += contribution;
                for (UUID membreId : membreIds) {
                    double quotePart = MoteurCalcul.quotePartEffective(
                            poste, membreId, annee, mois, params.periodesDefaut(), membreIds.size());
                    if (quotePart > 0) {
                        numerateurParMembre.merge(membreId, contribution * quotePart, Double::sum);
                    }
                }
            }
        }

        // Revenus pris en compte pour le prorata théorique : seuls les postes REVENU dont
        // inclureProrataTheorique=true participent (cf. Poste#inclureProrataTheorique) — un
        // membre peut ainsi avoir des revenus exclus de cette moyenne pondérée (ex. allocations
        // qui ne reflètent pas sa capacité contributive réelle au foyer).
        List<PosteCalcul> postesRevenusProrata = params.postes().stream()
                .filter(p -> p.type() == TypePoste.REVENU)
                .filter(PosteCalcul::inclureProrataTheorique)
                .toList();

        double revenuFoyerTotal = 0.0;
        Map<UUID, Double> revenuParMembre = new LinkedHashMap<>();
        for (UUID membreId : membreIds) revenuParMembre.put(membreId, 0.0);

        for (PosteCalcul poste : postesRevenusProrata) {
            for (int mois = moisDebut; mois <= moisFin; mois++) {
                double contribution = MoteurCalcul.contribution(poste, annee, mois)
                        * MoteurCalcul.tauxConversion(poste.devise(), params.deviseBase(), params.taux());
                if (contribution == 0.0) continue;
                for (UUID membreId : membreIds) {
                    double quotePart = MoteurCalcul.quotePartEffective(
                            poste, membreId, annee, mois, params.periodesDefaut(), membreIds.size());
                    if (quotePart > 0) {
                        double contributionMembre = contribution * quotePart;
                        revenuParMembre.merge(membreId, contributionMembre, Double::sum);
                        revenuFoyerTotal += contributionMembre;
                    }
                }
            }
        }

        boolean aDesPostesPartages = denominateurTotal > 0;
        List<ProrataPartageMembreDto> resultat = new ArrayList<>();
        for (UUID membreId : membreIds) {
            Membre membre = membresParId.get(membreId);
            BigDecimal prorataMoyenApplique = aDesPostesPartages
                    ? bdRatio(numerateurParMembre.get(membreId) / denominateurTotal)
                    : null;
            BigDecimal prorataTheoriqueRevenu = revenuFoyerTotal > 0
                    ? bdRatio(revenuParMembre.get(membreId) / revenuFoyerTotal)
                    : null;
            resultat.add(new ProrataPartageMembreDto(
                    membreId,
                    membre != null ? membre.getNom() : null,
                    membre != null ? membre.getCouleur() : null,
                    prorataMoyenApplique,
                    prorataTheoriqueRevenu,
                    aDesPostesPartages));
        }
        return resultat;
    }

    /**
     * Construit un jeu de paramètres alternatif où chaque poste CHARGE/RESERVE de nature
     * ESTIMATION est majoré de {@code estimPourcentage} — simule le "pire cas" sans modifier
     * le moteur ({@link MoteurCalcul}), en reconstruisant une liste alternative de
     * {@link PosteCalcul} avec des montants majorés.
     */
    private ParametresScenario construireParamsPireCas(ParametresScenario params, UUID scenarioId, UUID foyerId) {
        // Pourcentage d'estimation par poste (non porté par PosteCalcul, chargé à part).
        Map<UUID, BigDecimal> estimPourcentageParPoste = posteRepo.findForMoteur(scenarioId, foyerId).stream()
                .filter(p -> p.getNature() == NaturePoste.ESTIMATION && p.getEstimPourcentage() != null)
                .collect(Collectors.toMap(Poste::getId, Poste::getEstimPourcentage, (a, b) -> a));

        List<PosteCalcul> postesPireCas = params.postes().stream()
                .map(pc -> {
                    BigDecimal pct = estimPourcentageParPoste.get(pc.id());
                    boolean chargeOuReserve = pc.type() == TypePoste.CHARGE || pc.type() == TypePoste.RESERVE;
                    if (pct == null || !chargeOuReserve) {
                        return pc;
                    }
                    double facteur = 1 + pct.doubleValue() / 100.0;
                    return new PosteCalcul(pc.id(), pc.type(), pc.montant() * facteur, pc.devise(),
                            pc.periodiciteMois(), pc.debut(), pc.fin(), pc.mode(), pc.moment(),
                            pc.nature(), pc.typeRepartition(), pc.repartitions(), pc.ventilations(),
                            pc.categorieId(), pc.posteOrigineId(), pc.description(), pc.inclureProrataTheorique());
                })
                .toList();
        return new ParametresScenario(
                params.deviseBase(), params.anneeDepart(), params.tresorerieInitiale(),
                params.horizonAnnees(), params.periodesDefaut(), params.taux(),
                postesPireCas, params.membres(), params.argentDePoche());
    }

    private TauxEffortMembreDto toTauxEffortDto(UUID membreId, Membre membre, AggregatMensuel normal, AggregatMensuel pireCas,
                                                double argentPoche, double argentPochePireCas) {
        return new TauxEffortMembreDto(
                membreId,
                membre != null ? membre.getNom() : null,
                membre != null ? membre.getCouleur() : null,
                bd(normal.revenus()),
                bd(normal.charges()),
                bd(normal.reserves()),
                bd(pireCas.charges()),
                bd(pireCas.reserves()),
                bd(argentPoche),
                bd(argentPochePireCas));
    }

    /**
     * Résout le montant d'argent de poche d'un membre pour un mois donné (indicateur
     * 04 — 3ᵉ jauge "charges + réserves + argent de poche"). Réutilise exactement le
     * même provider ({@code params.argentDePoche()}) et la même formule de RàV brut
     * que {@code MoteurCalcul.aggregatMembreMoisInterne} — aucune nouvelle règle de
     * calcul, seulement une exposition du montant déjà utilisé en interne pour réduire
     * {@code soldeDisponible}.
     */
    private double argentPocheMontant(ParametresScenario params, UUID membreId, int annee, int mois, AggregatMensuel agMois) {
        double ravBrut = agMois.revenus() - agMois.charges() - agMois.reserves();
        double poche = params.argentDePoche().montant(membreId, annee, mois, ravBrut);
        return Math.max(0, poche);
    }

    /**
     * T8.3 (optimisation) — Décomposition annuelle agrégée : somme des 12 mois calculée en
     * une seule requête/transaction serveur (au lieu de 12 appels {@code /mensuelle} côté
     * frontend), en réutilisant la même logique moteur mois par mois.
     */
    @Cacheable(value = "projections",
               key = "#scenarioId + '-vent-annuelle-' + #annee + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public VentilationAnnuelleDto ventilationsAnnuelle(UUID foyerId, UUID scenarioId, int annee) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);

        AggregatMensuel agFoyer = AggregatMensuel.zero();
        Map<UUID, AggregatMensuel> parMembre = new LinkedHashMap<>();
        Map<UUID, SplitPersoPartageMensuel> parMembreSplit = new LinkedHashMap<>();
        for (UUID membreId : params.membres()) {
            parMembre.put(membreId, AggregatMensuel.zero());
            parMembreSplit.put(membreId, SplitPersoPartageMensuel.zero());
        }
        Map<UUID, Double> parCat = new LinkedHashMap<>();
        Map<UUID, Map<UUID, Double>> parCatMembre = new LinkedHashMap<>();
        Map<UUID, Map<UUID, Double>> parCM = new LinkedHashMap<>();

        for (int m = 1; m <= 12; m++) {
            agFoyer = agFoyer.plus(MoteurCalcul.aggregatFoyerMois(params, annee, m));

            for (UUID membreId : params.membres()) {
                AggregatMensuel agMembreMois = MoteurCalcul.aggregatMembreMois(params, membreId, annee, m);
                parMembre.merge(membreId, agMembreMois, AggregatMensuel::plus);
                parMembreSplit.merge(membreId, MoteurCalcul.aggregatMembreMoisSplit(params, membreId, annee, m), this::plusSplit);

                // Argent de poche du mois : n'est pas un poste, absent de
                // `MoteurCalcul.ventilations` — fusionné ici dans `parCM` sur le compte
                // crédité (même RàV brut = revenus − charges − réserves qu'en mensuel).
                double ravBrut = agMembreMois.revenus() - agMembreMois.charges() - agMembreMois.reserves();
                ResolutionArgentPoche poche = argentPocheService.resoudre(scenarioId, membreId, YearMonth.of(annee, m), ravBrut);
                if (poche.compteId() != null && poche.montant() > 0) {
                    parCM.computeIfAbsent(poche.compteId(), k -> new LinkedHashMap<>())
                            .merge(membreId, poche.montant(), Double::sum);
                }
            }

            Ventilations v = MoteurCalcul.ventilations(params, annee, m);
            v.parCategorie().forEach((catId, montant) -> parCat.merge(catId, montant, Double::sum));
            v.parCategorieMembre().forEach((catId, memMap) -> {
                Map<UUID, Double> acc = parCatMembre.computeIfAbsent(catId, k -> new LinkedHashMap<>());
                memMap.forEach((membreId, montant) -> acc.merge(membreId, montant, Double::sum));
            });
            v.parCompteMembre().forEach((compteId, memMap) -> {
                Map<UUID, Double> acc = parCM.computeIfAbsent(compteId, k -> new LinkedHashMap<>());
                memMap.forEach((membreId, montant) -> acc.merge(membreId, montant, Double::sum));
            });
        }

        Map<UUID, VentilationAnnuelleDto.AggregatDto> parMembreDto = parMembre.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> toVentAnnuelleAggregatDto(e.getValue()),
                        (a, b) -> a, LinkedHashMap::new));
        Map<UUID, VentilationAnnuelleDto.SplitDto> parMembreSplitDto = parMembreSplit.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> toVentAnnuelleSplitDto(e.getValue()),
                        (a, b) -> a, LinkedHashMap::new));
        Map<UUID, BigDecimal> parCatDto = parCat.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> bd(e.getValue()), (a, b) -> a, LinkedHashMap::new));
        Map<UUID, Map<UUID, BigDecimal>> parCatMembreDto = parCatMembre.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey,
                        e -> e.getValue().entrySet().stream()
                                .collect(Collectors.toMap(Map.Entry::getKey, ie -> bd(ie.getValue()), (a, b) -> a, LinkedHashMap::new)),
                        (a, b) -> a, LinkedHashMap::new));
        Map<UUID, Map<UUID, BigDecimal>> parCMDto = parCM.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey,
                        e -> e.getValue().entrySet().stream()
                                .collect(Collectors.toMap(Map.Entry::getKey, ie -> bd(ie.getValue()), (a, b) -> a, LinkedHashMap::new)),
                        (a, b) -> a, LinkedHashMap::new));

        return new VentilationAnnuelleDto(annee, toVentAnnuelleAggregatDto(agFoyer), parMembreDto,
                parCatDto, parCatMembreDto, parCMDto, parMembreSplitDto);
    }

    private SplitPersoPartageMensuel plusSplit(SplitPersoPartageMensuel a, SplitPersoPartageMensuel b) {
        return new SplitPersoPartageMensuel(
                a.revenusPerso() + b.revenusPerso(), a.revenusPartage() + b.revenusPartage(),
                a.chargesPerso() + b.chargesPerso(), a.chargesPartage() + b.chargesPartage(),
                a.reservesPerso() + b.reservesPerso(), a.reservesPartage() + b.reservesPartage());
    }

    /**
     * Fusionne l'argent de poche résolu par membre (montant + compte crédité) dans la
     * ventilation par compte/membre issue du moteur (`v.parCompteMembre()`, qui ne
     * connaît que les postes). Retourne une nouvelle map mutable, sans modifier
     * l'original — un membre sans politique/allocation active (source
     * {@code AUCUNE}, `compteId` null) ne modifie rien, comportement strictement
     * inchangé.
     */
    private Map<UUID, Map<UUID, Double>> fusionnerArgentPocheDansComptes(
            Map<UUID, Map<UUID, Double>> parCompteMembre,
            Map<UUID, ResolutionArgentPoche> pocheParMembre) {
        Map<UUID, Map<UUID, Double>> resultat = new LinkedHashMap<>();
        parCompteMembre.forEach((compteId, memMap) -> resultat.put(compteId, new LinkedHashMap<>(memMap)));
        pocheParMembre.forEach((membreId, poche) -> {
            if (poche.compteId() == null || poche.montant() <= 0) return;
            resultat.computeIfAbsent(poche.compteId(), k -> new LinkedHashMap<>())
                    .merge(membreId, poche.montant(), Double::sum);
        });
        return resultat;
    }

    private VentilationAnnuelleDto.AggregatDto toVentAnnuelleAggregatDto(AggregatMensuel ag) {
        return new VentilationAnnuelleDto.AggregatDto(
                bd(ag.revenus()), bd(ag.charges()), bd(ag.reserves()), bd(ag.soldeDisponible()));
    }

    private VentilationAnnuelleDto.SplitDto toVentAnnuelleSplitDto(SplitPersoPartageMensuel split) {
        return new VentilationAnnuelleDto.SplitDto(
                bd(split.revenusPerso()), bd(split.revenusPartage()),
                bd(split.chargesPerso()), bd(split.chargesPartage()),
                bd(split.reservesPerso()), bd(split.reservesPartage()));
    }

    private VentilationsDto.AggregatDto toVentAggregatDto(AggregatMensuel ag) {
        return new VentilationsDto.AggregatDto(
                bd(ag.revenus()), bd(ag.charges()), bd(ag.reserves()), bd(ag.soldeDisponible()));
    }

    private VentilationsDto.SplitDto toVentSplitDto(SplitPersoPartageMensuel split) {
        return new VentilationsDto.SplitDto(
                bd(split.revenusPerso()), bd(split.revenusPartage()),
                bd(split.chargesPerso()), bd(split.chargesPartage()),
                bd(split.reservesPerso()), bd(split.reservesPartage()));
    }

    // ── T8.6 ─────────────────────────────────────────────────────────────────

    public ApercuPosteDto apercuPoste(UUID foyerId, UUID scenarioId, UUID posteId, int annee) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);
        PosteCalcul pc = params.postes().stream().filter(p -> posteId.equals(p.id()))
                .findFirst()
                .orElseThrow(() -> new EntityNotFoundException("Poste introuvable : " + posteId));
        List<ApercuPosteDto.MoisContributionDto> contributions = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            double c = MoteurCalcul.contribution(pc, annee, m)
                    * MoteurCalcul.tauxConversion(pc.devise(), params.deviseBase(), params.taux());
            contributions.add(new ApercuPosteDto.MoisContributionDto(m, bd(c)));
        }
        return new ApercuPosteDto(annee, contributions);
    }

    // ── Événements budgétaires ("ce qui change") ────────────────────────────

    @Cacheable(value = "projections",
               key = "#scenarioId + '-evt-' + #annee + '-' + #membreId + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public List<EvenementDto> evenements(UUID foyerId, UUID scenarioId, int annee, UUID membreId) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);
        List<EvenementCalcul> evenements = MoteurCalcul.evenements(params.postes(), annee);
        Map<UUID, PosteCalcul> postesParId = params.postes().stream()
                .collect(Collectors.toMap(PosteCalcul::id, p -> p, (a, b) -> a));

        return evenements.stream()
                .map(e -> {
                    double quotePart = 1.0;
                    if (membreId != null) {
                        PosteCalcul poste = postesParId.get(e.posteId());
                        // Poste introuvable (défensif) : on l'exclut plutôt que de l'attribuer à tort au foyer.
                        if (poste == null) return null;
                        quotePart = MoteurCalcul.quotePartEffective(
                                poste, membreId, annee, e.mois(), params.periodesDefaut(), params.membres().size());
                        if (quotePart <= 0) return null;
                    }
                    return toEvenementDto(e, params, quotePart);
                })
                .filter(Objects::nonNull)
                .toList();
    }

    private EvenementDto toEvenementDto(EvenementCalcul e, ParametresScenario params, double quotePart) {
        double taux = MoteurCalcul.tauxConversion(e.devise(), params.deviseBase(), params.taux());
        double facteur = taux * quotePart;
        BigDecimal montantOrigine = e.montantOrigine() != null ? bd(e.montantOrigine() * facteur) : null;
        return new EvenementDto(
                e.mois(), e.type(), e.posteId(), e.description(), e.categorieId(),
                e.typePoste(), e.nature(),
                bd(e.montant() * facteur),
                e.periodiciteMois(), e.mode(),
                montantOrigine, e.periodiciteMoisOrigine(), e.modeOrigine(),
                bd(quotePart));
    }

    // ── Récapitulatif mensuel par compte (dashboard, vue membre) ────────────

    /**
     * Récapitulatif mensuel de trésorerie par compte pour un membre donné : virements
     * entrants/sortants simulés (comblement via compte primaire si configuré, sinon
     * mode "legacy"), entrées échues, sorties planifiées/échues, solde restant. Renvoie
     * les comptes dont {@code membreId} est co-titulaire, ainsi que tout autre compte sur
     * lequel il a un montant non nul (ex. il ventile un poste vers le compte primaire d'un
     * autre membre, ou il est propriétaire d'un primaire crédité par un autre membre — voir
     * {@link ComptesFluxSimulateur}) ; les montants sont scopés à la seule part de
     * {@code membreId} sur chaque compte (pas le flux de caisse total du compte, qui
     * regrouperait tous les co-titulaires — prévu pour une future vue "foyer").
     */
    @Cacheable(value = "projections",
               key = "#scenarioId + '-recap-compte-' + #annee + '-' + #mois + '-' + #membreId + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public List<CompteRecapMensuelDto> recapComptesMembre(UUID foyerId, UUID scenarioId, int annee, int mois, UUID membreId) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);

        List<Compte> tousComptes = compteRepo.findAllByFoyerIdAndActifTrueOrderByLibelleAsc(foyerId);

        Map<UUID, UUID> primairesParMembre = chargerPrimairesParMembre(foyerId);
        Map<UUID, List<CompteFluxMensuel>> flux = ComptesFluxSimulateur.simuler(
                params, tousComptes, primairesParMembre, membreId, annee, mois, argentPocheService, scenarioId);

        // Un compte est restitué s'il appartient au membre, OU si la simulation contient un
        // montant non nul pour lui sur ce compte (ex. il ventile un poste vers le compte
        // primaire d'un autre membre, ou reçoit un virement entrant sur le primaire dont il est
        // propriétaire — voir ComptesFluxSimulateur) : dans les deux cas le membre a un intérêt
        // réel à voir ce compte apparaître dans son propre récapitulatif.
        List<Compte> comptesMembre = tousComptes.stream()
                .filter(c -> c.getMembres().stream().anyMatch(m -> m.getId().equals(membreId))
                        || compteConcerneParMembre(flux.getOrDefault(c.getId(), List.of())))
                .toList();

        List<CompteRecapMensuelDto> resultat = new ArrayList<>();
        for (Compte compte : comptesMembre) {
            List<CompteFluxMensuel> historique = flux.getOrDefault(compte.getId(), List.of());
            if (historique.isEmpty()) continue;
            CompteFluxMensuel f = historique.get(historique.size() - 1);

            resultat.add(new CompteRecapMensuelDto(
                    compte.getId(), compte.getLibelle(),
                    bd(f.virementsEntrants()), bd(f.entrees()), bd(f.sortiesPlanifiees()), bd(f.sortiesEchues()),
                    bd(f.virementsSortants()), bd(f.reservesEchues()), bd(f.soldeRestant())));
        }
        return resultat;
    }

    /**
     * Variante annuelle de {@link #recapComptesMembre} : les flux mensuels (entrées, sorties
     * planifiées/échues, virements entrants/sortants) sont sommés sur les 12 mois de l'année
     * {@code annee} — contrairement à {@code soldeRestant}, qui reste un instantané (état de
     * trésorerie chaînée fin décembre) et n'est donc jamais additionné, comme pour la vue
     * mensuelle. Réutilise la même simulation {@link ComptesFluxSimulateur#simuler} jusqu'à
     * décembre, puis ne garde que les mois de l'année demandée.
     */
    @Cacheable(value = "projections",
               key = "#scenarioId + '-recap-compte-annuel-' + #annee + '-' + #membreId + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public List<CompteRecapMensuelDto> recapComptesMembreAnnuel(UUID foyerId, UUID scenarioId, int annee, UUID membreId) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);

        List<Compte> tousComptes = compteRepo.findAllByFoyerIdAndActifTrueOrderByLibelleAsc(foyerId);

        Map<UUID, UUID> primairesParMembre = chargerPrimairesParMembre(foyerId);
        Map<UUID, List<CompteFluxMensuel>> flux = ComptesFluxSimulateur.simuler(
                params, tousComptes, primairesParMembre, membreId, annee, 12, argentPocheService, scenarioId);

        // Même règle d'inclusion que recapComptesMembre (voir ci-dessus) — appliquée sur les
        // seuls mois de l'année demandée.
        List<Compte> comptesMembre = tousComptes.stream()
                .filter(c -> c.getMembres().stream().anyMatch(m -> m.getId().equals(membreId))
                        || compteConcerneParMembre(flux.getOrDefault(c.getId(), List.of()).stream()
                                .filter(f -> f.annee() == annee).toList()))
                .toList();

        List<CompteRecapMensuelDto> resultat = new ArrayList<>();
        for (Compte compte : comptesMembre) {
            List<CompteFluxMensuel> historiqueAnnee = flux.getOrDefault(compte.getId(), List.of()).stream()
                    .filter(f -> f.annee() == annee)
                    .toList();
            if (historiqueAnnee.isEmpty()) continue;

            double virementsEntrants = 0, entrees = 0, sortiesPlanifiees = 0, sortiesEchues = 0, virementsSortants = 0, reservesEchues = 0;
            for (CompteFluxMensuel f : historiqueAnnee) {
                virementsEntrants += f.virementsEntrants();
                entrees += f.entrees();
                sortiesPlanifiees += f.sortiesPlanifiees();
                sortiesEchues += f.sortiesEchues();
                virementsSortants += f.virementsSortants();
                reservesEchues += f.reservesEchues();
            }
            double soldeFinAnnee = historiqueAnnee.get(historiqueAnnee.size() - 1).soldeRestant();

            resultat.add(new CompteRecapMensuelDto(
                    compte.getId(), compte.getLibelle(),
                    bd(virementsEntrants), bd(entrees), bd(sortiesPlanifiees), bd(sortiesEchues),
                    bd(virementsSortants), bd(reservesEchues), bd(soldeFinAnnee)));
        }
        return resultat;
    }

    /**
     * Vrai si au moins un des mois de l'historique porte un montant non nul (entrées,
     * sorties, virements entrants/sortants) pour le membre demandé sur ce compte — utilisé
     * pour inclure, dans le récapitulatif d'un membre, un compte dont il n'est pas
     * co-titulaire mais qu'il finance (ou dont il reçoit un virement, s'il en est le
     * propriétaire du primaire) via la logique de compte primaire.
     */
    private static boolean compteConcerneParMembre(List<CompteFluxMensuel> historique) {
        return historique.stream().anyMatch(f ->
                Math.abs(f.entrees()) > 1e-9 || Math.abs(f.sortiesPlanifiees()) > 1e-9
                        || Math.abs(f.sortiesEchues()) > 1e-9 || Math.abs(f.virementsEntrants()) > 1e-9
                        || Math.abs(f.virementsSortants()) > 1e-9);
    }

    /**
     * Détail poste par poste (+ argent de poche éventuel) alimentant un compte donné pour
     * un membre et un mois donnés — sous-tend l'affichage de la liste des postes lorsqu'un
     * compte est sélectionné dans la vue "Virements des comptes" (org-chart hub & rayons).
     * Ne retourne rien (liste vide) si {@code compteId} n'est pas un compte actif du foyer.
     */
    @Cacheable(value = "projections",
               key = "#scenarioId + '-recap-compte-postes-' + #annee + '-' + #mois + '-' + #membreId + '-' + #compteId + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public List<ComptePosteDetailDto> recapComptePostes(UUID foyerId, UUID scenarioId, int annee, int mois, UUID membreId, UUID compteId) {
        boolean compteActifDuFoyer = compteRepo.findAllByFoyerIdAndActifTrueOrderByLibelleAsc(foyerId).stream()
                .anyMatch(c -> c.getId().equals(compteId));
        if (!compteActifDuFoyer) return List.of();

        ParametresScenario params = chargerParametres(foyerId, scenarioId);

        List<ComptePosteDetailDto> resultat = new ArrayList<>();
        for (PosteContributionDetail d : MoteurCalcul.posteContributionsCompteMembre(params, compteId, membreId, annee, mois)) {
            resultat.add(new ComptePosteDetailDto(d.posteId(), d.libelle(), d.type(), false, bd(d.montant()), bd(d.quotePart())));
        }

        AggregatMensuel ag = MoteurCalcul.aggregatMembreMois(params, membreId, annee, mois);
        double ravBrut = ag.revenus() - ag.charges() - ag.reserves();
        ResolutionArgentPoche poche = argentPocheService.resoudre(scenarioId, membreId, YearMonth.of(annee, mois), ravBrut);
        if (compteId.equals(poche.compteId()) && poche.montant() > 0) {
            // Comptée comme une dépense (CHARGE), pas un revenu — voir ComptesFluxSimulateur.
            resultat.add(new ComptePosteDetailDto(null, null, TypePoste.CHARGE, true, bd(poche.montant()), null));
        }

        return resultat;
    }

    /** Charge, pour tous les membres actifs du foyer, l'id de leur compte primaire
     *  configuré (absent de la map = aucun primaire, mode "legacy"). */
    private Map<UUID, UUID> chargerPrimairesParMembre(UUID foyerId) {
        Map<UUID, UUID> primaires = new HashMap<>();
        for (CompteMembre cm : compteMembreRepo.findAllByCompte_Foyer_IdAndEstPrimaireTrue(foyerId)) {
            primaires.put(cm.getMembre().getId(), cm.getCompte().getId());
        }
        return primaires;
    }

    /** Invalide tout le cache (appelé après toute modification). */
    @CacheEvict(value = "projections", allEntries = true)
    public void invaliderCache(UUID scenarioId) {
        log.debug("Cache projection invalidé pour scenarioId={}", scenarioId);
    }

    // ── chargement JPA → records moteur ──────────────────────────────────────

    public ParametresScenario chargerParametres(UUID foyerId, UUID scenarioId) {
        Scenario scenario = scenarioRepo.findScenarioAvecRepartitions(scenarioId, foyerId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "Scénario %s introuvable pour le foyer %s".formatted(scenarioId, foyerId)));

        // Charger les périodes de répartition (triées par debut ASC)
        List<ch.homely.scenario.RepartitionPeriode> periodes =
                periodeRepo.findWithPartsForScenario(scenarioId, foyerId);

        List<RepartitionPeriodeCalcul> periodesCalcul = periodes.stream()
                .map(p -> new RepartitionPeriodeCalcul(
                        p.getDebut(), p.getFin(),
                        p.getParts().stream()
                                .map(pp -> new RepartitionCalcul(
                                        pp.getMembre().getId(),
                                        pp.getQuotePart().doubleValue()))
                                .toList()))
                .toList();

        // Membres actifs = ceux de la période ouverte (fin=null); fallback sur les autres si aucune
        List<UUID> membres = periodes.stream()
                .filter(p -> p.getFin() == null)
                .flatMap(p -> p.getParts().stream().map(pp -> pp.getMembre().getId()))
                .distinct()
                .collect(java.util.stream.Collectors.toList());
        if (membres.isEmpty() && !periodes.isEmpty()) {
            // Fallback : membres de la dernière période
            ch.homely.scenario.RepartitionPeriode derniere = periodes.get(periodes.size() - 1);
            membres = derniere.getParts().stream()
                    .map(pp -> pp.getMembre().getId()).toList();
        }

        Map<String, Double> taux = tauxRepo.findAllByFoyerId(foyerId).stream()
                .collect(Collectors.toMap(TauxChange::getDevise, t -> t.getTauxVersBase().doubleValue()));

        List<Poste> postesRep  = posteRepo.findForMoteur(scenarioId, foyerId);
        List<Poste> postesVent = posteRepo.findForMoteurVentilations(scenarioId, foyerId);
        Map<UUID, Poste> ventIndex = new HashMap<>();
        for (Poste pVent : postesVent) {
            ventIndex.put(pVent.getId(), pVent);
        }

        List<PosteCalcul> postesCalc = postesRep.stream()
                .map(p -> mapperPoste(p, ventIndex.get(p.getId()), scenario.getFoyer().getDeviseBase()))
                .toList();

        return new ParametresScenario(
                scenario.getFoyer().getDeviseBase(),
                scenario.getAnneeDepart(),
                scenario.getTresorerieInitiale().doubleValue(),
                scenario.getHorizonAnnees(),
                periodesCalcul, taux, postesCalc, membres,
                argentPocheFactory.pourScenario(scenarioId));
    }

    private PosteCalcul mapperPoste(Poste p, Poste pVent, String deviseBase) {
        List<RepartitionCalcul> repartitions = p.getRepartitions().stream()
                .map(r -> new RepartitionCalcul(r.getMembre().getId(), r.getQuotePart().doubleValue()))
                .toList();
        List<VentilationCalcul> ventilations = (pVent != null)
                ? pVent.getVentilations().stream()
                        .map(v -> new VentilationCalcul(v.getMembre().getId(), v.getCompte().getId()))
                        .toList()
                : List.of();
        return new PosteCalcul(p.getId(), p.getType(), p.getMontant().doubleValue(),
                p.getDevise() != null ? p.getDevise() : deviseBase,
                p.getPeriodiciteMois(), p.getDebut(), p.getFin(), p.getMode(), p.getMoment(),
                p.getNature(),
                p.getTypeRepartition(),
                repartitions, ventilations,
                p.getCategorie() != null ? p.getCategorie().getId() : null,
                p.getPosteOrigineId(), p.getDescription(), p.isInclureProrataTheorique());
    }

    // ── mappers ───────────────────────────────────────────────────────────────

    private ProjectionAnnuelleDto toAnnuelleDto(ProjectionAnnuelle pa) {
        List<ProjectionAnnuelleDto.MoisDto> mois     = new ArrayList<>();
        List<ProjectionAnnuelleDto.MoisDto> moisReel = new ArrayList<>();
        for (int m = 0; m < 12; m++) {
            mois.add(new ProjectionAnnuelleDto.MoisDto(m + 1, toAggregatDto(pa.mois().get(m))));
            moisReel.add(new ProjectionAnnuelleDto.MoisDto(m + 1, toAggregatDto(pa.moisReel().get(m))));
        }
        Map<UUID, ProjectionAnnuelleDto.AggregatDto> parMembre = pa.parMembre().entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> toAggregatDto(e.getValue())));
        Map<UUID, List<ProjectionAnnuelleDto.AggregatDto>> moisParMembre = pa.moisParMembre().entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> e.getValue().stream().map(this::toAggregatDto).toList()));
        Map<UUID, List<ProjectionAnnuelleDto.AggregatDto>> moisParMembreReel = pa.moisParMembreReel().entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        e -> e.getValue().stream().map(this::toAggregatDto).toList()));
        return new ProjectionAnnuelleDto(pa.annee(), mois, moisReel, toAggregatDto(pa.totalAnnuel()),
                parMembre, moisParMembre, moisParMembreReel);
    }

    private ProjectionAnnuelleDto.AggregatDto toAggregatDto(AggregatMensuel ag) {
        return new ProjectionAnnuelleDto.AggregatDto(
                bd(ag.revenus()), bd(ag.charges()), bd(ag.reserves()), bd(ag.soldeDisponible()));
    }

    private static BigDecimal bd(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }

    /** Arrondi une quote-part/prorata ∈ [0,1] avec la même précision que
     *  {@code repartition_poste.quote_part} (scale 6) — évite d'écraser des écarts
     *  fins (ex. 0.55 vs 0.5678) au dixième près comme le ferait {@link #bd(double)}. */
    private static BigDecimal bdRatio(double v) {
        return BigDecimal.valueOf(v).setScale(6, RoundingMode.HALF_UP);
    }

    public static String versionKey(UUID foyerId, UUID scenarioId, ScenarioRepository repo) {
        return repo.findByIdAndFoyerId(scenarioId, foyerId)
                .map(s -> s.getDateModification().toEpochMilli())
                .map(String::valueOf)
                .orElse("0");
    }
}
