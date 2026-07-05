package ch.homely.utilisateur;

import ch.homely.commun.CodesErreur;
import ch.homely.commun.ConflitException;
import ch.homely.commun.TokenInvalideException;
import ch.homely.foyer.AccesFoyerRepository;
import ch.homely.securite.JwtService;
import ch.homely.securite.TokenRefresh;
import ch.homely.securite.TokenRefreshRepository;
import ch.homely.utilisateur.dto.*;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * T4.1 / T4.2 — Inscription, connexion, refresh et déconnexion.
 */
@Service
@Transactional
public class AuthService {

    private final UtilisateurRepository utilisateurRepo;
    private final TokenRefreshRepository tokenRefreshRepo;
    private final AccesFoyerRepository accesRepo;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UtilisateurRepository utilisateurRepo,
                       TokenRefreshRepository tokenRefreshRepo,
                       AccesFoyerRepository accesRepo,
                       JwtService jwtService,
                       PasswordEncoder passwordEncoder) {
        this.utilisateurRepo  = utilisateurRepo;
        this.tokenRefreshRepo = tokenRefreshRepo;
        this.accesRepo        = accesRepo;
        this.jwtService       = jwtService;
        this.passwordEncoder  = passwordEncoder;
    }

    /** T4.1 — Inscription d'un nouvel utilisateur. */
    public UtilisateurDto register(RegisterRequest req) {
        if (utilisateurRepo.existsByEmail(req.email())) {
            throw new ConflitException(CodesErreur.EMAIL_DEJA_UTILISE,
                    "L'email " + req.email() + " est déjà utilisé.");
        }
        Utilisateur u = new Utilisateur();
        u.setEmail(req.email().toLowerCase().trim());
        u.setMotDePasseHash(passwordEncoder.encode(req.motDePasse()));
        u.setNomComplet(req.nomComplet());
        utilisateurRepo.save(u);
        return toDto(u);
    }

    /** T4.1 — Connexion avec email + mot de passe → paire de tokens. */
    public TokensResponse login(LoginRequest req) {
        Utilisateur u = utilisateurRepo.findByEmail(req.email().toLowerCase().trim())
                .orElseThrow(() -> new BadCredentialsException("Identifiants invalides"));

        if (!u.isActif()) {
            throw new BadCredentialsException("Compte désactivé");
        }
        if (!passwordEncoder.matches(req.motDePasse(), u.getMotDePasseHash())) {
            throw new BadCredentialsException("Identifiants invalides");
        }

        return genererTokens(u);
    }

    /** T4.2 — Rotation du refresh token. */
    public TokensResponse refresh(String rawRefreshToken) {
        TokenRefresh tr = tokenRefreshRepo.findByToken(rawRefreshToken)
                .orElseThrow(() -> new TokenInvalideException("Refresh token inconnu"));

        if (tr.isRevoque() || tr.getExpireA().isBefore(Instant.now())) {
            throw new TokenInvalideException("Refresh token expiré ou révoqué");
        }

        // Rotation : révoquer l'ancien et générer un nouveau
        tr.setRevoque(true);
        tokenRefreshRepo.save(tr);

        return genererTokens(tr.getUtilisateur());
    }

    /** T4.2 — Révocation d'un refresh token (logout). */
    public void logout(String rawRefreshToken) {
        tokenRefreshRepo.findByToken(rawRefreshToken)
                .ifPresent(tr -> {
                    tr.setRevoque(true);
                    tokenRefreshRepo.save(tr);
                });
    }

    /** T4.2 — Profil de l'utilisateur courant + liste de ses foyers. */
    @Transactional(readOnly = true)
    public MoiResponse moi(String email) {
        Utilisateur u = utilisateurRepo.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Utilisateur introuvable"));

        var foyers = accesRepo.findAllByUtilisateurId(u.getId()).stream()
                .map(a -> new FoyerAccesDto(
                        a.getFoyer().getId(), a.getFoyer().getNom(), a.getRole()))
                .toList();

        return new MoiResponse(toDto(u), foyers);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private TokensResponse genererTokens(Utilisateur u) {
        String accessToken = jwtService.genererAccessToken(u.getEmail(), u.getId());
        String rawRefresh  = jwtService.genererRefreshToken();

        TokenRefresh tr = new TokenRefresh();
        tr.setUtilisateur(u);
        tr.setToken(rawRefresh);
        tr.setExpireA(Instant.now().plusMillis(jwtService.getRefreshExpirationMs()));
        tokenRefreshRepo.save(tr);

        return new TokensResponse(accessToken, rawRefresh,
                jwtService.getRefreshExpirationMs(), toDto(u));
    }

    private static UtilisateurDto toDto(Utilisateur u) {
        return new UtilisateurDto(u.getId(), u.getEmail(), u.getNomComplet());
    }
}
