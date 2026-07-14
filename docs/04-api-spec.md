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
`ACCES_FOYER_REFUSE`, `RESSOURCE_INTROUVABLE`, `FOYER_MEMBRES_INVALIDES`,
`COMPTE_SANS_MEMBRE` (création/modification d'un compte sans membre actif → 422),
`VENTILATION_COMPTE_NON_RATTACHE` (un membre tente de ventiler vers un compte qui ne lui est pas rattaché → 422).

## 3. Authentification

| Méthode | Endpoint | Corps → Réponse |
|---|---|---|
| POST | `/api/auth/register` | `{email, motDePasse, nomComplet}` → `201 {utilisateur}` |
| POST | `/api/auth/login` | `{email, motDePasse}` → `200 {accessToken, refreshToken, expiresIn, utilisateur}` |
| POST | `/api/auth/refresh` | `{refreshToken}` → `200 {accessToken, refreshToken, expiresIn}` |
| POST | `/api/auth/logout` | `{refreshToken}` → `204` (révoque le refresh token) |
| GET | `/api/auth/moi` | → `200 {utilisateur, foyers:[{foyerId, nom, role}]}` |

Header pour les endpoints protégés : `Authorization: Bearer <accessToken>`.

## 4. Foyers & accès

| Méthode | Endpoint | Rôle | Description |
|---|---|---|---|
| GET | `/api/foyers` | auth | Foyers accessibles à l'utilisateur (+ son rôle) |
| POST | `/api/foyers` | auth | Créer un foyer (créateur = OWNER). Voir corps ci-dessous. |
| GET | `/api/foyers/{foyerId}` | membre | Détail foyer |
| PUT | `/api/foyers/{foyerId}` | OWNER/EDITOR | Modifier (nom, deviseBase) |
| DELETE | `/api/foyers/{foyerId}` | OWNER | Supprimer le foyer |
| GET | `/api/foyers/{foyerId}/acces` | OWNER | Lister les accès |
| POST | `/api/foyers/{foyerId}/acces` | OWNER | Inviter `{email, role}` |
| PATCH | `/api/foyers/{foyerId}/acces/{accesId}` | OWNER | Changer le rôle |
| DELETE | `/api/foyers/{foyerId}/acces/{accesId}` | OWNER | Retirer un accès |

### 4.1 Création de foyer — payload & effets de bord

**Corps `POST /api/foyers` :**
```json
{
  "nom": "Famille Dupont",
  "deviseBase": "CHF",
  "membres": [
    { "nom": "Alice", "couleur": "#6366F1" },
    { "nom": "Bob",   "couleur": "#10B981" }
  ]
}
```

- `membres` : **obligatoire, minimum 1 entrée** (sinon `422 FOYER_MEMBRES_INVALIDES`).
- `couleur` : format hexadécimal `#RRGGBB` ; si absent, défaut `#6366F1`.

**Effets de bord automatiques lors de la création :**

1. L'utilisateur courant devient `OWNER` du foyer.
2. Les membres listés sont créés dans le foyer (ordre = position dans la liste).
3. Un **scénario de référence initial** est créé automatiquement avec :
   - `nom` = `"Scénario de base"`
   - `estReference` = `true`
   - `anneeDepart` = année courante (ex. `2026`)
   - `tresorerieInitiale` = `0.00`
   - `horizonAnnees` = **`9`**
   - Une `RepartitionPeriode` ouverte avec des quotes-parts équilibrées entre les membres
     initiaux, arrondies à **2 décimales** (la somme vaut exactement `1.00`).

Exemple pour 3 membres : `0.34 / 0.33 / 0.33`.

**Réponse `201` :** `FoyerDto { id, nom, deviseBase, monRole }`. Les membres et le scénario
sont accessibles via les endpoints référentiels et scénarios classiques.

## 5. Référentiels (niveau foyer)

CRUD standard pour **Membres**, **Comptes**, **Catégories**, **Actifs**, **TauxChange**.
Motif d'URL : `/api/foyers/{foyerId}/{ressource}` (+ `/{id}` pour détail/modif/suppr).

- `GET /api/foyers/{foyerId}/membres` → `[{id, nom, couleur, ordre, actif}]`
- `GET /api/foyers/{foyerId}/comptes` → `[{id, libelle, soldeInitial, devise, ordre, actif, membreIds:[uuid]}]`
- `POST /api/foyers/{foyerId}/comptes` → corps : `{libelle, soldeInitial, devise?, ordre, membreIds:[uuid]}` — **au moins un membreId actif requis** ; sinon 422 `COMPTE_SANS_MEMBRE`
- `PUT /api/foyers/{foyerId}/comptes/{id}` → même corps ; les membres inactifs déjà rattachés sont **conservés** côté serveur indépendamment du payload
- `GET /api/foyers/{foyerId}/categories?typePoste=CHARGE` → filtrable par type
- `GET /api/foyers/{foyerId}/actifs` → `[{id, libelle, typeActif, soldeInitial, devise, tauxCroissanceAnnuel, ordre, actif}]`
  - `typeActif` ∈ `COMPTE_EPARGNE | TROISIEME_PILIER | INVESTISSEMENT | CRYPTO | IMMOBILIER | VEHICULE | AUTRE`
- `GET /api/foyers/{foyerId}/taux-change` → `[{id, devise, tauxVersBase}]`

## 6. Scénarios

### 6.0 Initialisation automatique

À la **création d'un foyer**, le backend crée automatiquement un **scénario de référence**
nommé `"Scénario de base"` (voir §4.1). Ce scénario est immédiatement utilisable ; ses
hypothèses peuvent être modifiées via `PUT /api/foyers/{foyerId}/scenarios/{scenarioId}`.

### 6.1 Endpoints

| Méthode | Endpoint | Description |
|---|---|---|
| GET | `/api/foyers/{foyerId}/scenarios` | Liste (dont `estReference`) |
| POST | `/api/foyers/{foyerId}/scenarios` | Créer `{nom, anneeDepart, tresorerieInitiale, horizonAnnees, repartitions:[{membreId, quotePart}]}` |
| GET | `/api/foyers/{foyerId}/scenarios/{scenarioId}` | Détail + hypothèses + périodes de répartition |
| PUT | `/api/foyers/{foyerId}/scenarios/{scenarioId}` | Modifier hypothèses + répartition par défaut |
| DELETE | `/api/…/scenarios/{scenarioId}` | Supprimer (interdit si `estReference` et seul) |
| POST | `/api/…/scenarios/{scenarioId}:dupliquer` | **Duplication profonde** (copie postes, objectifs, périodes de répartition) → `201 {scenario}` |
| POST | `/api/…/scenarios/{scenarioId}:definir-reference` | Marquer comme référence (retire le flag de l'ancien) |

Validation : `repartitions` (dans `PUT`) doit sommer à 1 (sinon 422 `REPARTITION_INVALIDE`).

### 6.2 Périodes de répartition (prorata temporel)

Permettent de faire varier les quotes-parts au fil du temps (ex. : congé parental, entrée
progressive dans les finances communes). Chaque période a une fenêtre `debut` / `fin`
(null = ouverte). La période active pour un mois donné est celle dont la fenêtre inclut ce
mois.

| Méthode | Endpoint | Description |
|---|---|---|
| GET | `/api/foyers/{foyerId}/scenarios/{scenarioId}/repartition-periodes` | Liste des périodes du scénario |
| POST | `/api/foyers/{foyerId}/scenarios/{scenarioId}/repartition-periodes` | Créer une période |
| PUT | `/api/…/repartition-periodes/{periodeId}` | Modifier une période |
| DELETE | `/api/…/repartition-periodes/{periodeId}` | Supprimer une période |

Corps `POST`/`PUT` :
```json
{
  "debut": "2026-01-01",
  "fin": null,
  "parts": [
    { "membreId": "…", "quotePart": 0.58 },
    { "membreId": "…", "quotePart": 0.42 }
  ]
}
```
Validation : `parts` doit sommer à 1 (sinon 422 `REPARTITION_INVALIDE`).

Réponse :
```json
{
  "id": "…", "debut": "2026-01-01", "fin": null,
  "parts": [
    { "membreId": "…", "nomMembre": "Dylan", "couleurMembre": "#6366f1", "quotePart": 0.58, "ordre": 0 },
    { "membreId": "…", "nomMembre": "Mélanie", "couleurMembre": "#10b981", "quotePart": 0.42, "ordre": 1 }
  ]
}
```

## 7. Postes (niveau scénario)

Scopés : `/api/foyers/{foyerId}/scenarios/{scenarioId}/postes`.

- `GET …/postes?type=CHARGE&page=&size=&sort=` → liste paginée avec `montantMensualise` calculé.
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
  "nature": "EFFECTIF",
  "typeRepartition": "AUTO",
  "ordre": 0,
  "repartitions": null,
  "ventilations": [ {"membreId":"…","compteId":"…"} ]
}
```

**Règles sur `periodiciteMois`** :
- `>= 1` : récurrent (mensuel si 1, trimestriel si 3, annuel si 12, etc.).
- `= 0` : **one-shot ponctuel** — le montant est imputé en totalité au mois de `debut`.
  `fin` est ignorée ; `mode` et `moment` sont sans effet.

**Règles sur `typeRepartition`** :
- `AUTO` (défaut) : quotes-parts issues de la `RepartitionPeriode` active du scénario.
  `repartitions` doit être `null` ou absent.
- `REVERSE_AUTO` : chaque membre reçoit `(1 − part_auto) / (N − 1)`.
  `repartitions` doit être `null` ou absent.
- `CUSTOM` : quotes-parts fixes. `repartitions` **obligatoire** et doit sommer à 1
  (sinon 422 `REPARTITION_INVALIDE`). Chaque `ventilation.compteId` doit appartenir à
  un compte rattaché au membre (via `compte_membre`) ; sinon 422
  `VENTILATION_COMPTE_NON_RATTACHE`.

- `GET …/postes/{id}` → détail (avec `montantMensualise` calculé).
- `PUT …/postes/{id}` / `PATCH …/postes/{id}` → modification (mêmes règles que POST).
- `DELETE …/postes/{id}` → suppression.
- `POST …/postes/{id}:dupliquer` → duplication d'un poste (confort de saisie).

### 7.1 Aperçu mensuel d'un poste

`GET …/postes/{id}/apercu?annee=2026`

Renvoie la contribution du poste mois par mois sur l'année demandée (utile pour
comprendre le lissage mensualisé vs le périodique) :

```json
{
  "annee": 2026,
  "contributions": [
    { "mois": 1,  "contribution": 52.50 },
    { "mois": 2,  "contribution": 52.50 },
    { "mois": 3,  "contribution": 52.50 },
    …
    { "mois": 12, "contribution": 52.50 }
  ]
}
```

## 8. Objectifs (niveau scénario)

`/api/foyers/{foyerId}/scenarios/{scenarioId}/objectifs` — CRUD.
Corps : `{libelle, categorieProjetId?, montantCible, echeance?, compteId?, actifId?}`
(exactement un support). Réponse enrichie du calcul (doc 1 §10) :

```json
{
  "id": "…", "libelle": "Vacances 2027", "montantCible": 8000, "echeance": "2027-06-30",
  "compteId": "…", "actifId": null,
  "soldeActuel": 3200.00,
  "progression": 0.40,
  "epargneRequise": 480.00
}
```

Champs calculés :
- `soldeActuel` : solde courant du compte ou de l'actif lié.
- `progression` : `soldeActuel / montantCible` ∈ [0, 1].
- `epargneRequise` : épargne mensuelle nécessaire pour atteindre `montantCible` avant
  `echeance` (0 si déjà atteint ou si `echeance` est null).

## 9. Projections (endpoints de calcul — ★)

Toutes en lecture (`GET`), scopées scénario. Le serveur applique le moteur (doc 1) et
peut servir depuis le cache.

### 9.1 Projection annuelle
`GET …/scenarios/{scenarioId}/projection/annuelle?annee=2026`. Réponse :
```json
{
  "annee": 2026,
  "mois": [
    {"numero":1,"agregat":{"revenus":11000.00,"charges":5172.67,"reserves":410.00,"soldeDisponible":5417.33}},
    "… 12 lignes …"
  ],
  "moisReel": [
    {"numero":1,"agregat":{"revenus":11000.00,"charges":4980.00,"reserves":0.00,"soldeDisponible":6020.00}},
    "… 12 lignes …"
  ],
  "totalAnnuel": {"revenus":140350.00,"charges":62322.00,"reserves":8520.00,"soldeDisponible":69508.00},
  "parMembre": {
    "{membreId}": {"revenus":0,"charges":0,"reserves":0,"soldeDisponible":0}
  },
  "moisParMembre": {
    "{membreId}": [
      {"revenus":0,"charges":0,"reserves":0,"soldeDisponible":0}
    ]
  },
  "moisParMembreReel": {
    "{membreId}": [
      {"revenus":0,"charges":0,"reserves":0,"soldeDisponible":0}
    ]
  }
}
```

`moisReel` et `moisParMembreReel` représentent les flux du mois en cours calendaire
(charges/revenus effectivement tombés), utiles pour la comparaison prévision vs réalisé.

### 9.2 Projection pluriannuelle & trésorerie chaînée
`GET …/scenarios/{scenarioId}/projection/tresorerie`

Renvoie la trésorerie cumulée sur toutes les années de l'horizon :
```json
{
  "annees": [
    {
      "annee": 2026,
      "soldeAnnuel": 69508.00,
      "tresorerieDebutAnnee": 0.00,
      "tresorerieFinAnnee": 69508.00
    },
    {
      "annee": 2027,
      "soldeAnnuel": 58968.00,
      "tresorerieDebutAnnee": 69508.00,
      "tresorerieFinAnnee": 128476.00
    }
  ],
  "courbe": [
    { "annee": 2026, "mois": 1, "tresorerie": 5417.33 },
    { "annee": 2026, "mois": 2, "tresorerie": 11234.66 },
    "…"
  ]
}
```

### 9.3 Tableau de bord mensuel (ventilations)
`GET …/scenarios/{scenarioId}/projection/mensuelle?annee=2026&mois=6` :
```json
{
  "annee": 2026,
  "mois": 6,
  "agregat": {"revenus": 0, "charges": 0, "reserves": 0, "soldeDisponible": 0},
  "parMembre": {
    "{membreId}": {"revenus": 0, "charges": 0, "reserves": 0, "soldeDisponible": 0}
  },
  "parCategorie": {
    "{categorieId}": 1234.56
  },
  "parCategorieMembre": {
    "{categorieId}": {
      "{membreId}": 567.89
    }
  },
  "parCompteMembre": {
    "{compteId}": {
      "{membreId}": 123.45
    }
  }
}
```

`parCategorieMembre` permet de décomposer chaque catégorie par membre (vue croisée).
`parCompteMembre` permet d'afficher les charges par compte et par membre (graphique
horizontal dans le dashboard mensuel).

### 9.4 Patrimoine / net worth
`GET …/scenarios/{scenarioId}/projection/patrimoine` :
```json
{
  "annees": [
    {
      "annee": 2026,
      "patrimoineNet": 145000.00,
      "soldesComptes": {
        "{compteId}": 12500.00,
        "{compteId}": 8000.00
      },
      "soldesActifs": {
        "{actifId}": 95000.00,
        "{actifId}": 29500.00
      }
    },
    "…"
  ]
}
```

`patrimoineNet` = somme des `soldesComptes` + somme des `soldesActifs`. Les actifs sont
projetés en appliquant `tauxCroissanceAnnuel` capitalisé année par année.

### 9.5 Comparaison de scénarios (what-if)
`GET /api/foyers/{foyerId}/projection/comparaison?scenarioIds=A,B,C`
Réponse alignée par année pour un graphe multi-séries :
```json
{
  "scenarioIds": ["A","B","C"],
  "nomScenarios": ["Prévision principale","Loyer +200","Prime annuelle"],
  "series": [
    {
      "annee": 2026,
      "soldeParScenario":      {"A":69508.00,"B":67108.00,"C":72008.00},
      "tresorerieParScenario": {"A":69508.00,"B":67108.00,"C":72008.00}
    }
  ]
}
```

## 10. Notes d'implémentation

- Les endpoints de projection sont **idempotents** et **sans effet de bord** ;
  privilégier des DTO immuables (records).
- Renvoyer `devise` = `deviseBase` du foyer dans toutes les projections (montants déjà
  convertis).
- Journaliser toute violation de scoping multi-tenant (tentative d'accès croisé).
- L'endpoint `apercu` (§7.1) peut être mis en cache côté serveur ; il est particulièrement
  utile côté UX pour expliquer le lissage mensualisé d'un poste trimestriel/annuel.
