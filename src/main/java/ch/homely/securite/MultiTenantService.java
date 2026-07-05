package ch.homely.securite;

import ch.homely.commun.AccesFoyerRefuseException;
import ch.homely.foyer.AccesFoyer;
import ch.homely.foyer.AccesFoyerRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.utilisateur.Utilisateur;
import ch.homely.utilisateur.UtilisateurRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * T4.3 — Vérification d'appartenance foyer + rôle (guard multi-tenant).
 * Toute tentative d'accès inter-foyers est journalisée.
 */
@Service
public class MultiTenantService {

    private static final Logger log = LoggerFactory.getLogger(MultiTenantService.class);

    private final AccesFoyerRepository accesRepo;
    private final UtilisateurRepository utilisateurRepo;

    public MultiTenantService(AccesFoyerRepository accesRepo,
                               UtilisateurRepository utilisateurRepo) {
        this.accesRepo       = accesRepo;
        this.utilisateurRepo = utilisateurRepo;
    }

    /**
     * Vérifie que l'utilisateur courant appartient au foyer avec au moins le rôle indiqué.
     *
     * @param foyerId     foyer cible
     * @param roleMinimum rôle minimum requis
     * @return l'AccesFoyer si l'accès est autorisé
     * @throws AccesFoyerRefuseException si l'accès est refusé (journalisé)
     */
    public AccesFoyer verifierAcces(UUID foyerId, RoleFoyer roleMinimum) {
        String email = obtenirEmailCourant();

        Utilisateur utilisateur = utilisateurRepo.findByEmail(email)
                .orElseThrow(() -> new AccesFoyerRefuseException(foyerId));

        AccesFoyer acces = accesRepo
                .findByUtilisateurIdAndFoyerId(utilisateur.getId(), foyerId)
                .orElseGet(() -> {
                    log.warn("Tentative d'accès inter-foyers : utilisateur={} foyerId={}",
                            email, foyerId);
                    throw new AccesFoyerRefuseException(foyerId);
                });

        if (!aLeRole(acces.getRole(), roleMinimum)) {
            log.warn("Rôle insuffisant : utilisateur={} foyerId={} rôle={} requis={}",
                    email, foyerId, acces.getRole(), roleMinimum);
            throw new AccesFoyerRefuseException(foyerId);
        }

        return acces;
    }

    /** Retourne l'utilisateur courant authentifié. */
    public Utilisateur utilisateurCourant() {
        String email = obtenirEmailCourant();
        return utilisateurRepo.findByEmail(email)
                .orElseThrow(() -> new AccesFoyerRefuseException("inconnu"));
    }

    private String obtenirEmailCourant() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }

    /** OWNER ≥ EDITOR ≥ VIEWER. */
    public static boolean aLeRole(RoleFoyer role, RoleFoyer minimum) {
        return switch (minimum) {
            case VIEWER -> true;
            case EDITOR -> role == RoleFoyer.EDITOR || role == RoleFoyer.OWNER;
            case OWNER  -> role == RoleFoyer.OWNER;
        };
    }
}
