package ch.homely.projection;

import ch.homely.actif.Actif;
import ch.homely.actif.ActifRepository;
import ch.homely.compte.Compte;
import ch.homely.compte.CompteRepository;
import ch.homely.moteur.*;
import ch.homely.poste.Poste;
import ch.homely.poste.PosteRepository;
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
    private final ActifRepository          actifRepo;
    private final RepartitionPeriodeRepository periodeRepo;

    public ProjectionService(ScenarioRepository scenarioRepo, PosteRepository posteRepo,
                             TauxChangeRepository tauxRepo, CompteRepository compteRepo,
                             ActifRepository actifRepo,
                             RepartitionPeriodeRepository periodeRepo) {
        this.scenarioRepo = scenarioRepo;
        this.posteRepo    = posteRepo;
        this.tauxRepo     = tauxRepo;
        this.compteRepo   = compteRepo;
        this.actifRepo    = actifRepo;
        this.periodeRepo  = periodeRepo;
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

    // ── T8.3 ─────────────────────────────────────────────────────────────────

    @Cacheable(value = "projections",
               key = "#scenarioId + '-vent-' + #annee + '-' + #mois + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public VentilationsDto ventilations(UUID foyerId, UUID scenarioId, int annee, int mois) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);

        // Agrégat foyer du mois
        AggregatMensuel agFoyer = MoteurCalcul.aggregatFoyerMois(params, annee, mois);
        VentilationsDto.AggregatDto agregat = toVentAggregatDto(agFoyer);

        // Agrégat par membre du mois
        Map<UUID, VentilationsDto.AggregatDto> parMembre = new LinkedHashMap<>();
        Map<UUID, VentilationsDto.SplitDto> parMembreSplit = new LinkedHashMap<>();
        for (UUID membreId : params.membres()) {
            AggregatMensuel ag = MoteurCalcul.aggregatMembreMois(params, membreId, annee, mois);
            parMembre.put(membreId, toVentAggregatDto(ag));
            SplitPersoPartageMensuel split = MoteurCalcul.aggregatMembreMoisSplit(params, membreId, annee, mois);
            parMembreSplit.put(membreId, toVentSplitDto(split));
        }

        // Ventilations par catégorie, par catégorie/membre et par compte/membre
        Ventilations v = MoteurCalcul.ventilations(params, annee, mois);
        Map<UUID, BigDecimal> parCat = v.parCategorie().entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> bd(e.getValue())));
        Map<UUID, Map<UUID, BigDecimal>> parCatMembre = v.parCategorieMembre().entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey,
                        e -> e.getValue().entrySet().stream()
                                .collect(Collectors.toMap(Map.Entry::getKey, ie -> bd(ie.getValue())))));
        Map<UUID, Map<UUID, BigDecimal>> parCM = v.parCompteMembre().entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey,
                        e -> e.getValue().entrySet().stream()
                                .collect(Collectors.toMap(Map.Entry::getKey, ie -> bd(ie.getValue())))));
        return new VentilationsDto(annee, mois, agregat, parMembre, parCat, parCatMembre, parCM, parMembreSplit);
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


    // ── T8.5 ─────────────────────────────────────────────────────────────────

    public ComparaisonDto comparaison(UUID foyerId, List<UUID> scenarioIds) {
        List<String> noms = new ArrayList<>();
        List<ProjectionPluriannuelle> projections = new ArrayList<>();
        for (UUID sid : scenarioIds) {
            Scenario s = scenarioRepo.findByIdAndFoyerId(sid, foyerId)
                    .orElseThrow(() -> new EntityNotFoundException("Scénario introuvable : " + sid));
            noms.add(s.getNom());
            projections.add(MoteurCalcul.projectionPluriannuelle(chargerParametres(foyerId, sid)));
        }

        int minAnnee = projections.stream().flatMap(p -> p.annees().stream())
                .mapToInt(ProjectionAnnuelle::annee).min().orElse(0);
        int maxAnnee = projections.stream().flatMap(p -> p.annees().stream())
                .mapToInt(ProjectionAnnuelle::annee).max().orElse(0);

        List<ComparaisonDto.SerieAnnuelleDto> series = new ArrayList<>();
        for (int annee = minAnnee; annee <= maxAnnee; annee++) {
            final int a = annee;
            Map<UUID, BigDecimal> soldes = new LinkedHashMap<>();
            Map<UUID, BigDecimal> tresos  = new LinkedHashMap<>();
            for (int i = 0; i < scenarioIds.size(); i++) {
                UUID sid = scenarioIds.get(i);
                projections.get(i).tresorerie().stream().filter(t -> t.annee() == a).findFirst()
                        .ifPresent(t -> {
                            soldes.put(sid, bd(t.soldeAnnuel()));
                            tresos.put(sid, bd(t.tresorerieFinAnnee()));
                        });
            }
            if (!soldes.isEmpty()) series.add(new ComparaisonDto.SerieAnnuelleDto(a, soldes, tresos));
        }
        return new ComparaisonDto(scenarioIds, noms, series);
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
        if (membres.isEmpty()) {
            // Ultime fallback : anciennes repartitionsDefaut
            membres = scenario.getRepartitionsDefaut().stream()
                    .map(r -> r.getMembre().getId()).toList();
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
                periodesCalcul, taux, postesCalc, membres);
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
                p.getCategorie() != null ? p.getCategorie().getId() : null);
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

    public static String versionKey(UUID foyerId, UUID scenarioId, ScenarioRepository repo) {
        return repo.findByIdAndFoyerId(scenarioId, foyerId)
                .map(s -> s.getDateModification().toEpochMilli())
                .map(String::valueOf)
                .orElse("0");
    }
}
