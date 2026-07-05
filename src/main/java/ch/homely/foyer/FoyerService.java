package ch.homely.foyer;

import ch.homely.commun.CodesErreur;
import ch.homely.commun.ConflitException;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.foyer.dto.*;
import ch.homely.securite.MultiTenantService;
import ch.homely.utilisateur.Utilisateur;
import ch.homely.utilisateur.UtilisateurRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final UtilisateurRepository utilisateurRepo;
    private final MultiTenantService multiTenant;

    public FoyerService(FoyerRepository foyerRepo,
                        AccesFoyerRepository accesRepo,
                        UtilisateurRepository utilisateurRepo,
                        MultiTenantService multiTenant) {
        this.foyerRepo       = foyerRepo;
        this.accesRepo       = accesRepo;
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

        Foyer foyer = new Foyer();
        foyer.setNom(req.nom());
        foyer.setDeviseBase(req.deviseBase() != null ? req.deviseBase().toUpperCase() : "CHF");
        foyerRepo.save(foyer);

        AccesFoyer acces = new AccesFoyer();
        acces.setFoyer(foyer);
        acces.setUtilisateur(u);
        acces.setRole(RoleFoyer.OWNER);
        accesRepo.save(acces);

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
}
