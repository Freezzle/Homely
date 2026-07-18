package ch.homely.foyer;

import ch.homely.commun.CodesErreur;
import ch.homely.commun.ConflitException;
import ch.homely.commun.RegleMetierException;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.foyer.dto.*;
import ch.homely.categorie.Categorie;
import ch.homely.categorie.CategorieRepository;
import ch.homely.compte.Compte;
import ch.homely.compte.CompteRepository;
import ch.homely.membre.Membre;
import ch.homely.membre.MembreRepository;
import ch.homely.moteur.MoteurCalcul;
import ch.homely.moteur.RepartitionCalcul;
import ch.homely.scenario.RepartitionDefaut;
import ch.homely.scenario.RepartitionPeriode;
import ch.homely.scenario.RepartitionPeriodePart;
import ch.homely.scenario.Scenario;
import ch.homely.scenario.ScenarioRepository;
import ch.homely.securite.MultiTenantService;
import ch.homely.utilisateur.Utilisateur;
import ch.homely.utilisateur.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Year;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * T4.3 / T4.4 — Gestion des foyers et des accès (multi-tenant strict).
 */
@Service
@Transactional
public class FoyerService {

    private final FoyerRepository foyerRepo;
    private final AccesFoyerRepository accesRepo;
    private final MembreRepository membreRepo;
    private final ScenarioRepository scenarioRepo;
    private final UtilisateurRepository utilisateurRepo;
    private final MultiTenantService multiTenant;
    private final CategorieRepository categorieRepo;
    private final CompteRepository compteRepo;

    public FoyerService(FoyerRepository foyerRepo,
                        AccesFoyerRepository accesRepo,
                        MembreRepository membreRepo,
                        ScenarioRepository scenarioRepo,
                        UtilisateurRepository utilisateurRepo,
                        MultiTenantService multiTenant,
                        CategorieRepository categorieRepo,
                        CompteRepository compteRepo) {
        this.foyerRepo       = foyerRepo;
        this.accesRepo       = accesRepo;
        this.membreRepo      = membreRepo;
        this.scenarioRepo    = scenarioRepo;
        this.utilisateurRepo = utilisateurRepo;
        this.multiTenant     = multiTenant;
        this.categorieRepo   = categorieRepo;
        this.compteRepo      = compteRepo;
    }

    /** Liste les foyers accessibles à l'utilisateur courant. */
    @Transactional(readOnly = true)
    public List<FoyerDto> listerMesFoyers() {
        Utilisateur u = multiTenant.utilisateurCourant();
        return accesRepo.findAllByUtilisateurId(u.getId()).stream()
                .map(a -> toDto(a.getFoyer(), a.getRole()))
                .toList();
    }

    /** Crée un foyer ; le créateur devient OWNER. */
    public FoyerDto creer(FoyerRequest req) {
        Utilisateur u = multiTenant.utilisateurCourant();
        if (req.membres() == null || req.membres().isEmpty()) {
            throw new RegleMetierException(CodesErreur.FOYER_MEMBRES_INVALIDES,
                    "Au moins un membre est requis à la création du foyer.");
        }

        Foyer foyer = new Foyer();
        foyer.setNom(req.nom());
        foyer.setDeviseBase(req.deviseBase() != null ? req.deviseBase().toUpperCase() : "CHF");
        foyerRepo.save(foyer);

        AccesFoyer acces = new AccesFoyer();
        acces.setFoyer(foyer);
        acces.setUtilisateur(u);
        acces.setRole(RoleFoyer.OWNER);
        accesRepo.save(acces);

        List<Membre> membres = creerMembresInitials(foyer, req.membres());
        creerScenarioInitial(foyer, membres);

        return toDto(foyer, RoleFoyer.OWNER);
    }

    /**
     * Wizard d'onboarding : crée en une transaction le foyer complet
     * (membres, catégories, comptes, scénario de référence).
     * Les membres sont référencés par leur ordre local (1-based) dans le DTO.
     */
    public FoyerOnboardingResponse creerAvecOnboarding(FoyerOnboardingRequest req) {
        Utilisateur u = multiTenant.utilisateurCourant();

        // 1. Foyer
        Foyer foyer = new Foyer();
        foyer.setNom(req.nom());
        foyer.setDeviseBase(req.deviseBase() != null ? req.deviseBase().toUpperCase() : "CHF");
        foyerRepo.save(foyer);

        // 2. Accès OWNER
        AccesFoyer acces = new AccesFoyer();
        acces.setFoyer(foyer);
        acces.setUtilisateur(u);
        acces.setRole(RoleFoyer.OWNER);
        accesRepo.save(acces);

        // 3. Membres — on garde une map ordre → Membre pour résoudre les références locales
        Map<Integer, Membre> parOrdre = new HashMap<>();
        for (int i = 0; i < req.membres().size(); i++) {
            FoyerOnboardingRequest.MembreCreation mc = req.membres().get(i);
            Membre m = new Membre();
            m.setFoyer(foyer);
            m.setNom(mc.nom());
            m.setCouleur(mc.couleur() != null ? mc.couleur().toUpperCase() : "#6366F1");
            m.setOrdre(i + 1);
            membreRepo.save(m);
            parOrdre.put(i + 1, m);
        }

        // 4. Catégories — ordre auto-incrémenté par type
        Map<ch.homely.categorie.TypeCategorie, Integer> ordresParType = new HashMap<>();
        for (FoyerOnboardingRequest.CategorieCreation cc : req.categories()) {
            int ordre = ordresParType.merge(cc.typePoste(), 1, Integer::sum);
            Categorie cat = new Categorie();
            cat.setFoyer(foyer);
            cat.setLibelle(cc.libelle());
            cat.setTypePoste(cc.typePoste());
            cat.setOrdre(ordre);
            categorieRepo.save(cat);
        }

        // 5. Comptes
        for (int i = 0; i < req.comptes().size(); i++) {
            FoyerOnboardingRequest.CompteCreation cc = req.comptes().get(i);
            Compte compte = new Compte();
            compte.setFoyer(foyer);
            compte.setLibelle(cc.libelle());
            compte.setSoldeInitial(cc.soldeInitial() != null
                    ? cc.soldeInitial() : BigDecimal.ZERO);
            compte.setOrdre(i);
            // Résolution des membres par ordre local
            for (Integer ordre : cc.membreOrdres()) {
                Membre m = parOrdre.get(ordre);
                if (m == null) {
                    throw new RegleMetierException(
                            CodesErreur.ONBOARDING_ORDRE_INVALIDE,
                            "Ordre de membre inconnu dans les comptes : " + ordre);
                }
                compte.getMembres().add(m);
            }
            if (compte.getMembres().isEmpty()) {
                throw new RegleMetierException(
                        CodesErreur.COMPTE_SANS_MEMBRE,
                        "Un compte doit avoir au moins un membre rattaché.");
            }
            compteRepo.save(compte);
        }

        // 6. Scénario de référence (horizon forcé à 40 ans)
        FoyerOnboardingRequest.ScenarioCreation sc = req.scenario();
        Scenario scenario = new Scenario();
        scenario.setFoyer(foyer);
        scenario.setNom(sc.nom());
        scenario.setEstReference(true);
        scenario.setAnneeDepart(sc.anneeDepart());
        scenario.setTresorerieInitiale(sc.tresorerieInitiale() != null
                ? sc.tresorerieInitiale() : BigDecimal.ZERO);
        scenario.setHorizonAnnees(40);

        // 7. Validation + création répartitions
        List<RepartitionCalcul> calculs = new ArrayList<>();
        for (FoyerOnboardingRequest.RepartitionCreation rc : sc.repartitions()) {
            Membre m = parOrdre.get(rc.membreOrdre());
            if (m == null) {
                throw new RegleMetierException(
                        CodesErreur.ONBOARDING_ORDRE_INVALIDE,
                        "Ordre de membre inconnu dans les répartitions : " + rc.membreOrdre());
            }
            calculs.add(new RepartitionCalcul(m.getId(), rc.quotePart().doubleValue()));
        }
        MoteurCalcul.validerRepartition(calculs);

        // RepartitionDefaut (rétrocompat)
        for (int i = 0; i < sc.repartitions().size(); i++) {
            FoyerOnboardingRequest.RepartitionCreation rc = sc.repartitions().get(i);
            Membre m = parOrdre.get(rc.membreOrdre());
            RepartitionDefaut rd = new RepartitionDefaut();
            rd.setScenario(scenario);
            rd.setMembre(m);
            rd.setQuotePart(rc.quotePart());
            scenario.getRepartitionsDefaut().add(rd);
        }

        scenarioRepo.save(scenario);

        // RepartitionPeriode ouverte (début = anneeDepart-01-01, fin = null)
        RepartitionPeriode periode = new RepartitionPeriode();
        periode.setScenario(scenario);
        periode.setDebut(LocalDate.of(sc.anneeDepart(), 1, 1));
        periode.setFin(null);
        for (int i = 0; i < sc.repartitions().size(); i++) {
            FoyerOnboardingRequest.RepartitionCreation rc = sc.repartitions().get(i);
            Membre m = parOrdre.get(rc.membreOrdre());
            RepartitionPeriodePart part = new RepartitionPeriodePart();
            part.setPeriode(periode);
            part.setMembre(m);
            part.setQuotePart(rc.quotePart());
            part.setOrdre(i);
            periode.getParts().add(part);
        }
        scenario.getRepartitionsPeriodes().add(periode);
        scenarioRepo.save(scenario);

        return new FoyerOnboardingResponse(toDto(foyer, RoleFoyer.OWNER), scenario.getId());
    }
    @Transactional(readOnly = true)
    public FoyerDto obtenir(UUID foyerId) {
        AccesFoyer acces = multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return toDto(acces.getFoyer(), acces.getRole());
    }

    /** Modifie un foyer (OWNER ou EDITOR). */
    public FoyerDto modifier(UUID foyerId, FoyerRequest req) {
        AccesFoyer acces = multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Foyer foyer = acces.getFoyer();
        foyer.setNom(req.nom());
        if (req.deviseBase() != null) foyer.setDeviseBase(req.deviseBase().toUpperCase());
        foyerRepo.save(foyer);
        return toDto(foyer, acces.getRole());
    }

    /** Supprime un foyer (OWNER uniquement). */
    public void supprimer(UUID foyerId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.OWNER);
        foyerRepo.deleteById(foyerId);
    }

    // ── Accès (T4.4) ─────────────────────────────────────────────────────────

    /** Liste les accès d'un foyer (OWNER uniquement). */
    @Transactional(readOnly = true)
    public List<AccesFoyerDto> listerAcces(UUID foyerId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.OWNER);
        return accesRepo.findAllByFoyerId(foyerId).stream()
                .map(a -> new AccesFoyerDto(
                        a.getId(),
                        a.getUtilisateur().getId(),
                        a.getUtilisateur().getEmail(),
                        a.getUtilisateur().getNomComplet(),
                        a.getRole()))
                .toList();
    }

    /** Invite un utilisateur dans un foyer (OWNER uniquement). */
    public AccesFoyerDto inviter(UUID foyerId, InviterAccesRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.OWNER);

        Foyer foyer = foyerRepo.findById(foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Foyer introuvable"));
        Utilisateur invite = utilisateurRepo.findByEmail(req.email())
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Utilisateur introuvable : " + req.email()));

        if (accesRepo.existsByUtilisateurIdAndFoyerId(invite.getId(), foyerId)) {
            throw new ConflitException(CodesErreur.CONFLIT,
                    "Cet utilisateur a déjà accès à ce foyer.");
        }

        AccesFoyer acces = new AccesFoyer();
        acces.setFoyer(foyer);
        acces.setUtilisateur(invite);
        acces.setRole(req.role());
        accesRepo.save(acces);

        return new AccesFoyerDto(acces.getId(), invite.getId(),
                invite.getEmail(), invite.getNomComplet(), req.role());
    }

    /** Change le rôle d'un accès (OWNER uniquement). */
    public AccesFoyerDto changerRole(UUID foyerId, UUID accesId, ChangerRoleRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.OWNER);

        AccesFoyer acces = accesRepo.findById(accesId)
                .filter(a -> a.getFoyer().getId().equals(foyerId))
                .orElseThrow(() -> new RessourceIntrouvableException("Accès introuvable"));
        acces.setRole(req.role());
        accesRepo.save(acces);

        return new AccesFoyerDto(acces.getId(),
                acces.getUtilisateur().getId(),
                acces.getUtilisateur().getEmail(),
                acces.getUtilisateur().getNomComplet(),
                acces.getRole());
    }

    /** Retire un accès (OWNER uniquement). */
    public void retirerAcces(UUID foyerId, UUID accesId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.OWNER);
        accesRepo.findById(accesId)
                .filter(a -> a.getFoyer().getId().equals(foyerId))
                .orElseThrow(() -> new RessourceIntrouvableException("Accès introuvable"));
        accesRepo.deleteById(accesId);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static FoyerDto toDto(Foyer f, RoleFoyer role) {
        return new FoyerDto(f.getId(), f.getNom(), f.getDeviseBase(), role);
    }

    private List<Membre> creerMembresInitials(Foyer foyer, List<FoyerRequest.MembreCreationRequest> membresReq) {
        List<Membre> membres = new ArrayList<>();
        int ordre = 1;
        for (FoyerRequest.MembreCreationRequest req : membresReq) {
            Membre m = new Membre();
            m.setFoyer(foyer);
            m.setNom(req.nom());
            m.setCouleur(req.couleur() != null ? req.couleur().toUpperCase() : "#6366F1");
            m.setOrdre(ordre++);
            membres.add(membreRepo.save(m));
        }
        return membres;
    }

    private void creerScenarioInitial(Foyer foyer, List<Membre> membres) {
        Scenario scenario = new Scenario();
        scenario.setFoyer(foyer);
        scenario.setNom("Scénario de base");
        scenario.setEstReference(true);
        scenario.setAnneeDepart(Year.now().getValue());
        scenario.setTresorerieInitiale(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        scenario.setHorizonAnnees(25);

        List<BigDecimal> quotes = repartitionEquilibreeDeuxDecimales(membres.size());
        for (int i = 0; i < membres.size(); i++) {
            RepartitionDefaut rd = new RepartitionDefaut();
            rd.setScenario(scenario);
            rd.setMembre(membres.get(i));
            rd.setQuotePart(quotes.get(i));
            scenario.getRepartitionsDefaut().add(rd);
        }

        scenarioRepo.save(scenario);
    }

    private List<BigDecimal> repartitionEquilibreeDeuxDecimales(int nbMembres) {
        int basePct = 100 / nbMembres;
        int reste = 100 % nbMembres;
        List<BigDecimal> parts = new ArrayList<>();
        for (int i = 0; i < nbMembres; i++) {
            int pct = basePct + (i < reste ? 1 : 0);
            parts.add(BigDecimal.valueOf(pct).movePointLeft(2).setScale(2, RoundingMode.HALF_UP));
        }
        return parts;
    }
}
