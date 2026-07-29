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
| **Moteur de calcul** (lissage, périodicité, fenêtres, prorata N membres, multi-devises, trésorerie chaînée) | ✅ Complet | Module `moteur` pur (aucune dépendance Spring/JPA/horloge), fidèle à [doc 01](01-business-rules-engine.md) |
| **Projections** (annuelle, mensuelle, trésorerie, aperçu poste) | ✅ Complet | Endpoints réels : `annuelle`, `annuelle-complete`, `tresorerie`, `mensuelle`, `postes/{id}/apercu` |
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
├── poste/          Poste (+ posteOrigineId), RepartitionPoste, VentilationCompte,
│                   PosteValidator, PosteService (reviser/annuler/decaler/cloturer/reactiver)
├── objectif/       Objectif (compte obligatoire) + calculs progression/épargne requise
├── moteur/         ★ MoteurCalcul (pur, records immuables) — cœur du calcul budgétaire
└── projection/     ProjectionService (cache Caffeine) + ProjectionController +
                    ProjectionExtraController (comparaison/aperçu — comparaison NON implémentée)
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

Détails endpoints : [doc 04](04-api-spec.md). Détails schéma : [doc 02](02-domain-and-data-model.md).

## 4. Carte technique — frontend (Angular 22, PrimeNG 22, Tailwind v4)

```
frontend/src/app
├── core/        guards (auth), interceptors (jwt refresh, date), services (ContexteService,
│                I18nService…), pipes (montant/date/pct/périodicité), constants, models
├── shared/      composants réutilisables (carte-bilan, tag)
├── shell/       topbar, sidebar-menu, foyer-scenario-switcher
└── features/
    ├── auth/            login, register
    ├── foyer/           foyer-creation (onboarding), foyer-liste
    ├── referentiels/     membres, comptes, categories, taux
    ├── scenarios/        scenarios-liste, repartition-periodes
    ├── postes/           postes-liste (revenus/charges/réserves — composant unique paramétré)
    ├── dashboard/         dashboard-annuel, dashboard-mensuel
    ├── objectifs/         cartes + progression
    └── parametres/        paramètres foyer, acces (invitations, OWNER)
```

17 routes réelles (voir [doc 05 §2](05-frontend-spec.md)). Pas de feature `patrimoine/`
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

## 6. Écarts documentation ↔ code (constat de cette cartographie)

| Écart | Avant | Après correction | Documents mis à jour |
|---|---|---|---|
| Patrimoine (T8.4) | Marqué fait dans le backlog | Marqué non fait ; endpoint/écran absents | 04 §9.4, 05 §3.5, 06 T8.4/T10.6 |
| Comparaison scénarios (T8.5) | Marqué fait dans le backlog | Marqué non fait ; endpoint/écran absents | 04 §9.5, 05 §3.4, 06 T8.5/T10.3 |
| Duplication de scénario (T7.3) | Marqué non fait | En réalité implémenté | 06 T7.3 |
| Pagination (T5.2) | Marqué en cours | En réalité non commencé | 03 §9, 04 §1/§7, 06 T5.2 |
| Chemin `repartition-periodes` | Documenté | Chemin réel = `.../periodes` | 04 §6.2 |
| Poste `:dupliquer` | Documenté comme existant | N'existe pas | 04 §7 |
| Cycle de vie du poste (révision/clôture/décalage) | Non documenté | Documenté (implémenté) | 02, 04 §7.0-bis, 06 T7.8 |
| Périodes de répartition | Peu détaillé | Détaillé (implémenté) | 02, 04 §6.2, 06 T7.7 |
| `compte_membre` (N-N) | Non documenté | Documenté (implémenté) | 02, 06 T7.9 |
| PrimeNG version | Documentée 21.1.x, migration « à planifier » | Réellement 22.0.x, migration déjà faite | README racine, docs/README, 03 §6, 05 §4.7, 06 T0.2 |
| Script `dev.ps1` | Documenté dans README racine | N'existe pas ; seul `run-ng.ps1` (wrapper `ng`) existe | README racine |
| Colonnes `ordre` (membre/compte/categorie/actif) | Documentées | Supprimées en V13 (tri automatique) | 02, 05 §3.7 |
| Tests unitaires frontend | Implicitement attendus | 0 fichier `.spec.ts` | 03 §8, 05 §6, 06 T11.5 |
| CI GitHub Actions | Tâche ouverte (cohérent) | Confirmé absent | 03 §8, 06 T0.4/T11.6 |

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
