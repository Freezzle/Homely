# 03 — Architecture

> Architecture cible du backend Spring Boot et du frontend Angular/PrimeNG, sécurité,
> multi-tenant, multi-devises, i18n, structure des projets et configuration.

---

## 1. Vue macro

```
┌─────────────────────────┐      HTTPS / REST + JWT       ┌──────────────────────────┐
│ Angular 22 + PrimeNG 21  │  ─────────────────────────▶  │  Spring Boot 4 (Java 21)  │
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
├── actif/             # Actif
├── taux/              # TauxChange
├── scenario/          # Scenario, RepartitionDefaut, duplication
├── poste/             # Poste, RepartitionPoste, VentilationCompte, NaturePoste
├── objectif/          # Objectif
├── moteur/            # ★ MoteurCalcul (pur) + projection réelle/mensualisée
└── projection/        # endpoints annuel/mensuel/tresorerie/patrimoine/comparaison
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

## 3. Sécurité & authentification

- **JWT** : `access token` (courte durée, ex. 15 min) + `refresh token` (rotation).
  Signature HMAC (secret) ou RSA. Mots de passe **BCrypt**.
- Endpoints publics : `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`.
  Tout le reste exige un token valide.
- **Autorisation multi-tenant** : chaque requête cible un foyer (`/api/foyers/{foyerId}/…`).
  Un filtre/intercepteur vérifie que l'utilisateur courant possède un `AccesFoyer` sur ce
  foyer, et applique le rôle :
  - `VIEWER` : lecture seule (GET).
  - `EDITOR` : lecture + écriture des postes/scénarios/objectifs/référentiels.
  - `OWNER` : + gestion des accès (inviter/retirer des utilisateurs), suppression du foyer.
- **Scoping systématique** : toute requête repository filtre par `foyerId` (ou
  `scenarioId` appartenant au foyer). **Ne jamais** exposer une entité d'un autre foyer
  (test de sécurité obligatoire : accès croisé → 403/404).
- CORS configuré pour l'origine du frontend. Headers de sécurité (CSP a minima côté
  serveur d'hébergement du front).

## 4. Multi-devises

- Le foyer définit `deviseBase`. La conversion est **prévisionnelle** (taux fixes stockés
  dans `taux_change`), appliquée par le moteur (doc 1 §7).
- Les montants renvoyés par l'API de projection sont en `deviseBase`. Le champ devise
  d'un poste est conservé pour la saisie/l'affichage de la ligne.
- Le **formatage** (symbole, séparateurs) est fait **côté frontend** via `Intl.NumberFormat`
  selon la locale utilisateur + la devise ; le backend renvoie des nombres bruts.

## 5. Internationalisation

- Frontend **FR par défaut**, architecture i18n prête pour d'autres langues (clés de
  traduction, pas de texte en dur dans les composants).
- Dates/nombres/devises formatés via `Intl` (locale). Le backend renvoie dates ISO-8601
  et nombres bruts (pas de formatage serveur).
- Les libellés métier (catégories système, types) : renvoyer une **clé** stable +
  libellé par défaut ; le front peut surcharger la traduction.

## 6. Frontend — architecture Angular

- **Angular 22**, **standalone components** (pas de NgModule), **signals** pour l'état
  local, **Angular Router** avec lazy-loading par feature, **strict mode** TS activé.
- **PrimeNG 21.1.x** pour les composants (tables, formulaires, dialogs, menus), **p-chart**
  (Chart.js) pour les graphiques, **PrimeIcons**. Thème par **tokens de design** (preset
  Aura via `@primeng/themes`, mode styled).
- **Tailwind CSS v4** pour la mise en page, l'espacement et les utilitaires, **couplé à
  PrimeNG** (voir §6.1). Tailwind **remplace PrimeFlex** (legacy).
- Couche **services HTTP** typés (un service par ressource) + **interceptor** JWT
  (ajout du token, refresh transparent sur 401, redirection login).
- **State** : privilégier des *signal stores* légers par feature (ou NgRx SignalStore si
  volume le justifie) ; le contexte « foyer courant » et « scénario courant » sont des
  signals globaux (service `ContexteService`).
- Structure :
```
src/app/
├── core/            # auth, interceptors, guards, contexte foyer/scénario, config
├── shared/          # composants/pipes/directives réutilisables, modèles TS (DTO)
├── layout/          # shell (topbar, menu latéral, sélecteur foyer/scénario)
└── features/
    ├── auth/            # login, register
    ├── foyer/           # gestion foyer, membres, accès (invitations)
    ├── referentiels/    # comptes, catégories, actifs, taux de change
    ├── scenarios/       # liste, duplication, hypothèses, comparaison
    ├── postes/          # revenus, charges, réserves (CRUD + tableaux)
    ├── dashboard-annuel/
    ├── dashboard-mensuel/
    ├── patrimoine/      # net worth
    └── objectifs/
```

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
- Frontend : tests unitaires (Vitest/Jasmine) sur services et composants clés ;
  éventuellement e2e (Playwright) sur les parcours principaux.
- **GitHub Actions** : build + tests back, build + lint + tests front, sur chaque PR.
  Bloquer le merge si les tests du moteur échouent.
- Lint/format : Spotless/Checkstyle (Java), ESLint + Prettier (front).

## 9. Observabilité & robustesse

- Gestion d'erreurs centralisée (`@RestControllerAdvice`) → format `ApiError` uniforme
  (voir doc 04). Logs structurés. Actuator (`/health`, `/info`) exposé de façon sécurisée.
- Validation d'entrée systématique (Bean Validation sur les DTO) ; messages localisables.
- Pagination + tri sur toutes les listes potentiellement longues (postes).
