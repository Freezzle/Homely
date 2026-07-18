package ch.homely.commun;

/** Codes métier stables exposés dans {@link ApiError#code()} (doc 04 §2). */
public final class CodesErreur {

    private CodesErreur() {}

    public static final String REPARTITION_INVALIDE           = "REPARTITION_INVALIDE";
    public static final String PERIODE_INVALIDE               = "PERIODE_INVALIDE";
    public static final String SCENARIO_REFERENCE_UNIQUE      = "SCENARIO_REFERENCE_UNIQUE";
    public static final String SUPPORT_OBJECTIF_INVALIDE      = "SUPPORT_OBJECTIF_INVALIDE";
    public static final String MEMBRE_REFERENCE_SUPPRESSION   = "MEMBRE_REFERENCE_SUPPRESSION";
    public static final String DEVISE_INCONNUE                = "DEVISE_INCONNUE";
    public static final String ACCES_FOYER_REFUSE             = "ACCES_FOYER_REFUSE";
    public static final String RESSOURCE_INTROUVABLE          = "RESSOURCE_INTROUVABLE";
    public static final String EMAIL_DEJA_UTILISE             = "EMAIL_DEJA_UTILISE";
    public static final String IDENTIFIANTS_INVALIDES         = "IDENTIFIANTS_INVALIDES";
    public static final String TOKEN_INVALIDE                 = "TOKEN_INVALIDE";
    public static final String CONFLIT                        = "CONFLIT";
    public static final String FOYER_MEMBRES_INVALIDES         = "FOYER_MEMBRES_INVALIDES";
    public static final String COMPTE_SANS_MEMBRE              = "COMPTE_SANS_MEMBRE";
    public static final String VENTILATION_COMPTE_NON_RATTACHE = "VENTILATION_COMPTE_NON_RATTACHE";
    public static final String ONBOARDING_ORDRE_INVALIDE       = "ONBOARDING_ORDRE_INVALIDE";
    public static final String ERREUR_INTERNE                  = "ERREUR_INTERNE";
}
