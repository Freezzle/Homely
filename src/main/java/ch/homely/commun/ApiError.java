package ch.homely.commun;

import java.time.Instant;
import java.util.List;

/**
 * Corps JSON uniforme de toutes les réponses d'erreur (doc 04 §2).
 * Codes métier stables : voir {@link CodesErreur}.
 */
public record ApiError(
        Instant timestamp,
        int status,
        String code,
        String message,
        List<ChampErreur> champErreurs,
        String path
) {
    public static ApiError of(int status, String code, String message, String path) {
        return new ApiError(Instant.now(), status, code, message, List.of(), path);
    }

    public static ApiError of(int status, String code, String message,
                               List<ChampErreur> champErreurs, String path) {
        return new ApiError(Instant.now(), status, code, message, champErreurs, path);
    }
}
