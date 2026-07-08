export const FR = {
  // ── Auth ────────────────────────────────────────────────
  auth: {
    login: 'Connexion',
    register: "S'inscrire",
    logout: 'Déconnexion',
    email: 'Email',
    password: 'Mot de passe',
    passwordConfirm: 'Confirmer le mot de passe',
    fullName: 'Nom complet',
    loginBtn: 'Se connecter',
    registerBtn: "Créer un compte",
    noAccount: "Pas encore de compte ?",
    alreadyAccount: 'Déjà un compte ?',
    loginError: 'Identifiants invalides.',
  },
  // ── Navigation ───────────────────────────────────────────
  nav: {
    dashboardAnnuel: 'Tableau de bord annuel',
    dashboardMensuel: 'Tableau de bord du mois',
    revenus: 'Revenus',
    charges: 'Charges',
    reserves: 'Réserves',
    scenarios: 'Scénarios',
    comparaison: 'Comparaison',
    patrimoine: 'Patrimoine',
    objectifs: 'Objectifs',
    referentiels: 'Référentiels',
    comptes: 'Comptes',
    categories: 'Catégories',
    actifs: 'Actifs',
    taux: 'Taux de change',
    membres: 'Membres',
    parametres: 'Paramètres',
    acces: 'Accès',
  },
  // ── Foyer ────────────────────────────────────────────────
  foyer: {
    nouveau: 'Nouveau foyer',
    nom: 'Nom du foyer',
    deviseBase: 'Devise de base',
    choisir: 'Choisir un foyer',
    aucun: 'Aucun foyer.',
    creerPremier: 'Créez le premier !',
    membresInitiaux: 'Membres initiaux',
    membreNom: 'Nom du membre',
    ajouterMembre: 'Ajouter un membre',
    supprimerMembre: 'Supprimer ce membre',
  },
  // ── Scénario ─────────────────────────────────────────────
  scenario: {
    choisir: 'Choisir un scénario',
    reference: 'Référence',
    anneeDepart: 'Année de départ',
    tresorerieInitiale: 'Trésorerie initiale',
    horizonAnnees: "Horizon (années)",
    repartition: 'Répartition par défaut',
    dupliquer: 'Dupliquer',
    definirReference: 'Définir comme référence',
  },
  // ── Poste ────────────────────────────────────────────────
  poste: {
    description: 'Description',
    categorie: 'Catégorie',
    montant: 'Montant',
    montantMensualise: 'Mensual.',
    totalMensuel: 'Total mensuel',
    totalAnnuel: 'Total annuel',
    cacherInactifs: 'Masquer les inactifs',
    posteCount: 'poste(s)',
    devise: 'Devise',
    periodicite: 'Périodicité',
    periode: 'Période',
    debut: 'Début',
    fin: 'Fin',
    mode: 'Mode',
    moment: 'Moment',
    nature: 'Nature',
    modeTooltip: "Mensualisé = montant lissé chaque mois (montant / périodicité). Périodique = montant plein imputé une seule fois par cycle.",
    momentTooltip: "Le montant plein tombe-t-il au début ou à la fin du cycle de périodicité ?",
    natureTooltip: "Effectif = charge/revenu certain (loyer, salaire, facture…). Prévision = provision pour frais variables estimés (nourriture, habits, loisirs…).",
    repartition: 'Répartition',
    ventilation: 'Ventilation comptes',
    apercu: 'Aperçu mensuel',
    modeOptions: {
      MENSUALISE: 'Mensualisé',
      PERIODIQUE: 'Périodique',
    },
    momentOptions: {
      DEBUT_PERIODE: 'Début de période',
      FIN_PERIODE: 'Fin de période',
    },
    natureOptions: {
      EFFECTIF: 'Effectif',
      PREVISION: 'Prévision',
    },
    periodiciteLabels: [
      'Tous les mois',        // 1
      'Tous les 2 mois', // 2
      'Tous les 3 mois',    // 3
      'Tous les 4 mois', // 4
      'Tous les 5 mois', // 5
      'Tous les 6 mois',     // 6
      'Tous les 7 mois', // 7
      'Tous les 8 mois', // 8
      'Tous les 9 mois', // 9
      'Tous les 10 mois', // 10
      'Tous les 11 mois', // 11
      'Tous les 12 mois', // 12
    ],
    triOptions: {
      DATE:        'Tri par date (début / fin)',
      CATEGORIE:   'Tri par catégorie › description › montant',
      DESCRIPTION: 'Tri par description › montant',
    },
  },
  // ── Projection ───────────────────────────────────────────
  projection: {
    revenus: 'Revenus',
    charges: 'Charges',
    reserves: 'Réserves',
    solde: 'Solde disponible',
    totalAnnee: 'Total année',
    tresorerie: 'Trésorerie',
    annee: 'Année',
    mois: 'Mois',
    foyer: 'Foyer',
  },
  // ── Commun ───────────────────────────────────────────────
  commun: {
    creer: 'Créer',
    modifier: 'Modifier',
    supprimer: 'Supprimer',
    annuler: 'Annuler',
    enregistrer: 'Enregistrer',
    confirmer: 'Confirmer',
    fermer: 'Fermer',
    rechercher: 'Rechercher…',
    oui: 'Oui',
    non: 'Non',
    succes: 'Succès',
    erreur: 'Erreur',
    chargement: 'Chargement…',
    aucunResultat: 'Aucun résultat',
    repartitionInvalide: 'La somme des quotes-parts doit être égale à 100 %.',
    confirmerSuppression: 'Êtes-vous sûr de vouloir supprimer cet élément ?',
    suppressionImpossible: 'Suppression impossible : cet élément est référencé.',
    basculerTheme: 'Basculer le thème clair/sombre',
    menuUtilisateur: 'Ouvrir le menu utilisateur',
  },
  // ── Référentiels ─────────────────────────────────────────
  referentiels: {
    membre: {
      titre: 'Membres',
      nom: 'Nom',
      couleur: 'Couleur',
      ordre: 'Ordre',
      actif: 'Actif',
    },
    compte: {
      titre: 'Comptes bancaires',
      libelle: 'Libellé',
      type: 'Type',
      soldeInitial: 'Solde initial',
      devise: 'Devise',
      ordre: 'Ordre',
      types: { COURANT: 'Courant', EPARGNE: 'Épargne', COMMUN: 'Commun', AUTRE: 'Autre' },
    },
    categorie: {
      titre: 'Catégories',
      libelle: 'Libellé',
      typePoste: 'Type de poste',
      systeme: 'Système',
      ordre: 'Ordre',
    },
    actif: {
      titre: 'Actifs patrimoniaux',
      libelle: 'Libellé',
      typeActif: 'Type',
      soldeInitial: 'Valeur initiale',
      devise: 'Devise',
      tauxCroissance: 'Taux croissance/an (%)',
      ordre: 'Ordre',
      types: { IMMOBILIER: 'Immobilier', FINANCIER: 'Financier', RETRAITE: 'Retraite', AUTRE: 'Autre' },
    },
    taux: {
      titre: 'Taux de change',
      devise: 'Devise',
      tauxVersBase: 'Taux vers devise de base',
    },
  },
  // ── Paramètres ───────────────────────────────────────────
  parametres: {
    titre: 'Paramètres du foyer',
    nom: 'Nom du foyer',
    deviseBase: 'Devise de base',
    enregistrer: 'Enregistrer les paramètres',
    supprimer: 'Supprimer le foyer',
    confirmerSuppression: 'Êtes-vous sûr de vouloir supprimer ce foyer ? Cette action est irréversible.',
  },
  // ── Accès ─────────────────────────────────────────────────
  acces: {
    titre: 'Gestion des accès',
    inviter: 'Inviter un utilisateur',
    email: 'Email',
    role: 'Rôle',
    roles: { OWNER: 'Propriétaire', EDITOR: 'Éditeur', VIEWER: 'Lecteur' },
    retirer: 'Retirer l\'accès',
  },
  // ── Patrimoine ────────────────────────────────────────────
  patrimoine: {
    titre: 'Patrimoine',
    patrimoineNet: 'Patrimoine net',
    soldesComptes: 'Soldes des comptes',
    soldesActifs: 'Valeur des actifs',
    annee: 'Année',
    courbe: 'Évolution du patrimoine net',
  },
  // ── Objectifs ─────────────────────────────────────────────
  objectif: {
    titre: 'Objectifs',
    libelle: 'Libellé',
    montantCible: 'Montant cible',
    echeance: 'Échéance',
    compte: 'Compte lié',
    actif: 'Actif lié',
    progression: 'Progression',
    epargneRequise: 'Épargne requise/mois',
    soldeActuel: 'Solde actuel',
  },
  // ── Comparaison ───────────────────────────────────────────
  comparaison: {
    titre: 'Comparaison de scénarios',
    selectionner: 'Sélectionner des scénarios',
    tresorerie: 'Trésorerie comparée',
    solde: 'Solde disponible comparé',
    ecart: 'Écart vs référence',
  },
  // ── Mois ─────────────────────────────────────────────────
  mois: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
};

export type I18n = typeof FR;
