# 03 — Architecture

> Architecture backend/frontend, sécurité multi-tenant, multi-devises, i18n et structure
> des projets.

> **Décisions gouvernées par ce doc** : découpage en packages, isolation du moteur, stratégie de sécurité multi-tenant, cache, multi-devises, i18n, configuration et couplage PrimeNG/Tailwind.

---

## 1. Vue macro
```
Angular 22 + PrimeNG 22 + Tailwind v4        Spring Boot 4 (Java 21)
(SPA standalone, signals)   ── REST+JWT ──▶   API stateless
                            ◀── JSON DTO ──    ┌ MoteurCalcul (pur) ┐
                                                └──────────┬────────┘
                                                     JPA / Flyway
                                                           ▼
                                                     PostgreSQL 16
```
Principes : **API stateless** (JWT), **moteur de calcul isolé et testable**,
**multi-tenant par foyer**, **DTO ≠ entités** (MapStruct), **schéma géré par Flyway**.

## 2. Stack

| Couche | Choix |
|---|---|
| Backend | Spring Boot **4.0.0**, Java **21** (Web, Data JPA, Security, Validation) |
| Persistance | PostgreSQL **16+**, Flyway (migrations versionnées), `ddl-auto=validate` |
| Mapping | MapStruct, Lombok (DTO ⇄ entités) |
| Doc API | springdoc-openapi (Swagger UI `/swagger-ui.html`) |
| Auth | JWT access + refresh, BCrypt |
| Frontend | Angular **22** (standalone, signals, strict) |
| UI Kit | PrimeNG **22.x**, PrimeIcons, thème par tokens (preset Aura) |
| CSS | Tailwind CSS **v4** couplé via `tailwindcss-primeui` + CSS layers (remplace PrimeFlex) |
| Graphiques | Chart.js via `p-chart` |
| i18n | ngx-translate (`fr.json`/`en.json`) + `Intl` |

> Socles **imposés** : Spring Boot 4, Angular 22, PrimeNG 22, Tailwind v4. Pour les autres
> dépendances, garder la dernière version stable compatible.

## 3. Backend — package-by-feature

Sous `ch.homely` (`src/main/java/ch/homely`) : chaque feature = `controller` → `service`
→ `repository` + `dto` + `mapper` (MapStruct) + `entity`.
```
ch.homely
├── config/       SecurityConfig, CorsConfig, OpenApiConfig, JpaConfig, CacheConfig
├── securite/     JwtService, JwtAuthFilter, MultiTenantService (scoping + rôles)
├── commun/       GlobalExceptionHandler (@RestControllerAdvice), exceptions, ApiError
├── utilisateur/  Utilisateur, AuthService/Controller (register/login/refresh/logout/moi)
├── foyer/        Foyer, AccesFoyer, FoyerService (onboarding atomique)
├── membre/       Membre + CRUD
├── compte/       Compte + compte_membre (N-N) + CRUD
├── categorie/    Categorie + CRUD
├── taux/         TauxChange + CRUD
├── scenario/     Scenario, RepartitionPeriode/Part, duplication/référence
├── poste/        Poste, RepartitionPoste, VentilationCompte, PosteValidator,
│                 PosteService (reviser/annuler/decaler/cloturer/reactiver)
├── poche/        PolitiqueArgentPoche, AllocationArgentPoche, ArgentPocheService
├── dashboard/    Seuils d'interprétation du dashboard (config, sans logique moteur)
├── moteur/       ★ MoteurCalcul (pur, records immuables) + événements + argent de poche
└── projection/   ProjectionService (cache Caffeine) + controllers (annuelle,
                  tresorerie, tresorerie-cumulee, mensuelle, evenements, taux-effort, apercu poste)
```

### 3.1 Module `moteur` (critique)
- **Aucune dépendance** à Spring, JPA ou l'horloge (dates passées en paramètre). Entrées =
  records (`PosteCalcul`, `RepartitionCalcul`, `ParametresScenario`) ; sorties =
  `ProjectionAnnuelle`, `ProjectionPluriannuelle`, `Ventilations`, etc.
- Implémente **exactement** [doc 01](01-principes-et-moteur.md) ; testé par les vecteurs
  golden (JUnit 5 + AssertJ), couverture **> 90 %**. Ne régresse jamais.
- Le module `projection` fait le pont : charge le scénario (JPA, fetch joints anti-N+1),
  mappe vers les records, appelle le moteur, mappe en DTO, gère le cache.

### 3.2 Cache & logique métier
- Cache Caffeine clé `(scenarioId, versionScenario)`, invalidé à chaque modification de
  poste/hypothèse.
- **Règle** : tout calcul dérivé des règles métier (quote-part effective, proratisation,
  conversions, argent de poche…) est calculé **une seule fois côté backend** (dans
  `moteur` ou un service réutilisant `moteur`) et exposé tel quel via DTO. Le frontend
  **affiche**, il ne ré-implémente jamais une formule métier en TypeScript.

## 4. Sécurité & multi-tenant

- **JWT** : access token (15 min, HMAC-SHA256) + refresh opaque (rotation, 7 j, en base
  `token_refresh`, transmis via **cookie httpOnly/Secure/SameSite=Strict** — jamais en
  JSON). Mots de passe **BCrypt**.
- Endpoints publics : `/api/auth/{register,login,refresh,logout}`. Tout le reste exige un
  token valide.
- **Autorisation** : chaque requête cible un foyer (`/api/foyers/{foyerId}/…`).
  `MultiTenantService` vérifie l'`AccesFoyer` et applique le rôle : `VIEWER` (lecture),
  `EDITOR` (+ écriture), `OWNER` (+ gestion des accès, suppression du foyer).
- **Scoping systématique** : toute requête repository filtre par `foyerId` (ou
  `scenarioId` du foyer). **Ne jamais** exposer une entité d'un autre foyer — test de
  sécurité d'accès croisé **obligatoire** (403/404). Toute tentative inter-foyers est
  journalisée.
- CORS restreint par `CORS_ORIGINS`. Erreurs uniformisées via `GlobalExceptionHandler` →
  `ApiError` + code métier stable.

## 5. Multi-devises

Le foyer définit `deviseBase`. Conversion **prévisionnelle** (taux fixes dans
`taux_change`), appliquée par le moteur (doc 01 §6). L'API de projection renvoie des
montants en `deviseBase` (nombres bruts) ; le **formatage** (symbole, séparateurs) est
fait côté frontend via `Intl.NumberFormat`.

## 6. Internationalisation

- FR par défaut, FR/EN disponibles. Traductions dans `frontend/src/assets/i18n/<lang>.json`
  (mêmes clés), chargées via **ngx-translate**. **Aucun texte en dur** dans les composants.
- `I18nService` encapsule `TranslateService` (langue courante en signal, langues
  disponibles, changement de langue). Chaque composant expose `t = this.i18n.translations()`
  pour un accès typé `t.nav.xxx`. Interpolation via `I18nService.instant(cle, params)`.
- Le choix de langue (et le thème clair/sombre) sont des préférences UI persistées en
  `localStorage` — **jamais** de donnée métier applicative en storage.
- Dates/nombres/devises formatés via `Intl` ; le backend renvoie ISO-8601 + nombres bruts.

## 7. Frontend — architecture Angular

- Angular 22, **standalone components** (pas de NgModule), **signals**, Router lazy par
  feature, strict mode TS.
- PrimeNG 22 (tables, dialogs, selects, datepicker, chart…), thème par **tokens** (preset
  Aura). Tailwind v4 = layout/espacement/responsive.
- Services HTTP typés (un par ressource) + **interceptor JWT** (ajout token, refresh
  transparent sur 401) + **interceptor date** (décalage fuseau `p-datepicker` ↔ backend).
- **State** : `ContexteService` (signals globaux « foyer / scénario courant ») ; chaque
  feature gère son état local en signals (pas de store type NgRx).
```
frontend/src/app
├── core/     guards, interceptors (jwt, date), services (ContexteService, I18nService…),
│             pipes (montant/date/pct/périodicité), constants, models
├── shared/   composants réutilisables (carte-bilan, tag, tab-group, page-nav, metric-ring,
│             stat-grid, kpi-chip(-row), event-grid, objective-progress, taux-effort-card)
├── shell/    topbar, sidebar-menu, foyer-scenario-switcher
└── features/ auth, foyer, referentiels, scenarios, postes, argent-poche, dashboard,
              parametres
```

### 7.1 Couplage PrimeNG + Tailwind v4
Suivre le guide officiel `primeng.dev/tailwind` :
```scss
@use "primeicons/primeicons.css";
@use "tailwindcss";
@plugin "tailwindcss-primeui";
@layer tailwind, primeng;
```
```ts
providePrimeNG({ theme: { preset: Aura, options: {
  cssLayer: { name: 'primeng', order: 'tailwind, primeng' },
  darkModeSelector: '.app-dark'
}}})
```
- Le layer `primeng` se place **après** `base` mais **avant** les utilitaires Tailwind
  (surcharge sans le préfixe `!`). Utiliser les tokens partagés (`bg-primary`,
  `text-surface-*`). `darkModeSelector` aligné sur la variante `dark` de Tailwind.
- Ne pas utiliser PrimeFlex (legacy).

## 8. Configuration & environnements

- Backend : profils Spring (`dev`/`prod`), config via variables d'environnement
  (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS`). **Jamais** de secret
  en dur ni committé (`.env.example` documente les clés).
- `application.yml` : datasource, Flyway `enabled`, JPA `ddl-auto=validate`, Jackson (dates
  ISO). Frontend : `environment.ts` / `.prod.ts` (URL de l'API).
- **Docker** : `docker-compose.yml` (PostgreSQL + backend + front), Dockerfiles
  multi-stage.

## 9. Qualité & robustesse

- Backend : JUnit 5 + AssertJ, intégration via **Testcontainers** (PostgreSQL réel).
  Couverture module `moteur` **> 90 %**.
- Gestion d'erreurs centralisée (`@RestControllerAdvice` → `ApiError` uniforme). Validation
  d'entrée systématique (Bean Validation + `PosteValidator`). Actuator `/health` sécurisé.
