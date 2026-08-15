package ch.homely.compte;

import ch.homely.commun.CodesErreur;
import ch.homely.commun.RegleMetierException;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.compte.dto.CompteDto;
import ch.homely.compte.dto.CompteRequest;
import ch.homely.foyer.Foyer;
import ch.homely.foyer.FoyerRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.membre.Membre;
import ch.homely.membre.MembreRepository;
import ch.homely.poche.AllocationArgentPocheRepository;
import ch.homely.poche.PolitiqueArgentPocheRepository;
import ch.homely.poste.PosteRepository;
import ch.homely.projection.ProjectionService;
import ch.homely.scenario.ScenarioRepository;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** T6.1 — CRUD Comptes (scopé foyer). */
@Service
@Transactional
public class CompteService {

    private final CompteRepository compteRepo;
    private final FoyerRepository  foyerRepo;
    private final MembreRepository membreRepo;
    private final CompteMembreRepository compteMembreRepo;
    private final PosteRepository posteRepo;
    private final PolitiqueArgentPocheRepository politiqueArgentPocheRepo;
    private final AllocationArgentPocheRepository allocationArgentPocheRepo;
    private final MultiTenantService multiTenant;
    private final ScenarioRepository scenarioRepo;
    private final ProjectionService projectionService;

    public CompteService(CompteRepository compteRepo, FoyerRepository foyerRepo,
                         MembreRepository membreRepo, CompteMembreRepository compteMembreRepo,
                         PosteRepository posteRepo,
                         PolitiqueArgentPocheRepository politiqueArgentPocheRepo,
                         AllocationArgentPocheRepository allocationArgentPocheRepo,
                         MultiTenantService multiTenant,
                         ScenarioRepository scenarioRepo,
                         ProjectionService projectionService) {
        this.compteRepo  = compteRepo;
        this.foyerRepo   = foyerRepo;
        this.membreRepo  = membreRepo;
        this.compteMembreRepo = compteMembreRepo;
        this.posteRepo   = posteRepo;
        this.politiqueArgentPocheRepo = politiqueArgentPocheRepo;
        this.allocationArgentPocheRepo = allocationArgentPocheRepo;
        this.multiTenant = multiTenant;
        this.scenarioRepo = scenarioRepo;
        this.projectionService = projectionService;
    }

    @Transactional(readOnly = true)
    public List<CompteDto> lister(UUID foyerId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return compteRepo.findAllByFoyerIdAndActifTrueOrderByLibelleAsc(foyerId).stream()
                .map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public CompteDto obtenir(UUID foyerId, UUID compteId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return toDto(trouver(foyerId, compteId));
    }

    public CompteDto creer(UUID foyerId, CompteRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Foyer foyer = foyerRepo.findById(foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Foyer introuvable"));
        Compte c = new Compte();
        c.setFoyer(foyer);
        appliquer(c, req, foyerId);
        CompteDto dto = toDto(compteRepo.save(c));
        invaliderProjectionsFoyer(foyerId);
        return dto;
    }

    public CompteDto modifier(UUID foyerId, UUID compteId, CompteRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Compte c = trouver(foyerId, compteId);
        appliquer(c, req, foyerId);
        CompteDto dto = toDto(compteRepo.save(c));
        invaliderProjectionsFoyer(foyerId);
        return dto;
    }

    public void supprimer(UUID foyerId, UUID compteId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Compte c = trouver(foyerId, compteId);

        // Refuse la désactivation tant que le compte est encore référencé ailleurs : un
        // compte désactivé sort du périmètre de ComptesFluxSimulateur (tousComptes =
        // uniquement les comptes actifs), donc toute ventilation de poste, politique/
        // allocation d'argent de poche ou statut de compte primaire qui continuerait à le
        // cibler produirait des virements orphelins (sortant enregistré côté compte
        // primaire actif, sans entrant correspondant nulle part) ou des charges qui
        // disparaissent silencieusement de la simulation de trésorerie.
        if (posteRepo.existsByVentilations_Compte_Id(compteId)
                || politiqueArgentPocheRepo.existsByCompte_Id(compteId)
                || allocationArgentPocheRepo.existsByCompte_Id(compteId)
                || compteMembreRepo.existsByCompte_IdAndEstPrimaireTrue(compteId)) {
            throw new RegleMetierException(
                    CodesErreur.COMPTE_REFERENCE_SUPPRESSION,
                    "Ce compte est encore utilisé (ventilation de poste, politique/allocation d'argent de "
                            + "poche, ou compte primaire d'un membre) : réassignez ces références avant de le désactiver.");
        }

        c.setActif(false);
        compteRepo.save(c);
        invaliderProjectionsFoyer(foyerId);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /** La liste des comptes actifs et leurs co-titulaires (via {@link CompteMembre})
     *  conditionnent directement la simulation de trésorerie et la restitution
     *  croisée des virements entre membres, sans être reflétés dans
     *  {@code Scenario.dateModification}. On invalide donc le cache
     *  {@code @Cacheable("projections")} pour tous les scénarios du foyer après
     *  toute création/modification/désactivation de compte. */
    private void invaliderProjectionsFoyer(UUID foyerId) {
        for (UUID scenarioId : scenarioRepo.findIdsByFoyerId(foyerId)) {
            projectionService.invaliderCache(scenarioId);
        }
    }

    private void appliquer(Compte c, CompteRequest req, UUID foyerId) {
        c.setLibelle(req.libelle());
        c.setSoldeInitial(req.soldeInitial() != null ? req.soldeInitial() : BigDecimal.ZERO);
        c.setDevise(req.devise());

        // Résoudre les membres actifs demandés (scopés foyer)
        Set<UUID> demandes = req.membreIds();
        List<Membre> actifsTrouves = membreRepo.findAllByIdInAndFoyerIdAndActifTrue(demandes, foyerId);

        // Vérifier qu'aucun ID invalide/inactif/autre-foyer n'a été transmis
        if (actifsTrouves.size() != demandes.size()) {
            throw new RegleMetierException(
                    CodesErreur.COMPTE_SANS_MEMBRE,
                    "Un ou plusieurs membres demandés sont invalides, inactifs ou n'appartiennent pas à ce foyer.");
        }

        // Rattachements existants indexés par membre
        Map<UUID, CompteMembre> existantsParMembreId = c.getCompteMembres().stream()
                .collect(Collectors.toMap(cm -> cm.getMembre().getId(), cm -> cm));

        // En édition : conserver les membres déjà rattachés qui sont devenus inactifs (avec leur drapeau primaire)
        Set<CompteMembre> inactifsExistants = c.getCompteMembres().stream()
                .filter(cm -> !cm.getMembre().isActif())
                .collect(Collectors.toSet());

        Set<CompteMembre> nouveauxRattachements = new HashSet<>(inactifsExistants);
        for (Membre m : actifsTrouves) {
            CompteMembre existant = existantsParMembreId.get(m.getId());
            if (existant != null) {
                // Rattachement déjà présent : on le garde tel quel (préserve estPrimaire)
                nouveauxRattachements.add(existant);
            } else {
                nouveauxRattachements.add(new CompteMembre(c, m));
            }
        }

        c.getCompteMembres().clear();
        c.getCompteMembres().addAll(nouveauxRattachements);
    }

    private Compte trouver(UUID foyerId, UUID compteId) {
        return compteRepo.findByIdAndFoyerId(compteId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Compte introuvable : " + compteId));
    }

    private CompteDto toDto(Compte c) {
        Set<UUID> membreIds = c.getCompteMembres().stream()
                .map(cm -> cm.getMembre().getId())
                .collect(Collectors.toSet());
        Set<UUID> membresPrimaireIds = c.getCompteMembres().stream()
                .filter(CompteMembre::isEstPrimaire)
                .map(cm -> cm.getMembre().getId())
                .collect(Collectors.toSet());
        return new CompteDto(c.getId(), c.getLibelle(),
                c.getSoldeInitial(), c.getDevise(), c.isActif(), membreIds, membresPrimaireIds);
    }
}
