package ch.homely.foyer;

import ch.homely.commun.CodesErreur;
import ch.homely.commun.ConflitException;
import ch.homely.commun.RegleMetierException;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.foyer.dto.*;
import ch.homely.membre.Membre;
import ch.homely.membre.MembreRepository;
import ch.homely.scenario.RepartitionDefaut;
import ch.homely.scenario.Scenario;
import ch.homely.scenario.ScenarioRepository;
import ch.homely.securite.MultiTenantService;
import ch.homely.utilisateur.Utilisateur;
import ch.homely.utilisateur.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.util.ArrayList;
import java.util.List;
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

    public FoyerService(FoyerRepository foyerRepo,
                        AccesFoyerRepository accesRepo,
                        MembreRepository membreRepo,
                        ScenarioRepository scenarioRepo,
                        UtilisateurRepository utilisateurRepo,
                        MultiTenantService multiTenant) {
        this.foyerRepo       = foyerRepo;
        this.accesRepo       = accesRepo;
        this.membreRepo      = membreRepo;
        this.scenarioRepo    = scenarioRepo;
        this.utilisateurRepo = utilisateurRepo;
        this.multiTenant     = multiTenant;
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

    /** Retourne le détail d'un foyer (vérifie l'appartenance). */
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
