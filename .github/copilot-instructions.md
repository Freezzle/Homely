# Instructions Copilot — Budget Foyer

> Consignes permanentes pour l'agent LLM travaillant sur ce dépôt. À respecter dans
> **chaque** contribution. En cas de doute sur le métier, la **référence absolue** est
> [`docs/01-principes-et-moteur.md`](../docs/01-principes-et-moteur.md) et ses
> vecteurs golden ; le fichier Excel d'origine tranche en dernier recours.
>
> **Trust these instructions first.** They were validated by running every command
> below in this exact environment. Only search the repo/docs further if something here
> is missing or turns out to be wrong for your specific change.

---

## Repository snapshot
- **What it is**: rewrite of a family budget-forecasting Excel workbook into a
  multi-tenant SaaS web app. Forecast only — no bank import, no "actuals" tracking.
- **Stack**: Spring Boot 4 / Java 21 backend (`src/main/java/ch/homely/...`, Maven
  single-module) + Angular 22 / PrimeNG 22 / Tailwind v4 frontend (`frontend/`,
  standalone Angular CLI app). PostgreSQL via Flyway migrations. Docker Compose for
  local infra.
- **Size**: small-to-medium monorepo — backend ~15 feature packages under
  `ch.homely.*` (`actif`, `categorie`, `commun`, `compte`, `config`, `foyer`, `membre`,
  `moteur`, `objectif`, `poste`, `projection`, `scenario`, `securite`, `taux`,
  `utilisateur`), each usually with a `dto` sub-package. Frontend features under
  `frontend/src/app/{auth,dashboard,foyer,objectifs,parametres,patrimoine,postes,
  referentiels,scenarios}`, plus `core`/`shared`/`shell`.
- `ch.homely.moteur` is the pure calculation engine (no Spring/JPA/clock-based
  `java.time` — dates are passed as parameters). Treat it as the most sensitive part of
  the codebase; see "Règles d'or" below.

## Build, test, and validation — all verified commands
Always run backend commands from the repo root (`E:\Applications\Homely` /
repo root) and frontend commands from `frontend/`. **Tool versions installed and
confirmed working**: Java 21 (Temurin), Maven 3.9.x, Node 22, npm 11.

### PowerShell gotcha (always do this)
On Windows, `npm`/`ng`/`npx` may fail directly in PowerShell with
`"npm.ps1 cannot be loaded... execution of scripts is disabled"` due to the execution
policy — this is an environment restriction, not a repo bug. **Wrap npm/ng/npx calls in
`cmd /c "..."`** (e.g. `cmd /c "npm ci"`, `cmd /c "npm run build"`) to avoid it. Also note
PowerShell surfaces some tool stderr (e.g. esbuild budget warnings) as a
`NativeCommandError`-looking block even when the command actually succeeded — always
check `$LASTEXITCODE`, not just the presence of red/error-looking text.

### Backend (Maven, from repo root)
- Build + unit/integration tests: `mvn test` (or `mvn verify`, used by CI). Tests use
  **Testcontainers** with a real PostgreSQL container, so **Docker must be running**.
  `JWT_SECRET` env var is not strictly required locally (has a dev default in
  `application.yml`) but CI sets one explicitly; safe to set
  `$env:JWT_SECRET="ci-only-secret-not-for-production-must-be-256-bits"` before running
  tests to mirror CI exactly. Confirmed working, full suite passes in ~1-2 minutes.
- Package only (skip tests): `mvn clean package -DskipTests`.
- Run locally: `mvn spring-boot:run` (needs Postgres up — `docker compose up -d
  postgres`, or use `.\dev.ps1` which starts Postgres + backend + frontend together).
- No separate backend lint/format command exists in this repo — Maven `test`/`verify`
  is the only backend gate.
- Test classes live under `src/test/java/ch/homely/...` and use JUnit 5 + AssertJ;
  golden/business-rule vectors mainly live under `.../moteur`. Surefire only picks up
  `**/*Test.java` and `**/*Tests.java` (see `pom.xml`).
- Flyway migrations: `src/main/resources/db/migration/V1__init.sql` ...
  `V12__poste_origine.sql`. Hibernate is `ddl-auto=validate` — **never** rely on
  Hibernate to create/alter schema; add a new `V{n}__description.sql` migration instead
  (next number after the highest existing one).

### Frontend (npm/Angular CLI, from `frontend/`)
- Install deps: `cmd /c "npm ci"` (use `ci`, not `install`, to match CI/lockfile).
- Build (dev): `cmd /c "npm run build"`; production build (used by CI):
  `cmd /c "npm run build -- --configuration production"`. Confirmed working
  (~15-20s). A `▲ [WARNING] bundle initial exceeded maximum budget ...` message is
  expected/pre-existing (budget is a warning, not an error) — it does **not** fail the
  build; don't try to "fix" it unless your task is specifically about bundle size.
- Unit tests: `cmd /c "npm test -- --watch=false --browsers=ChromeHeadless"` (same
  command CI uses). Confirmed working (11/11 pass, exit code 0). Occasionally the very
  first run in a fresh checkout can show a transient PostCSS/webpack error about
  resolving `primeicons` font files (`Can't resolve '../node_modules/primeicons/fonts/
  ...'`) — this resolved on re-run in testing and is not related to your code; re-run
  once before investigating further.
- Lint: `cmd /c "npm run lint"` (maps to `ng lint`) is wired in `angular.json` but
  **currently fails in a fresh checkout** with `Could not find the
  '@angular-eslint/builder:lint' builder's node package` — the `@angular-eslint`
  packages are not present in `package.json`/`package-lock.json` and there is no ESLint
  config file in `frontend/`. This is a **pre-existing repository gap**, not something
  you broke. Don't spend time trying to fix the whole lint setup unless that is exactly
  what your task asks for; if your task is unrelated, just note the limitation.
- No `.eslintrc`/`eslint.config.js` exists yet in `frontend/`.

### CI (GitHub Actions — what actually gates PRs)
- `.github/workflows/backend.yml` — triggers on changes under `src/**` or `pom.xml`;
  runs `mvn verify --batch-mode --no-transfer-progress` on Ubuntu with JDK 21
  (Temurin), `JWT_SECRET` env set, then publishes Surefire XML reports.
- `.github/workflows/frontend.yml` — triggers on changes under `frontend/**`; runs (in
  `frontend/`) `npm ci`, `npm run lint`, `npm run build -- --configuration production`,
  `npm run test -- --watch=false --browsers=ChromeHeadless` on Node 22. **Note**: CI
  does run lint, so if you touch anything under `frontend/`, be aware the lint step may
  already be failing/red in CI for reasons unrelated to your change (see gap above) —
  don't assume a red frontend CI run is caused by your PR without checking the actual
  failing step.
- There is no separate root-level lint/format workflow; these two workflows are the
  entire validation pipeline.

## Key files and configuration
- `pom.xml` — single Maven module, Spring Boot 4 parent, Java 21, MapStruct 1.6.3,
  Lombok 1.18.38, springdoc 2.8.8, jjwt 0.12.6, Testcontainers 1.21.1.
- `frontend/package.json` — Angular 22.0.x, PrimeNG 22, `@primeuix/themes`, Tailwind v4
  + `tailwindcss-primeui`, ngx-translate for i18n, Chart.js via `p-chart`.
- `frontend/angular.json` — build/test/lint target configuration (production budgets,
  ChromeHeadless karma config, `ng lint` builder wiring).
- `src/main/resources/application.yml` — datasource, JPA (`ddl-auto: validate`),
  Flyway, springdoc/swagger paths, JWT + CORS config, all overridable via env vars
  (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS` — see
  `.env.example`).
- `src/main/resources/application-test.yml` — test profile overrides.
- `src/main/resources/db/migration/` — Flyway SQL migrations (source of truth for
  schema; includes demo/seed data used by tests, e.g. `V2__seed_demo.sql`,
  `V4__seed_real_demo.sql` — do not hardcode the example household's data elsewhere).
- `docker-compose.yml` / `Dockerfile.backend` / `Dockerfile.frontend` — full stack via
  `docker compose up --build` (frontend :4200, backend :8080, Swagger UI at
  `/swagger-ui.html`).
- `dev.ps1` — one-shot local dev script (Postgres + backend + frontend).
- `docs/` — the reference specs (consolidated): `README.md` (vision, glossaire, règles
  d'or), `01-principes-et-moteur.md` (**engine reference + golden test vectors — highest
  priority for engine work**), `02-domaine-et-donnees.md` (entities, SQL schema,
  migrations), `03-architecture.md` (package-by-feature layout, security, Tailwind/PrimeNG
  layering), `04-api-et-frontend.md` (REST API + `ApiError` format + Angular screens).

---

## Contexte du projet
Réécriture d'un classeur Excel de **prévision budgétaire familiale** en application web
**Spring Boot 4 (Java 21) + Angular 22 + PrimeNG 22 + Tailwind CSS v4**, en **SaaS
multi-foyers**. Prévision uniquement (pas de réel, pas d'import bancaire). Lis, dans
l'ordre : `README.md`, puis `docs/README.md` et les docs `docs/01` → `docs/04`. Une tâche
= une PR, tests inclus.

## Règles d'or
1. **Le moteur de calcul se développe en test-first.** Écris d'abord les tests JUnit
   depuis les vecteurs golden (doc 01 §8-bis), puis implémente jusqu'au vert. Ces tests
   ne doivent **jamais** régresser.
2. **Fidélité à l'Excel** pour le cœur : lissage/périodique début-fin, fenêtres de
   validité, prorata, trésorerie chaînée — au **centime**. Les extensions (N membres,
   devises, patrimoine) ne doivent **pas** altérer ce comportement quand elles sont
   neutres (2 membres, devise unique).
3. **Multi-tenant strict** : toute donnée est scopée par `foyer` (ou `scenario` du
   foyer). Aucune requête ne doit exposer une entité d'un autre foyer. Ajoute un test de
   sécurité d'accès croisé pour chaque endpoint sensible.
4. **Calcul en `double` dans le moteur** (comme Excel), `BigDecimal` pour
   stockage/DTO ; **arrondir uniquement à l'affichage**. Modulo **euclidien**
   (`Math.floorMod`).
5. **Ne code pas en dur** les données du foyer d'exemple : elles vivent dans le seed
   Flyway et servent de base aux tests.

## Conventions backend (Java / Spring)
- Java 21, records pour les DTO et les objets de valeur du moteur (immuables).
- Package-by-feature (voir doc 03). Le module `moteur` **n'importe ni Spring, ni JPA,
  ni `java.time` lié à l'horloge** (dates passées en paramètre).
- `@Enumerated(EnumType.STRING)` pour les enums ; jamais d'ordinal en base.
- Persistance gérée par **Flyway** ; Hibernate en `ddl-auto=validate` (pas de génération
  auto du schéma).
- DTO ⇄ entités via **MapStruct** ; ne jamais exposer les entités JPA dans les
  contrôleurs.
- Validation d'entrée via **Bean Validation** ; erreurs renvoyées au format `ApiError`
  (doc 04) avec un **code métier** stable.
- Éviter le **N+1** : requêtes de chargement du scénario avec fetch joints.
- Tests : JUnit 5 + AssertJ ; intégration avec **Testcontainers** (PostgreSQL réel).
  Couverture module `moteur` > 90 %.

## Conventions frontend (Angular 22 / PrimeNG 22 / Tailwind v4)
- Angular **22**, **standalone components** + **signals** ; strict mode TS ; pas de
  NgModule.
- **Aucun texte en dur** dans les composants → clés i18n. Formatage montants/dates via
  `Intl` + locale + `deviseBase` (pipes dédiés).
- Composants **PrimeNG 22** (tables, dialogs, selects, inputnumber, datepicker,
  progressbar, chart, toast, confirmdialog). Thème par tokens (preset **Aura**,
  `@primeng/themes`, mode styled). Graphiques via `p-chart` (Chart.js).
- **Tailwind CSS v4** pour layout/espacement/responsive, **couplé à PrimeNG** via le
  plugin officiel `tailwindcss-primeui` + **CSS layers** (ordre `tailwind, primeng`, le
  layer `primeng` avant les utilitaires Tailwind) — voir doc 03 §7.1. **Ne pas** utiliser
  PrimeFlex (legacy). Éviter le préfixe `!` : régler la spécificité par les layers.
  Utiliser les couleurs de tokens (`bg-primary`, `text-surface-*`) ; sur un composant
  PrimeNG, passer les utilitaires via `styleClass`. Aligner `darkModeSelector` avec la
  variante `dark` de Tailwind.
- **Interdit** : `localStorage`/`sessionStorage` pour l'état applicatif métier ;
  privilégier les signals/état en mémoire (le token de refresh suit la stratégie de
  sécurité définie, pas d'astuce de contournement).
- Services HTTP typés ; interceptor JWT (ajout token + refresh transparent). Guards
  d'auth et de rôle. Masquer les actions d'écriture pour les `VIEWER`.
- Miroir des règles serveur côté UX : la répartition d'un poste/scénario doit sommer à
  100 % **avant** de pouvoir sauvegarder (feedback live).

## Ubiquitous language
Utilise les termes FR du [glossaire](../README.md#5-glossaire--langage-ubiquitaire)
(Foyer, Membre, Scénario, Poste, Catégorie, Compte, Actif, Répartition, Quote-part,
Contribution, Solde disponible, Trésorerie chaînée, Objectif). Cohérence entités ↔ API ↔
UI.

## Sécurité & config
- Secrets uniquement via variables d'environnement ; **jamais** committés. `.env.example`
  documente les clés (`DB_*`, `JWT_SECRET`, `CORS_ORIGINS`).
- Endpoints publics limités à `/api/auth/*`. Le reste exige un JWT valide + un
  `AccesFoyer`.
- Journalise toute tentative d'accès inter-foyers.

## Definition of Done (rappel)
Une tâche est terminée quand : code + tests verts en CI, moteur non régressé, lint OK,
multi-tenant respecté (test d'accès croisé), DTO ≠ entités, OpenAPI à jour, UI en clés
i18n, et **les vecteurs golden restent reproduits au centime**. Une tâche = une PR.

## Ce qu'il ne faut PAS faire
- Ne pas introduire de suivi du **réalisé**, d'import bancaire, ni de rapprochement (hors
  périmètre).
- Ne pas modifier la sémantique du moteur pour « simplifier » : elle doit rester
  identique à l'Excel.
- Ne pas contourner le scoping multi-tenant ni la validation de la somme des quotes-parts.
- Ne pas arrondir les étapes intermédiaires de calcul.
- Respecter les versions **imposées** (Spring Boot 4, Angular 22, PrimeNG 22, Tailwind
  v4) ; pour les autres dépendances, épingler la **dernière version stable** compatible à
  l'initialisation. Ne pas revenir à PrimeFlex ni à une version antérieure de ces socles.
