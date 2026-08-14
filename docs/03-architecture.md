# 03 — Architecture

> Architecture cible du backend Spring Boot et du frontend Angular/PrimeNG, sécurité,
> multi-tenant, multi-devises, i18n, structure des projets et configuration.

---

## 1. Vue macro

```
┌─────────────────────────┐      HTTPS / REST + JWT       ┌──────────────────────────┐
│ Angular 22 + PrimeNG 22  │  ─────────────────────────▶  │  Spring Boot 4 (Java 21)  │
│ + Tailwind v4 (SPA,      │  ◀─────────────────────────  │  API stateless            │
│  standalone, signals)    │        JSON DTO               │                          │
└─────────────────────────┘                               │  ┌────────────────────┐  │
                                                           │  │ MoteurCalcul (pur) │  │
                                                           │  └────────────────────┘  │
                                                           └──────────┬───────────────┘
                                                                      │ JPA / Flyway
                                                                      ▼
                                                              ┌───────────────┐
                                                              │ PostgreSQL 16 │
                                                              └───────────────┘
```

Principes : **API stateless** (JWT), **moteur de calcul isolé et testable**,
**multi-tenant par foyer**, **DTO ≠ entités** (MapStruct), **migrations Flyway**.

## 2. Backend — découpage en couches

Découpage par **domaine fonctionnel** puis par couche (préférer un package-by-feature) :

```
ch.homely
├── config/            # Security, CORS, OpenAPI, Jackson, Flyway
├── securite/          # JWT, filtres, UserDetails, contexte foyer courant
├── commun/            # exceptions, ApiError
├── utilisateur/       # Utilisateur, Auth (login/refresh/register/logout)
├── foyer/             # Foyer, AccesFoyer, rôles
├── membre/            # Membre
├── compte/            # Compte
├── categorie/         # Categorie
├── taux/              # TauxChange
├── scenario/          # Scenario, RepartitionPeriode (+RepartitionDefaut legacy), duplication
├── poste/             # Poste, RepartitionPoste, VentilationCompte, NaturePoste, révisions
├── objectif/          # Objectif
├── poche/             # PolitiqueArgentPoche, AllocationArgentPoche, résolution (doc 01 §13)
├── moteur/            # ★ MoteurCalcul (pur) + projection réelle/mensualisée
└── projection/        # endpoints réels : annuelle / annuelle-complete / tresorerie /
                       #   mensuelle / evenements / taux-effort / apercu poste (patrimoine et
                       #   comparaison ne sont PAS implémentés à ce jour — voir docs/06 T8.4/T8.5)
```

Chaque feature : `controller` (REST) → `service` (métier/validation) → `repository`
(Spring Data) + `dto` + `mapper` (MapStruct) + `entity`.

### 2.1 Le module `moteur` (critique)
- **Aucune dépendance à Spring, JPA ou l'horloge.** Entrées = objets de valeur simples
  (records) : `PosteCalcul`, `RepartitionCalcul`, `ParametresScenario`. Sorties =
  `ProjectionAnnuelle`, `ProjectionPluriannuelle`, `Ventilations`, etc.
- Implémente **exactement** [doc 01](01-business-rules-engine.md). Testé par des tests
  unitaires JUnit alimentés par les vecteurs golden (§8-bis doc 1).
- Le module `projection` fait le pont : charge le scénario (JPA), mappe vers les records
  du moteur, appelle le moteur, mappe les résultats vers des DTO REST, gère le cache.
- La projection annuelle expose désormais deux séries : `mois` (mensualisée) et
  `moisReel` (imputations non lissées), idem par membre (`moisParMembre*`).

### 2.2 Cache de projection
- Cache applicatif (Caffeine) clé = `(scenarioId, versionScenario)` où `versionScenario`
  est un compteur/`updatedAt` invalidé à chaque modification de poste ou d'hypothèse.
- Éviter de recalculer 12×N à chaque affichage de graphique.

### 2.3 Logique métier : toujours côté backend, jamais dupliquée côté frontend
- **Règle** : tout calcul dérivé des règles métier (quote-part effective, proratisation,
  filtrage "ce poste concerne-t-il ce membre", agrégats, conversions de devises, argent
  de poche, etc.) doit être calculé **une seule fois, côté backend** (idéalement dans
  `moteur`, ou dans le service concerné en réutilisant une fonction déjà testée de
  `moteur`) et exposé tel quel via DTO. Le frontend **affiche**, il ne ré-implémente
  jamais une formule métier en TypeScript — sinon les deux implémentations divergent
  silencieusement au fil du temps.

| Cas | Statut | Détail |
|---|---|---|
| Quote-part effective des événements (`/evenements`) | ✅ Corrigé | Recalculée un temps côté Angular (`DecompositionService`), migrée vers un paramètre `membreId` backend qui filtre/proratise et renvoie `EvenementDto.quotePart` (affichage uniquement) |
| Segments "reste à vivre" de l'anneau dashboard (`chargesSuresMois`/`margeVariableMois`) | ⚠️ Dette assumée | Reste dupliqué côté frontend (`DecompositionService.quotePartEffectivePoste`) — migration vers le moteur pas encore spécifiée/validée (vecteurs golden requis, règle d'or §1). À migrer à la prochaine évolution touchant cette zone |

**Avant d'écrire une formule métier dans un composant/service Angular**, vérifier
d'abord si un endpoint existant peut la porter, ou l'étendre (nouveau paramètre + champ
DTO), plutôt que de la reproduire côté client.

## 3. Sécurité & authentification

- **JWT** : `access token` (15 min, signature HMAC-SHA256) + `refresh token` opaque
  (rotation, 7 jours, stocké en base dans `token_refresh`, transmis via **cookie
  httpOnly/Secure/SameSite=Strict** — jamais lisible en JS côté client, jamais renvoyé
  dans le corps JSON de connexion). Mots de passe **BCrypt**.
- Endpoints publics : `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`.
  Tout le reste exige un token valide.
- **Autorisation multi-tenant** : chaque requête cible un foyer (`/api/foyers/{foyerId}/…`).
  `MultiTenantService` vérifie que l'utilisateur courant possède un `AccesFoyer` sur ce
  foyer, et applique le rôle :
  - `VIEWER` : lecture seule (GET).
  - `EDITOR` : lecture + écriture des postes/scénarios/objectifs/référentiels.
  - `OWNER` : + gestion des accès (inviter/retirer des utilisateurs), suppression du foyer.
- **Scoping systématique** : toute requête repository filtre par `foyerId` (ou
  `scenarioId` appartenant au foyer). **Ne jamais** exposer une entité d'un autre foyer
  (test de sécurité obligatoire : accès croisé → 403/404). Toute tentative d'accès
  inter-foyers est journalisée.
- CORS configuré pour l'origine du frontend (`app.cors.allowed-origins`, env
  `CORS_ORIGINS`). Headers de sécurité (CSP a minima côté serveur d'hébergement du front).

## 4. Multi-devises

- Le foyer définit `deviseBase`. La conversion est **prévisionnelle** (taux fixes stockés
  dans `taux_change`), appliquée par le moteur (doc 1 §7).
- Les montants renvoyés par l'API de projection sont en `deviseBase`. Le champ devise
  d'un poste est conservé pour la saisie/l'affichage de la ligne.
- Le **formatage** (symbole, séparateurs) est fait **côté frontend** via `Intl.NumberFormat`
  selon la locale utilisateur + la devise ; le backend renvoie des nombres bruts.

## 5. Internationalisation

- Frontend **FR par défaut, FR/EN disponibles**, architecture i18n prête pour d'autres
  langues : les traductions vivent dans `frontend/src/assets/i18n/<lang>.json`
  (`fr.json`, `en.json` — mêmes clés, structure identique) chargées à l'exécution via
  **ngx-translate** (`@ngx-translate/core` + `@ngx-translate/http-loader`), jamais dans
  le code des composants.
  - `I18nService` (`core/i18n/i18n.service.ts`) encapsule `TranslateService` : point
    d'entrée unique pour la langue courante (`currentLang`, signal), les langues
    disponibles (`availableLangs`) et le changement de langue.
  - Chaque composant expose `readonly t = this.i18n.translations()` (instantané typé —
    via `AppTranslations`, dérivé du JSON par `typeof` — de l'arbre de traduction complet)
    pour un accès direct `t.nav.xxx` dans les templates, sans multiplier les pipes
    `| translate` pour du texte statique.
  - L'interpolation de paramètres (ex. « Membre {{index}} ») utilise la syntaxe native
    ngx-translate via `I18nService.instant(cle, params)`.
  - Le premier rendu attend le chargement du JSON (`provideAppInitializer` dans
    `app.config.ts`) pour éviter tout flash de clé brute.
  - **Sélecteur de langue** (topbar) : `I18nService.setLanguage(lang)` persiste le choix
    de l'utilisateur (clé `homely-lang` en `localStorage` — préférence UI pure, pas de
    donnée métier, au même titre que le thème clair/sombre) puis recharge la page.
    `app.config.ts` relit cette préférence au bootstrap (`langueInitiale()`) pour
    démarrer directement dans la bonne langue. Le rechargement complet est un choix
    pragmatique : plusieurs composants figent des libellés dérivés de `t` dans des
    champs calculés une seule fois à la construction (options de menu, labels
    d'options de sélection…) ; les rendre tous réactifs à un changement de langue en
    cours de session aurait nécessité un refactor bien plus large pour un gain UX mineur.
- Dates/nombres/devises formatés via `Intl` (locale). Le backend renvoie dates ISO-8601
  et nombres bruts (pas de formatage serveur).
- Les libellés métier (catégories système, types) : renvoyer une **clé** stable +
  libellé par défaut ; le front peut surcharger la traduction.

## 6. Frontend — architecture Angular

- **Angular 22**, **standalone components** (pas de NgModule), **signals** pour l'état
  local, **Angular Router** avec lazy-loading par feature, **strict mode** TS activé.
- **PrimeNG 22.0.x** (migration effectuée — `package.json` réel) pour les composants
  (tables, formulaires, dialogs, menus), **p-chart** (Chart.js) pour les graphiques,
  **PrimeIcons**. Thème par **tokens de design** (preset Aura via `@primeng/themes`, mode
  styled).
- **Tailwind CSS v4** pour la mise en page, l'espacement et les utilitaires, **couplé à
  PrimeNG** (voir §6.1). Tailwind **remplace PrimeFlex** (legacy).
- Couche **services HTTP** typés (un service par ressource) + **interceptor** JWT
  (ajout du token, refresh transparent sur 401, redirection login) + **interceptor date**
  (corrige le décalage fuseau horaire entre `p-datepicker` local et le backend UTC).
- **State** : le contexte « foyer courant » et « scénario courant » sont des signals
  globaux (service `ContexteService`) ; chaque feature gère son propre état local en
  signals (pas de store centralisé de type NgRx à ce jour).
- Structure **réelle** (`frontend/src/app`) :
```
src/app/
├── core/            # guards, interceptors (jwt, date), services (ContexteService,
                     #   I18nService…), pipes (montant/date Intl), constants, models, utils
├── shared/          # composants réutilisables (carte-bilan, tag, tab-group, page-nav,
│                    # metric-ring, stat-grid, kpi-chip(-row), event-grid, objective-progress,
│                    # taux-effort-card), utils
├── shell/            # topbar, sidebar-menu, foyer-scenario-switcher
└── features/
    ├── auth/            # login, register
    ├── foyer/           # foyer-creation (onboarding), foyer-liste
    ├── referentiels/    # membres, comptes, categories, taux
    ├── scenarios/       # scenarios-liste, repartition-periodes
    ├── postes/          # postes-liste (revenus/charges/réserves, même composant réutilisé)
    ├── argent-poche/     # politiques + allocations d'argent de poche (CRUD)
    ├── dashboard/        # DashboardComponent unifié (sujet foyer/membre, vue annuelle/mensuelle
    │                     # pilotée par l'URL) + redirect-current-year.guard (redirection année
    │                     # courante + rétrocompat anciennes URLs) + widget argent de poche
    ├── objectifs/        # objectifs (cartes + progression)
    └── parametres/       # paramètres foyer, acces (gestion des invitations, OWNER)
```
> ⚠️ Il n'existe **pas** de feature `patrimoine/` dédiée : aucun dashboard de patrimoine
> net agrégé ni courbe net worth (voir docs/06 T8.4). Il n'existe pas non plus d'écran de
> comparaison de scénarios (voir docs/06 T8.5).

### 6.1 Couplage PrimeNG + Tailwind CSS v4 (intégration officielle)

Suivre le guide officiel `primeng.dev/tailwind`. Points clés :

- Installer Tailwind CSS v4 + le plugin officiel **`tailwindcss-primeui`** (fourni par
  PrimeTek). Ce plugin expose les couleurs sémantiques du thème PrimeNG comme utilitaires
  Tailwind (`bg-primary`, `text-surface-500`, `text-muted-color`) et réintègre les
  animations manquantes de PrimeFlex.
- **CSS layers** pour maîtriser la spécificité : le layer `primeng` doit se placer
  **après** `base` mais **avant** les utilitaires Tailwind, afin que les utilitaires
  Tailwind puissent surcharger les composants **sans** recourir au préfixe `!`.
- Fichier de styles (Tailwind v4, CSS-first) :
  ```scss
  @use "primeicons/primeicons.css";
  @use "tailwindcss";
  @plugin "tailwindcss-primeui";
  @layer tailwind, primeng;
  ```
- Configuration PrimeNG (`app.config.ts`) avec l'ordre de layer aligné :
  ```ts
  providePrimeNG({
    theme: {
      preset: Aura,
      options: {
        cssLayer: { name: 'primeng', order: 'tailwind, primeng' },
        darkModeSelector: '.app-dark'   // aligner avec la variante dark de Tailwind
      }
    }
  })
  ```
- **Répartition des rôles** : Tailwind = layout, grille, espacement, responsive,
  utilitaires ; PrimeNG = composants interactifs (tables, dialogs, selects, datepicker,
  chart…). Utiliser les tokens partagés pour une palette cohérente entre les deux.
- **Dark mode** : `darkModeSelector` PrimeNG doit correspondre à la variante `dark` de
  Tailwind pour un basculement homogène.
- ⚠️ Sur les composants PrimeNG, préférer `class` (et non `styleClass`, désormais
  déprécié pour les composants "host enabled" et supprimé en v22) pour appliquer des
  classes utilitaires Tailwind quand l'API du composant l'exige.

> Les incantations exactes peuvent varier avec les versions ; se référer au dépôt de
> démarrage `primeng-quickstart-tailwind` et au guide officiel au moment de
> l'initialisation.

## 7. Configuration & environnements

- Backend : profils Spring (`dev`, `prod`), config via variables d'environnement
  (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS`). Jamais de secret en
  dur ni committé.
- `application.yml` : datasource, Flyway `enabled=true`, JPA `ddl-auto=validate` (le
  schéma est géré par Flyway, **pas** par Hibernate), Jackson (dates ISO, non-null).
- Frontend : `environment.ts` / `environment.prod.ts` avec l'URL de l'API.
- **Docker** : `docker-compose.yml` pour dev (PostgreSQL + backend + front) ;
  Dockerfiles multi-stage. `.env.example` fourni.

## 8. Qualité & CI

- Backend : JUnit 5 + AssertJ, tests d'intégration avec **Testcontainers** (PostgreSQL),
  couverture visée **> 90 % sur le module `moteur`** (règle métier critique).
- Frontend : **état réel — aucun test unitaire écrit** (0 fichier `.spec.ts` malgré la
  configuration Jasmine/Karma présente dans `angular.json`/`package.json`). À prioriser
  avant d'étendre le périmètre fonctionnel.
- **GitHub Actions : non implémenté à ce jour** (pas de `.github/workflows/*.yml`).
  Cible : build + tests back, build + lint + tests front, sur chaque PR, bloquant si les
  tests du moteur échouent (voir docs/06 T0.4).
- Lint/format : Spotless/Checkstyle (Java), ESLint + Prettier (front) — à vérifier au cas
  par cas selon la configuration effective du dépôt.

## 9. Observabilité & robustesse

- Gestion d'erreurs centralisée (`@RestControllerAdvice` → `GlobalExceptionHandler`) →
  format `ApiError` uniforme (voir doc 04). Logs structurés. Actuator (`/health`, `/info`)
  exposé de façon sécurisée.
- Validation d'entrée systématique (Bean Validation sur les DTO, `PosteValidator` pour les
  règles spécifiques poste/nature). Messages localisables.
- **Pagination + tri sur les listes : cible non atteinte.** Toutes les listes (postes
  compris) renvoient actuellement un tableau JSON brut, sans pagination ni tri serveur
  (voir docs/06 T5.2).
