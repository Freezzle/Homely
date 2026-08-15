# Instructions Copilot — Budget Foyer

> Consignes **opérationnelles** pour l'agent LLM travaillant sur ce dépôt.
>
> **Référence métier et architecture : lire d'abord [`docs/README.md`](../docs/README.md)**
> — c'est la source de vérité (vision, règles d'or, glossaire, **guide de décision** pour
> toute nouvelle fonctionnalité/évolution) qui renvoie aux 4 docs `docs/01` → `docs/04`.
> En cas de doute sur le métier, la référence absolue est
> [`docs/01-principes-et-moteur.md`](../docs/01-principes-et-moteur.md) et ses vecteurs
> golden ; le fichier Excel d'origine tranche en dernier recours.
>
> Ce fichier ne contient **que** le savoir opérationnel propre à l'environnement
> (build/test/CI, pièges Windows, fichiers clés). Il **ne duplique pas** les règles métier
> ni les conventions de code : celles-ci vivent dans `/docs` et priment.
>
> **Trust these instructions first.** They were validated by running every command
> below in this exact environment. Only search the repo/docs further if something here
> is missing or turns out to be wrong for your specific change.

---

## Avant de coder une nouvelle fonctionnalité / évolution
Suivre le **Guide de décision** de [`docs/README.md`](../docs/README.md) :
1. Cadrer le périmètre (prévision uniquement — pas de réel/import bancaire).
2. Repérer le(s) doc(s) impacté(s) via la table « type de changement → doc ».
3. Appliquer les **Règles d'or** et les conventions du doc concerné.
4. Vérifier la **Definition of Done** avant de conclure.

Ne pas dupliquer ici les règles métier/conventions : les compléter/mettre à jour dans
`/docs`.

---

## Repository snapshot
- **What it is**: rewrite of a family budget-forecasting Excel workbook into a
  multi-tenant SaaS web app. Forecast only — no bank import, no "actuals" tracking.
- **Stack**: Spring Boot 4 / Java 21 backend (`src/main/java/ch/homely/...`, Maven
  single-module) + Angular 22 / PrimeNG 22 / Tailwind v4 frontend (`frontend/`,
  standalone Angular CLI app). PostgreSQL via Flyway migrations. Docker Compose for
  local infra.
- **Size**: small-to-medium monorepo — backend feature packages under
  `ch.homely.*` (`categorie`, `commun`, `compte`, `config`, `foyer`, `membre`, `moteur`,
  `objectif`, `poche`, `poste`, `projection`, `scenario`, `securite`, `taux`,
  `utilisateur`), each usually with a `dto` sub-package. Frontend features under
  `frontend/src/app/features/{argent-poche,auth,dashboard,foyer,objectifs,parametres,
  postes,referentiels,scenarios}`, plus `core`/`shared`/`shell`.
- `ch.homely.moteur` is the pure calculation engine (no Spring/JPA/clock-based
  `java.time` — dates are passed as parameters). Treat it as the most sensitive part of
  the codebase (see the "Règles d'or" in `docs/README.md`).

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
  postgres`). The `.\run-ng.ps1` helper wraps the Angular CLI for the frontend.
- No separate backend lint/format command exists in this repo — Maven `test`/`verify`
  is the only backend gate.
- Test classes live under `src/test/java/ch/homely/...` and use JUnit 5 + AssertJ;
  golden/business-rule vectors mainly live under `.../moteur`. Surefire only picks up
  `**/*Test.java` and `**/*Tests.java` (see `pom.xml`).
- Flyway migrations: `src/main/resources/db/migration/V1__init.sql` ...
  `V23__allocation_argent_poche.sql` (highest number as of this writing). Hibernate is
  `ddl-auto=validate` — **never** rely on Hibernate to create/alter schema; add a new
  `V{n}__description.sql` migration instead (next number after the highest existing one).

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
- `run-ng.ps1` — wrapper to run the Angular CLI (`ng`) for the frontend, avoiding the
  PowerShell execution-policy issue with `npx`/`ng.ps1`.
- `docs/` — the reference specs (consolidated): `README.md` (vision, glossaire, règles
  d'or), `01-principes-et-moteur.md` (**engine reference + golden test vectors — highest
  priority for engine work**), `02-domaine-et-donnees.md` (entities, SQL schema,
  migrations), `03-architecture.md` (package-by-feature layout, security, Tailwind/PrimeNG
  layering), `04-api-et-frontend.md` (REST API + `ApiError` format + Angular screens).

---

## Conventions & règles métier → voir `/docs`
Ce fichier ne réécrit pas les conventions : elles sont maintenues dans `/docs` et **font
foi**. Points d'entrée :

- **Règles d'or, glossaire ubiquitaire, guide de décision, Definition of Done, hors
  périmètre** → [`docs/README.md`](../docs/README.md).
- **Modèle financier & moteur** (test-first sur les vecteurs golden, calcul en `double` /
  stockage `BigDecimal`, arrondi à l'affichage, modulo euclidien) →
  [`docs/01-principes-et-moteur.md`](../docs/01-principes-et-moteur.md).
- **Domaine, entités, énumérations, schéma & migrations Flyway** →
  [`docs/02-domaine-et-donnees.md`](../docs/02-domaine-et-donnees.md).
- **Architecture, conventions backend, isolation du moteur, sécurité multi-tenant,
  devises, i18n, conventions frontend (Angular/PrimeNG/Tailwind), config & secrets** →
  [`docs/03-architecture.md`](../docs/03-architecture.md).
- **Contrats REST, `ApiError`, DTO ⇄ entités (MapStruct), écrans Angular** →
  [`docs/04-api-et-frontend.md`](../docs/04-api-et-frontend.md).

Rappels transverses non négociables (détaillés dans les docs ci-dessus) : moteur fidèle à
l'Excel **au centime** et non régressé, **multi-tenant strict** (test d'accès croisé par
endpoint sensible), **DTO ≠ entités JPA**, secrets uniquement via variables
d'environnement, UI **100 % en clés i18n**. Une tâche = une PR, tests inclus.
