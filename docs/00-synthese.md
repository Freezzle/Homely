# 00 — Synthèse & cartographie (métier + technique)

> Document de **synthèse**, produit à partir d'une exploration exhaustive du code réel
> (backend `ch.homely`, migrations Flyway V1→V13, frontend `frontend/src/app`). Il donne
> une vue d'ensemble rapide ; pour le détail normatif, se référer aux docs 01→06. En cas
> d'écart entre ce document et 01-06, **le code source fait foi** — ce fichier est mis à
> jour au fil des cartographies, pas l'inverse.

---

## 1. Vision (rappel)

Simulateur de budget prévisionnel familial, multi-foyers (SaaS), qui projette mois par
mois et année par année les flux financiers d'un foyer et sa trésorerie cumulée, en
reproduisant fidèlement (au centime) la logique d'un classeur Excel d'origine. Aucune
gestion du réalisé/import bancaire. Détails : [`README.md`](README.md) §1-2.

## 2. Carte fonctionnelle (modules métier)

| Module métier | Statut réel | Notes |
|---|---|---|
| **Authentification** (inscription, connexion, JWT, rôles) | ✅ Complet | Access 15 min + refresh 7 j (cookie httpOnly), BCrypt |
| **Foyers & accès multi-utilisateurs** | ✅ Complet | Rôles OWNER/EDITOR/VIEWER, onboarding (membres + scénario de référence auto-créés) |
| **Référentiels** (Membres, Comptes, Catégories, Taux de change) | ✅ Complet | Comptes ↔ Membres en N-N (`compte_membre`) ; tri désormais automatique (colonnes `ordre` supprimées en V13) |
| **Scénarios (what-if)** | ✅ Complet | CRUD, duplication profonde (`:dupliquer`), définition de référence (`:definir-reference`) |
| **Périodes de répartition** (prorata variable dans le temps) | ✅ Complet | `RepartitionPeriode`/`RepartitionPeriodePart`, classification `AUTO`/`REVERSE_AUTO`/`CUSTOM` par poste |
| **Postes budgétaires** (revenus/charges/réserves) | ✅ Complet | CRUD + cycle de vie avancé : révision de montant chaînée (`posteOrigineId`), annulation, décalage de fenêtre, clôture/réactivation |
| **Objectifs d'épargne** | ✅ Complet | Compte obligatoire, progression/épargne requise calculées |
| **Moteur de calcul** (lissage, périodicité, fenêtres, prorata N membres, multi-devises, trésorerie chaînée, événements, argent de poche) | ✅ Complet | Module `moteur` pur (aucune dépendance Spring/JPA/horloge), fidèle à [doc 01](01-business-rules-engine.md) ; événements budgétaires (`MoteurCalcul#evenements`) et retrait de l'argent de poche du solde disponible (`ArgentDePocheProvider`, doc 01 §9) |
| **Argent de poche** (politiques récurrentes + allocations ponctuelles) | ✅ Complet | Package `poche/` ; résolution `allocation > politique > 0` ; alimente le solde disponible et l'indicateur taux d'effort ; écran dédié + widget dashboard |
| **Projections** (annuelle, mensuelle, trésorerie, événements, aperçu poste, taux d'effort) | ✅ Complet | Endpoints réels : `annuelle`, `annuelle-complete`, `tresorerie`, `mensuelle`, `evenements`, `postes/{id}/apercu`, `taux-effort` (avec argent de poche) |
| **Tableau de bord** (foyer + par membre, frise d'événements) | ✅ Complet | Écran unifié `DashboardComponent` (route `dashboard/:sujetId/:annee/:mois?`) — remplace les anciens écrans séparés dashboard-annuel/dashboard-mensuel ; sujet = foyer ou membre |
| **Poste — enrichissements descriptifs** (`moment=INCONNU`, `importance`, `potentiel_optimisation`) | ✅ Complet | Champs descriptifs (échelle 1-5 pour les deux derniers), sans impact sur le moteur |
| **Compte primaire par membre** | ✅ Complet | `compte_membre.est_primaire` (un seul par membre, contrainte unique partielle) — source des virements de comblement |
| **Patrimoine / net worth** | ❌ **Non implémenté** | Aucune notion d'actif patrimonial (supprimée) ; aucun endpoint/service de calcul de patrimoine net, aucun écran dédié |
| **Comparaison de scénarios** | ❌ **Non implémenté** | Aucun endpoint ni écran côte-à-côte multi-scénarios |
| **Pagination/tri des listes API** | ❌ **Non implémenté** | Toutes les listes renvoient un tableau JSON brut |
| **CI/CD (GitHub Actions)** | ❌ **Non implémenté** | Pas de `.github/workflows/*.yml` |
| **Tests unitaires frontend** | ❌ **Non implémenté** | 0 fichier `.spec.ts` malgré le socle Jasmine/Karma configuré |

## 3. Carte technique — backend (Spring Boot 4, Java 21)

Package-by-feature sous `ch.homely` (`src/main/java/ch/homely`) :

```
ch.homely
├── config/        SecurityConfig, CorsConfig, OpenApiConfig, JpaConfig (auditing), CacheConfig
├── securite/       JwtService, JwtAuthFilter, MultiTenantService (scoping + rôles)
├── commun/         GlobalExceptionHandler (@RestControllerAdvice), exceptions métier, ApiError
├── utilisateur/    Utilisateur, AuthService/AuthController (register/login/refresh/logout/moi)
├── foyer/          Foyer, AccesFoyer, FoyerService (onboarding atomique), FoyerController
├── membre/         Membre + CRUD
├── compte/         Compte + compte_membre (N-N) + CRUD
├── categorie/      Categorie + CRUD (typePoste)
├── taux/           TauxChange + CRUD
├── scenario/       Scenario, RepartitionPeriode/Part, RepartitionDefaut (legacy),
│                   ScenarioService (dupliquer/definirReference), RepartitionPeriodeController
├── poste/          Poste (+ posteOrigineId, moment=INCONNU, importance, potentiel_optimisation),
│                   RepartitionPoste, VentilationCompte, PosteValidator,
│                   PosteService (reviser/annuler/decaler/cloturer/reactiver)
├── objectif/       Objectif (compte obligatoire) + calculs progression/épargne requise
├── poche/          ★ PolitiqueArgentPoche, AllocationArgentPoche, ArgentPocheService
│                   (résolution allocation > politique > 0), ArgentPocheController
├── moteur/         ★ MoteurCalcul (pur, records immuables) — cœur du calcul budgétaire,
│                   inclut la détection d'événements budgétaires (`evenements`) et le
│                   retrait de l'argent de poche du solde disponible (`ArgentDePocheProvider`)
└── projection/     ProjectionService (cache Caffeine) + ProjectionController (annuelle,
                    tresorerie, mensuelle, evenements, taux-effort) + ProjectionExtraController
                    (aperçu poste — comparaison de scénarios NON implémentée)
```

**Migrations Flyway** (`src/main/resources/db/migration`) :

| Version | Contenu |
|---|---|
| V1 | Schéma initial complet |
| V2 | Seed démo « Charmillot » (2 membres, 6 comptes, catégories) |
| V3 | `token_refresh` (JWT refresh) |
| V4 | Seed réel Excel complet (66 postes, horizon 25 ans) |
| V5 | `poste.nature` (EFFECTIF/ESTIMATION) |
| V6 | Suppression `categorie.systeme` |
| V7 | `repartition_periode`/`repartition_periode_part` + `type_repartition` (remplace `repartition_defaut`) |
| V8 | `compte_membre` (N-N) ; suppression `compte.type` et `poste.compte_source` |
| V9 | Nettoyage `ventilation_compte` à 0 % |
| V10 | `poste.estim_pourcentage` |
| V11 | `poste.categorie_id` en `ON DELETE SET NULL` |
| V12 | `poste.poste_origine_id` (chaînage des révisions) |
| V13 | Suppression de la colonne `ordre` sur membre/compte/categorie/actif |
| V14 | Suppression de la table legacy `repartition_defaut` |
| V15 | Suppression de la notion d'actif patrimonial (table `actif`, `objectif.actif_id`) ; `objectif.compte_id` devient obligatoire |
| V16 | Second foyer de démonstration « Foyer Berthoud » (anonymisé) — 2 membres, 8 comptes, 20 catégories, 1 scénario de référence |
| V17 | `poste.moment` accepte `INCONNU` (date de paiement non connue, impose `MENSUALISE`) |
| V18 | `poste.importance` (1-5, descriptif, défaut 3) |
| V19 | `poste.potentiel_optimisation` (1-5, descriptif, défaut 3) |
| V20 | `membre.compte_primaire_id` (compte primaire, v1 — colonne unique sur `membre`) |
| V21 | Compte primaire déplacé vers `compte_membre.est_primaire` (un compte peut être primaire pour plusieurs co-titulaires ; un membre a au plus un primaire) ; suppression de `membre.compte_primaire_id` |
| V22 | `politique_argent_poche` (mode VARIABLE : socle/pourcentage/plafond, ou FIXE : montant_fixe) |
| V23 | `allocation_argent_poche` (montant ponctuel par membre/mois, unique par `(scenario, membre, mois)`) |

Détails endpoints : [doc 04](04-api-spec.md). Détails schéma : [doc 02](02-domain-and-data-model.md).

## 4. Carte technique — frontend (Angular 22, PrimeNG 22, Tailwind v4)

```
frontend/src/app
├── core/        guards (auth), interceptors (jwt refresh, date), services (ContexteService,
│                I18nService, ArgentPocheService…), pipes (montant/date/pct/périodicité), constants, models
├── shared/      composants réutilisables (carte-bilan, tag, tab-group, page-nav,
│                metric-ring, stat-grid, kpi-chip(-row), event-grid, objective-progress,
│                taux-effort-card [jauge charges+réserves(+argent de poche)])
├── shell/       topbar, sidebar-menu (dashboard foyer + par membre), foyer-scenario-switcher
└── features/
    ├── auth/            login, register
    ├── foyer/           foyer-creation (onboarding), foyer-liste
    ├── referentiels/     membres, comptes, categories, taux
    ├── scenarios/        scenarios-liste, repartition-periodes
    ├── postes/           postes-liste (revenus/charges/réserves — composant unique paramétré)
    ├── argent-poche/      politiques + allocations (CRUD) par membre/scénario
    ├── dashboard/         DashboardComponent unifié (sujet foyer/membre × vue annuelle/mensuelle,
    │                      pilotée par l'URL) + guards de redirection/rétrocompat + widget argent de poche
    ├── objectifs/         cartes + progression
    └── parametres/        paramètres foyer, acces (invitations, OWNER)
```

Routes réelles (voir [doc 05 §2](05-frontend-spec.md)). Pas de feature `patrimoine/`
ni de route de comparaison de scénarios. Détails écrans : [doc 05](05-frontend-spec.md).

**Versions réelles** (`frontend/package.json`) : Angular `^22.0.5`, PrimeNG `^22.0.0`,
Tailwind `^4.3.2`, `@ngx-translate/core` `^18.0.0`, Chart.js `^4.4.7`.

## 5. Sécurité (résumé)

- JWT access (15 min, HMAC-SHA256) + refresh (7 j, rotation, cookie httpOnly/Secure/
  SameSite=Strict, jamais exposé en JSON).
- `MultiTenantService` : vérifie `AccesFoyer` sur chaque requête scopée foyer, applique le
  rôle (VIEWER lecture seule, EDITOR écriture, OWNER + gestion des accès), journalise les
  tentatives d'accès croisé.
- CORS restreint par `CORS_ORIGINS`. Erreurs uniformisées (`GlobalExceptionHandler` →
  `ApiError` + code métier). Détails : [doc 03 §3](03-architecture.md), [doc 04 §2-3](04-api-spec.md).

## 6. Écarts documentation ↔ code (état courant)

> Cette liste doit tendre vers **vide** : elle n'énumère que les écarts encore ouverts au
> moment de la dernière cartographie. Les écarts déjà corrigés dans une passe précédente
> sont retirés (voir l'historique git de ce fichier au besoin, pas dupliqué ici).

| Écart | État |
|---|---|
| Patrimoine / net worth | ❌ Non implémenté (endpoint/écran absents) |
| Comparaison de scénarios | ❌ Non implémenté (endpoint/écran absents) |
| Pagination/tri des listes API | ❌ Non implémenté (listes renvoyées en tableau JSON brut) |
| CI GitHub Actions | ❌ Non implémenté (pas de `.github/workflows/*.yml`) |
| Tests unitaires frontend | ❌ Non implémenté (0 fichier `.spec.ts`) |

## 7. Comment naviguer la documentation

| # | Document | Contenu |
|---|---|---|
| 0 | Ce document | Cartographie de synthèse, état réel, écarts |
| 1 | [`01-business-rules-engine.md`](01-business-rules-engine.md) | Moteur de calcul, vecteurs golden |
| 2 | [`02-domain-and-data-model.md`](02-domain-and-data-model.md) | Domaine, schéma SQL, migrations |
| 3 | [`03-architecture.md`](03-architecture.md) | Architecture back/front, sécurité, i18n |
| 4 | [`04-api-spec.md`](04-api-spec.md) | Contrats REST |
| 5 | [`05-frontend-spec.md`](05-frontend-spec.md) | Écrans, composants, patterns Angular |
| 6 | [`06-backlog-and-tasks.md`](06-backlog-and-tasks.md) | Backlog séquencé, statuts corrigés |


> Cette cartographie a été produite par exploration factuelle du code (pas d'hypothèse) ;
> elle devra être ré-exécutée périodiquement (ex. à chaque jalon du backlog) pour rester
> fiable, en particulier sur la section 6 (écarts) qui doit tendre vers une liste vide.
