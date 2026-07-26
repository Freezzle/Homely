package ch.homely.utilisateur;

import ch.homely.utilisateur.dto.*;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

/**
 * T4.1 / T4.2 — Endpoints d'authentification (publics).
 *
 * Le refresh token n'est jamais exposé dans le corps JSON des réponses :
 * il est transmis uniquement via un cookie httpOnly/Secure/SameSite=Strict
 * (voir {@link #setRefreshCookie}), afin de ne pas être lisible par du
 * JavaScript côté client (protection contre l'exfiltration XSS). L'access
 * token, lui, reste dans le corps de la réponse : le frontend le garde en
 * mémoire (signal), jamais en stockage persistant.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final String COOKIE_NOM  = "rt";
    private static final String COOKIE_PATH = "/api/auth";

    private final AuthService authService;

    @Value("${app.cookies.secure:true}")
    private boolean cookieSecure;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** POST /api/auth/register */
    @PostMapping("/register")
    public ResponseEntity<UtilisateurDto> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(req));
    }

    /** POST /api/auth/login */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest req, HttpServletResponse response) {
        TokensResponse tokens = authService.login(req);
        setRefreshCookie(response, tokens.refreshToken(), tokens.expiresIn());
        return ResponseEntity.ok(AuthResponse.from(tokens));
    }

    /** POST /api/auth/refresh — le refresh token est lu depuis le cookie httpOnly, jamais depuis le body. */
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = COOKIE_NOM, required = false) String refreshToken,
            HttpServletResponse response) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        TokensResponse tokens = authService.refresh(refreshToken);
        setRefreshCookie(response, tokens.refreshToken(), tokens.expiresIn());
        return ResponseEntity.ok(AuthResponse.from(tokens));
    }

    /** POST /api/auth/logout — révoque le refresh token courant (lu depuis le cookie) et efface le cookie. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = COOKIE_NOM, required = false) String refreshToken,
            HttpServletResponse response) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            authService.logout(refreshToken);
        }
        clearRefreshCookie(response);
        return ResponseEntity.noContent().build();
    }

    /** GET /api/auth/moi */
    @GetMapping("/moi")
    public ResponseEntity<MoiResponse> moi(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(authService.moi(userDetails.getUsername()));
    }

    // ── helpers cookie ───────────────────────────────────────────────────────

    private void setRefreshCookie(HttpServletResponse response, String refreshToken, long maxAgeMs) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NOM, refreshToken)
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path(COOKIE_PATH)
                .maxAge(Duration.ofMillis(maxAgeMs))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE_NOM, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite("Strict")
                .path(COOKIE_PATH)
                .maxAge(Duration.ZERO)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
