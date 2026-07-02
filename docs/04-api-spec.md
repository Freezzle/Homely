# 04 — Spécification API REST

> Contrats REST : conventions, authentification, ressources, endpoints de projection,
> formes des DTO et modèle d'erreur. Documenter en OpenAPI (springdoc, Swagger UI sur
> `/swagger-ui.html`).

---

## 1. Conventions

- Base : `/api`. JSON en entrée/sortie, UTF-8. Dates **ISO-8601** (`YYYY-MM-DD` pour les
  dates métier, ISO instant pour les timestamps). Montants en **nombres bruts** (2
  décimales), devise portée à part.
- Ressources scopées par foyer : `/api/foyers/{foyerId}/…`. Sous-scoping par scénario :
  `/api/foyers/{foyerId}/scenarios/{scenarioId}/…`.
- Verbes : `GET` (liste/détail), `POST` (création), `PUT` (remplacement), `PATCH`
  (modification partielle), `DELETE`.
- Listes : pagination `?page=&size=&sort=champ,asc|desc`, réponse `{ content, page,
  size, totalElements, totalPages }`.
- Codes : 200/201/204 succès ; 400 (payload invalide), 401 (non authentifié), 403 (droit
  insuffisant), 404 (introuvable/hors périmètre), 409 (conflit, ex. 2ᵉ scénario de
  référence), 422 (règle métier, ex. somme quotes-parts ≠ 1).

## 2. Modèle d'erreur uniforme

```json
{
  "timestamp": "2026-07-02T10:15:30Z",
  "status": 422,
  "code": "REPARTITION_INVALIDE",
  "message": "La somme des quotes-parts doit valoir 1 (obtenu 0.95).",
  "champErreurs": [
    { "champ": "repartition", "message": "somme = 0.95" }
  ],
  "path": "/api/foyers/{id}/scenarios/{id}/postes"
}
```
Codes métier au moins : `REPARTITION_INVALIDE`, `SCENARIO_REFERENCE_UNIQUE`,
`SUPPORT_OBJECTIF_INVALIDE`, `MEMBRE_REFERENCE_SUPPRESSION`, `DEVISE_INCONNUE`,
`ACCES_FOYER_REFUSE`, `RESSOURCE_INTROUVABLE`.

## 3. Authentification

| Méthode | Endpoint | Corps → Réponse |
|---|---|---|
| POST | `/api/auth/register` | `{email, motDePasse, nomComplet}` → `201 {utilisateur}` |
| POST | `/api/auth/login` | `{email, motDePasse}` → `200 {accessToken, refreshToken, expiresIn, utilisateur}` |
| POST | `/api/auth/refresh` | `{refreshToken}` → `200 {accessToken, refreshToken, expiresIn}` |
| POST | `/api/auth/logout` | `{refreshToken}` → `204` (révoque le refresh) |
| GET | `/api/auth/moi` | → `200 {utilisateur, foyers:[{foyerId, nom, role}]}` |

Header pour les endpoints protégés : `Authorization: Bearer <accessToken>`.

## 4. Foyers & accès

| Méthode | Endpoint | Rôle | Description |
|---|---|---|---|
| GET | `/api/foyers` | auth | Foyers accessibles à l'utilisateur (+ son rôle) |
| POST | `/api/foyers` | auth | Créer un foyer (créateur = OWNER). Corps `{nom, deviseBase}` |
| GET | `/api/foyers/{foyerId}` | membre | Détail foyer |
| PUT | `/api/foyers/{foyerId}` | OWNER/EDITOR | Modifier (nom, deviseBase) |
| DELETE | `/api/foyers/{foyerId}` | OWNER | Supprimer le foyer |
| GET | `/api/foyers/{foyerId}/acces` | OWNER | Lister les accès |
| POST | `/api/foyers/{foyerId}/acces` | OWNER | Inviter `{email, role}` |
| PATCH | `/api/foyers/{foyerId}/acces/{accesId}` | OWNER | Changer le rôle |
| DELETE | `/api/foyers/{foyerId}/acces/{accesId}` | OWNER | Retirer un accès |

## 5. Référentiels (niveau foyer)

CRUD standard pour **Membres**, **Comptes**, **Catégories**, **Actifs**, **TauxChange**.
Motif d'URL : `/api/foyers/{foyerId}/{ressource}` (+ `/{id}` pour détail/modif/suppr).

- `GET /api/foyers/{foyerId}/membres` → `[{id, nom, couleur, ordre, actif}]`
- `GET /api/foyers/{foyerId}/comptes` → `[{id, libelle, type, soldeInitial, devise, ordre}]`
- `GET /api/foyers/{foyerId}/categories?typePoste=CHARGE` → filtrable par type
- `GET /api/foyers/{foyerId}/actifs` → `[{id, libelle, typeActif, soldeInitial, tauxCroissanceAnnuel}]`
- `GET /api/foyers/{foyerId}/taux-change` → `[{id, devise, tauxVersBase}]`

## 6. Scénarios

| Méthode | Endpoint | Description |
|---|---|---|
| GET | `/api/foyers/{foyerId}/scenarios` | Liste (dont `estReference`) |
| POST | `/api/foyers/{foyerId}/scenarios` | Créer `{nom, anneeDepart, tresorerieInitiale, horizonAnnees, repartitionDefaut:[{membreId, quotePart}]}` |
| GET | `/api/foyers/{foyerId}/scenarios/{scenarioId}` | Détail + hypothèses + répartition défaut |
| PUT | `/api/foyers/{foyerId}/scenarios/{scenarioId}` | Modifier hypothèses + répartition |
| DELETE | `/api/…/scenarios/{scenarioId}` | Supprimer (interdit si `estReference` et seul) |
| POST | `/api/…/scenarios/{scenarioId}:dupliquer` | **Duplication profonde** (copie postes, objectifs, répartitions) → `201 {scenario}` |
| POST | `/api/…/scenarios/{scenarioId}:definir-reference` | Marquer comme référence (retire le flag de l'ancien) |

Validation : `repartitionDefaut` doit sommer à 1 (sinon 422 `REPARTITION_INVALIDE`).

## 7. Postes (niveau scénario)

Scopés : `/api/foyers/{foyerId}/scenarios/{scenarioId}/postes`.

- `GET …/postes?type=CHARGE&page=&size=&sort=` → liste paginée.
- `POST …/postes` → création. Corps :
```json
{
  "type": "CHARGE",
  "description": "Assurance ménage",
  "categorieId": "…",
  "montant": 630.00,
  "devise": "CHF",
  "periodiciteMois": 12,
  "debut": "2026-01-01",
  "fin": null,
  "mode": "MENSUALISE",
  "moment": "DEBUT_PERIODE",
  "compteSource": null,
  "repartition": [ {"membreId":"…","quotePart":0.58}, {"membreId":"…","quotePart":0.42} ],
  "ventilationComptes": [ {"membreId":"…","compteId":"…"} ]
}
```
`repartition` **facultatif** (null → hérite du défaut scénario). Si présent, doit sommer
à 1.
- `GET …/postes/{id}` → détail (avec `montantMensualise` calculé).
- `PUT …/postes/{id}` / `PATCH …/postes/{id}` → modification.
- `DELETE …/postes/{id}` → suppression.
- `POST …/postes/{id}:dupliquer` → duplication d'un poste (confort de saisie).

## 8. Objectifs (niveau scénario)

`/api/foyers/{foyerId}/scenarios/{scenarioId}/objectifs` — CRUD.
Corps : `{libelle, categorieProjetId?, montantCible, echeance, compteId? , actifId?}`
(exactement un support). Réponse enrichie du calcul (doc 1 §10) :
```json
{
  "id":"…", "libelle":"Vacances 2027", "montantCible":8000, "echeance":"2027-06-30",
  "compteId":"…",
  "soldeCourant": 3200.00, "progressionPct": 40.0,
  "epargneMensuelleRequise": 480.00, "dateAtteintePrevue": "2027-05-01"
}
```

## 9. Projections (endpoints de calcul — ★)

Toutes en lecture (`GET`), scopées scénario. Le serveur applique le moteur (doc 1) et
peut servir depuis le cache.

### 9.1 Projection annuelle
`GET …/scenarios/{scenarioId}/projection/annuelle?annee=2026&perimetre=FOYER`
`perimetre` ∈ `FOYER` | `MEMBRE:{membreId}`. Réponse :
```json
{
  "annee": 2026, "perimetre": "FOYER", "devise": "CHF",
  "mois": [
    {"mois":1,"revenus":11000.00,"charges":5172.67,"reserves":410.00,"soldeDisponible":5417.33},
    … 12 lignes …
  ],
  "total": {"revenus":140350.00,"charges":62322.00,"reserves":8520.00,"soldeDisponible":69508.00}
}
```
Variante « toutes vues » pour le dashboard annuel :
`GET …/projection/annuelle-complete?annee=2026` → `{foyer:{…}, membres:[{membreId, …}]}`.

### 9.2 Projection pluriannuelle & trésorerie chaînée
`GET …/scenarios/{scenarioId}/projection/tresorerie` → toutes les années de l'horizon :
```json
{
  "anneeDepart":2026, "horizonAnnees":9, "tresorerieInitiale":0, "devise":"CHF",
  "annees":[
    {"annee":2026,"soldeAnnuel":69508.00,"tresorerieDebutAnnee":0.00,"tresorerieFinAnnee":69508.00},
    {"annee":2027,"soldeAnnuel":58968.00,"tresorerieDebutAnnee":69508.00,"tresorerieFinAnnee":128476.00},
    …
  ],
  "courbeMensuelle":[ {"annee":2026,"mois":1,"tresorerieCumulee": …}, … ]
}
```

### 9.3 Tableau de bord mensuel (ventilations)
`GET …/scenarios/{scenarioId}/projection/mensuelle?annee=2026&mois=6` :
```json
{
  "annee":2026, "mois":6, "devise":"CHF",
  "chargesParCategorie":[ {"categorieId":"…","libelle":"Logement","montant": …}, … ],
  "revenusParCategorie":[ … ],
  "reservesParCategorie":[ … ],
  "parCompte": [
    {"membreId":"…","type":"CHARGE","compteId":"…","libelle":"Compte courant","montant": …},
    …
  ],
  "totaux": {"revenus": …, "charges": …, "reserves": …, "soldeDisponible": …}
}
```

### 9.4 Patrimoine / net worth
`GET …/scenarios/{scenarioId}/projection/patrimoine?jusquAnnee=2034` :
```json
{
  "devise":"CHF",
  "points":[ {"annee":2026,"mois":1,"netWorth": …,
              "parCompte":[{"compteId":"…","solde": …}],
              "parActif":[{"actifId":"…","solde": …}]}, … ],
  "resume":{"netWorthInitial": …, "netWorthFinal": …}
}
```

### 9.5 Comparaison de scénarios (what-if)
`GET /api/foyers/{foyerId}/projection/comparaison?scenarioIds=A,B,C&metrique=TRESORERIE`
`metrique` ∈ `TRESORERIE` | `SOLDE_ANNUEL` | `NET_WORTH`. Réponse alignée par année pour
un graphe multi-séries :
```json
{
  "metrique":"TRESORERIE", "devise":"CHF",
  "series":[
    {"scenarioId":"A","nom":"Prévision principale","points":[{"annee":2026,"valeur":69508.00}, …]},
    {"scenarioId":"B","nom":"Loyer +200","points":[…]}
  ]
}
```

## 10. Notes d'implémentation

- Les endpoints de projection sont **idempotents** et **sans effet de bord** ;
  privilégier des DTO immuables (records).
- Renvoyer `devise` = `deviseBase` du foyer dans toutes les projections (montants déjà
  convertis).
- Prévoir un endpoint utilitaire `GET …/scenarios/{scenarioId}/postes/{id}/apercu?annee=`
  renvoyant la contribution mois par mois d'**un** poste (aide au débogage/UX « voir la
  répartition mensuelle de cette ligne »).
- Journaliser toute violation de scoping multi-tenant (tentative d'accès croisé).
