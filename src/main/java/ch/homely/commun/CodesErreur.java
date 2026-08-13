package ch.homely.commun;

/** Codes métier stables exposés dans {@link ApiError#code()} (doc 04 §2). */
public final class CodesErreur {

    private CodesErreur() {}

    public static final String REPARTITION_INVALIDE           = "REPARTITION_INVALIDE";
    public static final String PERIODE_INVALIDE               = "PERIODE_INVALIDE";
    public static final String SCENARIO_REFERENCE_UNIQUE      = "SCENARIO_REFERENCE_UNIQUE";
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
    public static final String POSTE_NON_RECURRENT             = "POSTE_NON_RECURRENT";
    public static final String POSTE_DEJA_TERMINE              = "POSTE_DEJA_TERMINE";
    public static final String DATE_EFFET_INVALIDE             = "DATE_EFFET_INVALIDE";
    public static final String POSTE_SANS_REVISION             = "POSTE_SANS_REVISION";
    public static final String POSTE_MAILLON_INTERMEDIAIRE     = "POSTE_MAILLON_INTERMEDIAIRE";
    public static final String POSTE_MOMENT_INCONNU_MODE_INVALIDE = "POSTE_MOMENT_INCONNU_MODE_INVALIDE";
    public static final String POSTE_HORS_SCENARIO             = "POSTE_HORS_SCENARIO";
    public static final String ACTION_GROUPEE_CHAMP_MANQUANT   = "ACTION_GROUPEE_CHAMP_MANQUANT";
    public static final String COMPTE_PRIMAIRE_NON_RATTACHE    = "COMPTE_PRIMAIRE_NON_RATTACHE";
    public static final String COMPTE_PRIMAIRE_MULTIPLE         = "COMPTE_PRIMAIRE_MULTIPLE";

    // ── Argent de poche ─────────────────────────────────────
    public static final String ARGENT_POCHE_ALLOCATION_DOUBLON       = "ARGENT_POCHE_ALLOCATION_DOUBLON";
    public static final String ARGENT_POCHE_POLITIQUE_CHEVAUCHEMENT  = "ARGENT_POCHE_POLITIQUE_CHEVAUCHEMENT";
    public static final String ARGENT_POCHE_MODE_FIXE_MONTANT_REQUIS = "ARGENT_POCHE_MODE_FIXE_MONTANT_REQUIS";
    public static final String ARGENT_POCHE_MODE_VARIABLE_PARAMS_REQUIS = "ARGENT_POCHE_MODE_VARIABLE_PARAMS_REQUIS";
    public static final String ARGENT_POCHE_PLAFOND_INFERIEUR_SOCLE  = "ARGENT_POCHE_PLAFOND_INFERIEUR_SOCLE";
    public static final String ARGENT_POCHE_PERIODE_INVALIDE         = "ARGENT_POCHE_PERIODE_INVALIDE";
}
