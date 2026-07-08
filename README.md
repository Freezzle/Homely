# Homely — Budget Foyer

Application de prévision budgétaire familiale (SaaS multi-foyers) construite avec
**Spring Boot 4 (Java 21)** + **Angular 22** + **PrimeNG** + **Tailwind CSS v4**.

## Documentation

- Vision, métier et architecture: `docs/README.md`
- Synthèse globale: `docs/00-synthese.md`
- API détaillée: `docs/04-api-spec.md`

## Prérequis

- Java 21
- Maven 3.9+
- Docker + Docker Compose
- Node.js 22+ (ou configuration locale équivalente)

## Exécution en développement

### Option 1 — script intégré (Windows PowerShell)

```powershell
Set-Location "E:\Applications\Homely"
.\dev.ps1
```

Le script démarre PostgreSQL (Docker), le backend (`:8080`) et le frontend (`:4200`).

### Option 2 — manuel

1) Démarrer PostgreSQL:

```powershell
Set-Location "E:\Applications\Homely"
docker compose up -d postgres
```

2) Démarrer le backend:

```powershell
Set-Location "E:\Applications\Homely"
mvn spring-boot:run
```

3) Démarrer le frontend:

```powershell
Set-Location "E:\Applications\Homely\frontend"
npm install
npm start
```

## Exécution via Docker Compose (stack complète)

```powershell
Set-Location "E:\Applications\Homely"
docker compose up --build
```

Services exposés:

- Frontend: `http://localhost:4200`
- Backend API: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger-ui.html`

## Build production

### Backend

```powershell
Set-Location "E:\Applications\Homely"
mvn clean package -DskipTests
```

### Frontend

```powershell
Set-Location "E:\Applications\Homely\frontend"
npm run build:prod
```

## Tests

### Backend (complet)

```powershell
Set-Location "E:\Applications\Homely"
mvn test
```

### Frontend (build + tests unitaires)

```powershell
Set-Location "E:\Applications\Homely\frontend"
npm run build
npm test
```

## Variables d'environnement

Exemple de base dans `.env.example`:

- `DB_URL`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `CORS_ORIGINS`

Créez votre fichier local:

```powershell
Set-Location "E:\Applications\Homely"
Copy-Item .env.example .env
```

## OpenAPI — publication

Swagger UI est disponible sur `http://localhost:8080/swagger-ui.html`.

Pour publier une version figée de l'API dans le dépôt:

```powershell
Set-Location "E:\Applications\Homely"
New-Item -ItemType Directory -Force "docs\openapi" | Out-Null
Invoke-WebRequest "http://localhost:8080/v3/api-docs" -OutFile "docs\openapi\openapi.json"
```

Conversion YAML (optionnelle):

```powershell
Set-Location "E:\Applications\Homely"
npx @redocly/cli bundle docs/openapi/openapi.json -o docs/openapi/openapi.yaml
```

Ensuite, versionnez `docs/openapi/openapi.json` (et éventuellement `.yaml`) avec votre PR.

