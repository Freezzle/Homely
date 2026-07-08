# OpenAPI publié

Ce dossier contient les snapshots publiés du contrat OpenAPI.

## Fichiers attendus

- `openapi.json` (obligatoire)
- `openapi.yaml` (optionnel)

## Procédure de mise à jour

1. Démarrer le backend (`http://localhost:8080`).
2. Exporter le JSON:

```powershell
Set-Location "E:\Applications\Homely"
New-Item -ItemType Directory -Force "docs\openapi" | Out-Null
Invoke-WebRequest "http://localhost:8080/v3/api-docs" -OutFile "docs\openapi\openapi.json"
```

3. (Optionnel) Générer YAML:

```powershell
Set-Location "E:\Applications\Homely"
npx @redocly/cli bundle docs/openapi/openapi.json -o docs/openapi/openapi.yaml
```

4. Commiter les fichiers modifiés de `docs/openapi/`.

## Vérification rapide

- Swagger UI: `http://localhost:8080/swagger-ui.html`
- Endpoint brut: `http://localhost:8080/v3/api-docs`

