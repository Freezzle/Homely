package ch.homely.commun;

import ch.homely.moteur.RepartitionInvalideException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;

/**
 * T5.1 — Gestionnaire global d'exceptions → réponses {@link ApiError} uniformes.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // ── 400 — Validation Bean Validation ─────────────────────────────────────

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex,
                                                      HttpServletRequest req) {
        List<ChampErreur> champs = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> new ChampErreur(f.getField(), f.getDefaultMessage()))
                .toList();
        return ResponseEntity.badRequest().body(
                ApiError.of(400, CodesErreur.REPARTITION_INVALIDE,
                        "Données invalides", champs, req.getRequestURI()));
    }

    // ── 401 — Identifiants invalides ──────────────────────────────────────────

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException ex,
                                                          HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                ApiError.of(401, CodesErreur.IDENTIFIANTS_INVALIDES,
                        ex.getMessage(), req.getRequestURI()));
    }

    // ── 403 — Accès refusé ────────────────────────────────────────────────────

    @ExceptionHandler(AccesFoyerRefuseException.class)
    public ResponseEntity<ApiError> handleAccesRefuse(AccesFoyerRefuseException ex,
                                                       HttpServletRequest req) {
        log.warn("Accès inter-foyers refusé : {}", req.getRequestURI());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                ApiError.of(403, CodesErreur.ACCES_FOYER_REFUSE,
                        ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex,
                                                        HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                ApiError.of(403, CodesErreur.ACCES_FOYER_REFUSE,
                        "Accès refusé", req.getRequestURI()));
    }

    // ── 404 — Ressource introuvable ───────────────────────────────────────────

    @ExceptionHandler(RessourceIntrouvableException.class)
    public ResponseEntity<ApiError> handleIntrouvable(RessourceIntrouvableException ex,
                                                       HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                ApiError.of(404, CodesErreur.RESSOURCE_INTROUVABLE,
                        ex.getMessage(), req.getRequestURI()));
    }

    // ── 409 — Conflit ─────────────────────────────────────────────────────────

    @ExceptionHandler(ConflitException.class)
    public ResponseEntity<ApiError> handleConflit(ConflitException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(
                ApiError.of(409, ex.getCode(), ex.getMessage(), req.getRequestURI()));
    }

    // ── 422 — Règle métier ────────────────────────────────────────────────────

    @ExceptionHandler(RegleMetierException.class)
    public ResponseEntity<ApiError> handleRegleMetier(RegleMetierException ex,
                                                       HttpServletRequest req) {
        return ResponseEntity.unprocessableEntity().body(
                ApiError.of(422, ex.getCode(), ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(RepartitionInvalideException.class)
    public ResponseEntity<ApiError> handleRepartition(RepartitionInvalideException ex,
                                                       HttpServletRequest req) {
        return ResponseEntity.unprocessableEntity().body(
                ApiError.of(422, CodesErreur.REPARTITION_INVALIDE,
                        ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(TokenInvalideException.class)
    public ResponseEntity<ApiError> handleToken(TokenInvalideException ex,
                                                 HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                ApiError.of(401, CodesErreur.TOKEN_INVALIDE,
                        ex.getMessage(), req.getRequestURI()));
    }

    // ── 500 — Erreur générique ────────────────────────────────────────────────

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGeneric(Exception ex, HttpServletRequest req) {
        log.error("Erreur non gérée sur {}", req.getRequestURI(), ex);
        return ResponseEntity.internalServerError().body(
                ApiError.of(500, CodesErreur.ERREUR_INTERNE,
                        "Erreur interne du serveur", req.getRequestURI()));
    }
}
