package ch.homely.projection;

import ch.homely.compte.Compte;
import ch.homely.compte.CompteMembre;
import ch.homely.compte.CompteMembreRepository;
import ch.homely.compte.CompteRepository;
import ch.homely.membre.Membre;
import ch.homely.membre.MembreRepository;
import ch.homely.moteur.*;
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

    public ProjectionService(ScenarioRepository scenarioRepo, PosteRepository posteRepo,
                             TauxChangeRepository tauxRepo, CompteRepository compteRepo,
                             RepartitionPeriodeRepository periodeRepo, MembreRepository membreRepo,
                             CompteMembreRepository compteMembreRepo) {
        this.scenarioRepo = scenarioRepo;
        this.posteRepo    = posteRepo;
        this.tauxRepo     = tauxRepo;
        this.compteRepo   = compteRepo;
        this.periodeRepo  = periodeRepo;
        this.membreRepo   = membreRepo;
        this.compteMembreRepo = compteMembreRepo;
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
            resultat.add(toTauxEffortDto(membreId, membresParId.get(membreId), normal, pireCas));
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
            for (int m = 1; m <= 12; m++) {
                normal  = normal.plus(MoteurCalcul.aggregatMembreMois(params, membreId, annee, m));
                pireCas = pireCas.plus(MoteurCalcul.aggregatMembreMois(paramsPireCas, membreId, annee, m));
            }
            resultat.add(toTauxEffortDto(membreId, membresParId.get(membreId), normal, pireCas));
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
                            pc.categorieId(), pc.posteOrigineId(), pc.description());
                })
                .toList();
        return new ParametresScenario(
                params.deviseBase(), params.anneeDepart(), params.tresorerieInitiale(),
                params.horizonAnnees(), params.periodesDefaut(), params.taux(),
                postesPireCas, params.membres());
    }

    private TauxEffortMembreDto toTauxEffortDto(UUID membreId, Membre membre, AggregatMensuel normal, AggregatMensuel pireCas) {
        return new TauxEffortMembreDto(
                membreId,
                membre != null ? membre.getNom() : null,
                membre != null ? membre.getCouleur() : null,
                bd(normal.revenus()),
                bd(normal.charges()),
                bd(normal.reserves()),
                bd(pireCas.charges()),
                bd(pireCas.reserves()));
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
                parMembre.merge(membreId, MoteurCalcul.aggregatMembreMois(params, membreId, annee, m), AggregatMensuel::plus);
                parMembreSplit.merge(membreId, MoteurCalcul.aggregatMembreMoisSplit(params, membreId, annee, m), this::plusSplit);
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
     * mode "legacy"), entrées échues, sorties planifiées/échues, solde restant et
     * indicateur d'insuffisance. Ne renvoie que les comptes dont {@code membreId} est
     * co-titulaire ; les montants sont scopés à la seule part de {@code membreId} sur
     * chaque compte (pas le flux de caisse total du compte, qui regrouperait tous les
     * co-titulaires — prévu pour une future vue "foyer").
     */
    @Cacheable(value = "projections",
               key = "#scenarioId + '-recap-compte-' + #annee + '-' + #mois + '-' + #membreId + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public List<CompteRecapMensuelDto> recapComptesMembre(UUID foyerId, UUID scenarioId, int annee, int mois, UUID membreId) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);

        List<Compte> tousComptes = compteRepo.findAllByFoyerIdAndActifTrueOrderByLibelleAsc(foyerId);
        List<Compte> comptesMembre = tousComptes.stream()
                .filter(c -> c.getMembres().stream().anyMatch(m -> m.getId().equals(membreId)))
                .toList();

        Map<UUID, UUID> primairesParMembre = chargerPrimairesParMembre(foyerId);
        Map<UUID, List<CompteFluxMensuel>> flux = ComptesFluxSimulateur.simuler(
                params, tousComptes, primairesParMembre, membreId, annee, mois);

        List<CompteRecapMensuelDto> resultat = new ArrayList<>();
        for (Compte compte : comptesMembre) {
            List<CompteFluxMensuel> historique = flux.getOrDefault(compte.getId(), List.of());
            if (historique.isEmpty()) continue;
            CompteFluxMensuel f = historique.get(historique.size() - 1);

            // Insuffisant seulement si la trésorerie cumulée du compte (part du membre,
            // buffer des mois précédents inclus) ne peut pas encaisser le solde négatif
            // de ce mois — un simple mois déficitaire absorbé par l'épargne accumulée
            // ne doit pas déclencher l'alerte.
            boolean insuffisant = f.tresorerieCumulee() < 0;
            resultat.add(new CompteRecapMensuelDto(
                    compte.getId(), compte.getLibelle(),
                    bd(f.virementsEntrants()), bd(f.entrees()), bd(f.sortiesPlanifiees()), bd(f.sortiesEchues()),
                    bd(f.virementsSortants()), bd(f.soldeRestant()), insuffisant,
                    bd(insuffisant ? -f.tresorerieCumulee() : 0)));
        }
        return resultat;
    }

    /** Nombre de mois futurs (au-delà du mois demandé) inclus dans la timeline de
     *  trésorerie des comptes, pour donner une visibilité à venir en plus de
     *  l'historique (mois courant + N mois futurs dans la fenêtre {@code nbMois}). */
    private static final int NB_MOIS_FUTURS_TIMELINE_COMPTES = 2;

    /**
     * Timeline de trésorerie cumulée par compte pour un membre donné, sur {@code nbMois}
     * mois se terminant {@link #NB_MOIS_FUTURS_TIMELINE_COMPTES} mois après le mois
     * demandé (par défaut 6 : M-3..M+2, mois courant et 2 mois futurs inclus). Chaîne la
     * part du membre dans le solde initial du compte (réparti à parts égales entre
     * co-titulaires) avec la somme de ses soldes restants mensuels (sa part des entrées +
     * virements entrants − sorties échues − virements sortants) calculés mois par mois
     * depuis le début du scénario jusqu'au mois final de la fenêtre — même simulation que
     * {@link #recapComptesMembre}, prolongée dans le futur pour la projection.
     */
    @Cacheable(value = "projections",
               key = "#scenarioId + '-treso-compte-' + #annee + '-' + #mois + '-' + #membreId + '-' + #nbMois + '-' + T(ch.homely.projection.ProjectionService).versionKey(#foyerId, #scenarioId, @scenarioRepository)")
    public List<CompteTresorerieDto> tresorerieComptesMembre(UUID foyerId, UUID scenarioId, int annee, int mois, UUID membreId, int nbMois) {
        ParametresScenario params = chargerParametres(foyerId, scenarioId);

        List<Compte> tousComptes = compteRepo.findAllByFoyerIdAndActifTrueOrderByLibelleAsc(foyerId);
        List<Compte> comptesMembre = tousComptes.stream()
                .filter(c -> c.getMembres().stream().anyMatch(m -> m.getId().equals(membreId)))
                .toList();

        int anneeFin = annee;
        int moisFin = mois + NB_MOIS_FUTURS_TIMELINE_COMPTES;
        while (moisFin > 12) { moisFin -= 12; anneeFin++; }

        Map<UUID, UUID> primairesParMembre = chargerPrimairesParMembre(foyerId);
        Map<UUID, List<CompteFluxMensuel>> flux = ComptesFluxSimulateur.simuler(
                params, tousComptes, primairesParMembre, membreId, anneeFin, moisFin);

        return comptesMembre.stream()
                .map(compte -> {
                    List<CompteFluxMensuel> historique = flux.getOrDefault(compte.getId(), List.of());
                    List<CompteTresorerieDto.PointTresorerieDto> points = historique.stream()
                            .skip(Math.max(0, historique.size() - nbMois))
                            .map(f -> new CompteTresorerieDto.PointTresorerieDto(f.annee(), f.mois(), bd(f.tresorerieCumulee())))
                            .toList();
                    return new CompteTresorerieDto(compte.getId(), compte.getLibelle(), points);
                })
                .toList();
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
                p.getCategorie() != null ? p.getCategorie().getId() : null,
                p.getPosteOrigineId(), p.getDescription());
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
