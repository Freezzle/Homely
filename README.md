# Homely — Budget Foyer

Application de **prévision budgétaire familiale** (SaaS multi-foyers) : **Spring Boot 4
(Java 21)** + **Angular 22** + **PrimeNG 22** + **Tailwind CSS v4** + **PostgreSQL**.

## Documentation

La référence métier et technique vit dans [`docs/`](docs/README.md) :

- [`docs/README.md`](docs/README.md) — vision, périmètre, glossaire, règles d'or
- [`docs/01-principes-et-moteur.md`](docs/01-principes-et-moteur.md) — principes financiers + moteur de calcul (vecteurs golden)
- [`docs/02-domaine-et-donnees.md`](docs/02-domaine-et-donnees.md) — entités, schéma, migrations
- [`docs/03-architecture.md`](docs/03-architecture.md) — architecture, sécurité, i18n
- [`docs/04-api-et-frontend.md`](docs/04-api-et-frontend.md) — API REST + écrans Angular

## Prérequis

Java 21 · Maven 3.9+ · Node.js 22+ · Docker + Docker Compose.

## Exécution en développement

```powershell
Set-Location "E:\Applications\Homely"
docker compose up -d postgres     # base de données
mvn spring-boot:run               # backend  (http://localhost:8080)
```

```powershell
Set-Location "E:\Applications\Homely\frontend"
npm install
npm start                         # frontend (http://localhost:4200)
```

> `run-ng.ps1` est un wrapper du CLI Angular (`ng serve` par défaut, installe les
> dépendances npm si `node_modules` est absent).

### Stack complète via Docker Compose

```powershell
docker compose up --build
```

Services : frontend `:4200` · backend `:8080` · Swagger UI `:8080/swagger-ui.html`.

## Build production

```powershell
mvn clean package -DskipTests                 # backend  (depuis la racine)
Set-Location frontend ; npm run build:prod    # frontend
```

## Tests

```powershell
mvn test                                       # backend (Testcontainers → Docker requis)
Set-Location frontend ; npm run build ; npm test
```

## Variables d'environnement

Base dans `.env.example` : `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`,
`CORS_ORIGINS`. Créez votre fichier local :

```powershell
Copy-Item .env.example .env
```

Secrets **uniquement** via variables d'environnement — jamais committés.
