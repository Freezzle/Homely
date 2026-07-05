package ch.homely.securite;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.UUID;

/**
 * T4.2 — Service JWT : génération et validation des access et refresh tokens.
 * Utilise JJWT 0.12.x avec HMAC-SHA256.
 */
@Service
public class JwtService {

    private static final String CLAIM_USER_ID = "userId";

    private final SecretKey secretKey;
    private final long accessExpirationMs;
    private final long refreshExpirationMs;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-expiration-ms}") long accessExpirationMs,
            @Value("${app.jwt.refresh-expiration-ms}") long refreshExpirationMs) {
        this.secretKey         = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessExpirationMs  = accessExpirationMs;
        this.refreshExpirationMs = refreshExpirationMs;
    }

    /** Génère un access token (courte durée). */
    public String genererAccessToken(String email, UUID utilisateurId) {
        return Jwts.builder()
                .subject(email)
                .claim(CLAIM_USER_ID, utilisateurId.toString())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + accessExpirationMs))
                .signWith(secretKey)
                .compact();
    }

    /** Génère une valeur opaque de refresh token (UUID v4). */
    public String genererRefreshToken() {
        return UUID.randomUUID().toString();
    }

    public long getRefreshExpirationMs() { return refreshExpirationMs; }

    /** Extrait l'email (subject) du token. Lève {@link JwtException} si invalide. */
    public String extraireEmail(String token) {
        return getClaims(token).getSubject();
    }

    /** Extrait l'identifiant utilisateur du token. */
    public UUID extraireUtilisateurId(String token) {
        return UUID.fromString(getClaims(token).get(CLAIM_USER_ID, String.class));
    }

    /** Valide le token vis-à-vis des UserDetails. */
    public boolean estValide(String token, UserDetails userDetails) {
        try {
            String email = extraireEmail(token);
            return email.equals(userDetails.getUsername()) && !estExpire(token);
        } catch (JwtException e) {
            return false;
        }
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private boolean estExpire(String token) {
        return getClaims(token).getExpiration().before(new Date());
    }
}
