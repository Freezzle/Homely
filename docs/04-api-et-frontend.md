# 04 — API REST & Frontend

> Contrats REST (conventions, auth, endpoints réels, `ApiError`) et écrans Angular
> associés. L'API est documentée en OpenAPI (Swagger UI sur `/swagger-ui.html`).

> **Décisions gouvernées par ce doc** : conception d'un endpoint REST, format `ApiError`, contrats DTO, et routes/écrans/composants Angular associés.

---

## PARTIE A — API REST

## 1. Conventions

- Base `/api`, JSON UTF-8. Dates **ISO-8601** (`YYYY-MM-DD` métier, ISO instant système).
  Montants en **nombres bruts** (2 décimales), devise portée à part.
- Ressources scopées par foyer : `/api/foyers/{foyerId}/…` ; sous-scoping par scénario :
  `/api/foyers/{foyerId}/scenarios/{scenarioId}/…`.
- Verbes : `GET` (liste/détail), `POST` (création), `PUT` (remplacement), `PATCH`
  (partiel), `DELETE`. Les listes renvoient un **tableau JSON brut** (pas de pagination).
- Codes : 200/201/204 ; 400 (payload invalide), 401 (non authentifié), 403 (droit
  insuffisant), 404 (introuvable/hors périmètre), 409 (conflit), 422 (règle métier).

## 2. Modèle d'erreur uniforme (`ApiError`)
```json
{
  "timestamp": "2026-07-02T10:15:30Z",
  "status": 422,
  "code": "REPARTITION_INVALIDE",
  "message": "La somme des quotes-parts doit valoir 1 (obtenu 0.95).",
  "champErreurs": [{ "champ": "repartition", "message": "somme = 0.95" }],
  "path": "/api/foyers/{id}/scenarios/{id}/postes"
}
```
Codes métier (min.) : `REPARTITION_INVALIDE`, `SCENARIO_REFERENCE_UNIQUE`,
`MEMBRE_REFERENCE_SUPPRESSION`, `DEVISE_INCONNUE`, `ACCES_FOYER_REFUSE`,
`RESSOURCE_INTROUVABLE`, `FOYER_MEMBRES_INVALIDES`, `COMPTE_SANS_MEMBRE`,
`VENTILATION_COMPTE_NON_RATTACHE`, `ESTIMATION_POURCENTAGE_REQUIS`.

## 3. Authentification

| Méthode | Endpoint | Corps → Réponse |
|---|---|---|
| POST | `/api/auth/register` | `{email, motDePasse, nomComplet}` → `201 {utilisateur}` |
| POST | `/api/auth/login` | `{email, motDePasse}` → `200 {accessToken, refreshToken, expiresIn, utilisateur}` |
| POST | `/api/auth/refresh` | `{refreshToken}` → `200 {accessToken, refreshToken, expiresIn}` |
| POST | `/api/auth/logout` | `{refreshToken}` → `204` |
| GET | `/api/auth/moi` | → `200 {utilisateur, foyers:[{foyerId, nom, role}]}` |

Endpoints protégés : header `Authorization: Bearer <accessToken>`.

## 4. Foyers & accès

| Méthode | Endpoint | Rôle |
|---|---|---|
| GET / POST | `/api/foyers` | auth (POST : créateur = OWNER) |
| GET / PUT / DELETE | `/api/foyers/{foyerId}` | membre / OWNER-EDITOR / OWNER |
| GET / POST | `/api/foyers/{foyerId}/acces` | OWNER (POST : inviter `{email, role}`) |
| PATCH / DELETE | `/api/foyers/{foyerId}/acces/{accesId}` | OWNER (changer rôle / retirer) |

**`POST /api/foyers`** — corps `{nom, deviseBase, membres:[{nom, couleur?}]}` (`membres`
obligatoire, min. 1 → sinon `422 FOYER_MEMBRES_INVALIDES` ; couleur défaut `#6366F1`).
**Effets de bord** (même transaction) : OWNER pour l'utilisateur courant + membres créés +
**scénario de référence** « Scénario de base » (année courante, tréso 0, horizon 9,
`RepartitionPeriode` ouverte équilibrée à 2 décimales, somme 1.00). Réponse `201
FoyerDto`.

## 5. Référentiels (niveau foyer)

CRUD standard `/api/foyers/{foyerId}/{ressource}` (+ `/{id}`) pour **membres**, **comptes**,
**categories**, **taux-change**.
- `comptes` : corps `{libelle, soldeInitial, devise?, membreIds:[uuid]}` — **au moins un
  membreId actif** (sinon `422 COMPTE_SANS_MEMBRE`) ; à l'édition, les membres inactifs
  déjà rattachés sont conservés côté serveur.
- `categories?typePoste=CHARGE` : filtrable par type.

## 6. Scénarios

| Méthode | Endpoint | Description |
|---|---|---|
| GET / POST | `/api/foyers/{foyerId}/scenarios` | Liste / créer `{nom, anneeDepart, tresorerieInitiale, horizonAnnees, repartitions:[{membreId, quotePart}]}` |
| GET / PUT / DELETE | `…/scenarios/{scenarioId}` | Détail / modifier / supprimer (interdit si référence unique) |
| POST | `…/scenarios/{scenarioId}:dupliquer` | Duplication profonde (postes, périodes) |
| POST | `…/scenarios/{scenarioId}:definir-reference` | Marquer référence (retire l'ancien flag) |

Validation : `repartitions` (PUT) doit sommer à 1 (`422 REPARTITION_INVALIDE`).

**Périodes de répartition** (chemin réel `…/periodes`, pas `…/repartition-periodes`) :
CRUD `GET/POST/PUT/DELETE …/scenarios/{scenarioId}/periodes`. Corps `{debut, fin,
parts:[{membreId, quotePart}]}` ; `parts` somme à 1. Réponse enrichie du nom/couleur des
membres.

## 7. Postes (niveau scénario)

`…/scenarios/{scenarioId}/postes` — CRUD (`GET …?type=CHARGE`, avec `montantMensualise`
calculé). Corps principal : `{type, description, categorieId, montant, devise?,
periodiciteMois, debut, fin, mode, moment, nature, estimPourcentage?, typeRepartition,
repartitions?, ventilations:[{membreId, compteId}]}`.

Règles clés :
- `estimPourcentage` : obligatoire (>0) si `nature=ESTIMATION` (`422
  ESTIMATION_POURCENTAGE_REQUIS`), nul si `EFFECTIF` ; ∈ [0, 100] ; **descriptif** (pas
  d'impact moteur).
- `periodiciteMois` : `0` = one-shot (imputé au mois de `debut`, `mode`/`moment`/`fin`
  ignorés).
- `typeRepartition` : `CUSTOM` → `repartitions` obligatoire, somme 1 (`422
  REPARTITION_INVALIDE`) ; chaque `ventilation.compteId` doit être rattaché au membre
  (`422 VENTILATION_COMPTE_NON_RATTACHE`).

**Cycle de vie** (pas de modification silencieuse du montant historique) :
| Endpoint | Effet |
|---|---|
| `POST …/postes/{id}/reviser-montant` | Nouveau poste chaîné (`posteOrigineId`), clôture l'origine à la veille |
| `POST …/postes/{id}/annuler-revision` | Supprime le successeur, rouvre l'origine |
| `POST …/postes/{id}/decaler-date-effet` | Modifie `debut`/`fin` sans nouvelle version |
| `POST …/postes/{id}/cloturer` \| `/reactiver` | Ferme / rouvre la fenêtre (`fin`) |

`GET …/postes/{id}/apercu?annee=2026` → contribution mois par mois (`{annee,
contributions:[{mois, contribution}]}`).

## 8. Projections (endpoints de calcul ★)

Toutes en `GET`, scopées scénario, servies via le moteur (doc 01) + cache.

- **`…/projection/annuelle?annee=`** → `{annee, mois[], moisReel[], totalAnnuel, parMembre,
  moisParMembre, moisParMembreReel}`. Chaque agrégat = `{revenus, charges, reserves,
  soldeDisponible}`. `mois` = mensualisé, `moisReel` = flux non lissés.
- **`…/projection/tresorerie`** → `{annees:[{annee, soldeAnnuel, tresorerieDebutAnnee,
  tresorerieFinAnnee}], courbe:[{annee, mois, tresorerie}]}` — trésorerie **chaînée** entre
  années (doc 01 §4).
- **`…/projection/tresorerie-cumulee?annee=&membreId=`** → `{annee, mensualise:[12],
  reel:[12]}` — courbe cumulée d'une seule année, scopée foyer ou membre (`membreId`
  optionnel), amorcée à la trésorerie initiale du scénario (prorata de la quote-part de la
  période ouverte en vue membre). Repart de la trésorerie initiale à chaque année
  (**non chaînée** entre années, contrairement à `…/tresorerie` — remplace un calcul
  auparavant dupliqué côté frontend, désormais seul le backend le porte).
- **`…/projection/mensuelle?annee=&mois=`** → agrégat + `parMembre` + `parCategorie` +
  `parCategorieMembre` + `parCompteMembre`.
- **`…/projection/ventilation-annuelle?annee=`** → même forme que `mensuelle` (sans `mois`),
  somme des 12 mois en une requête (optimisation dashboard annuel).
- **`…/projection/taux-effort?annee=&mois=`** / **`…/taux-effort-annuel?annee=`** → une
  entrée par membre : `revenusTotal`, `chargesTotal`/`reservesTotal` (+ `…PireCas` pour les
  ESTIMATION à variation max), `argentPocheTotal`/`argentPocheTotalPireCas` (doc 01 §7 —
  argent de poche, **pas un poste**). Le % et la zone sont calculés côté frontend à partir
  des seuils exposés par `/api/dashboard/seuils` (§11).
- **`…/projection/evenements?annee=&membreId=`** → liste triée (mois ↑, puis FIN > REVISION
  > DEBUT, puis description) : `{mois, type, posteId, description, categorieId, typePoste,
  nature, montant, periodiciteMois, mode, montantOrigine?, periodiciteMoisOrigine?,
  modeOrigine?, quotePart}`. `montant`/`montantOrigine` **bruts** signés ; champs `…Origine`
  non-null seulement pour `REVISION` ; `quotePart` = 1 en vue foyer, proratisé si
  `membreId` (jamais recalculé côté frontend). Sémantique : doc 01 §9.

## 9. Argent de poche (niveau scénario)

CRUD `…/politiques-argent-poche` (récurrentes) et `…/allocations-argent-poche`
(ponctuelles). `GET …/rav-brut?annee=` alimente l'aperçu « 6 prochains mois ». Formule et
priorité (`allocation > politique > 0`) : [doc 01 §7](01-principes-et-moteur.md#7-argent-de-poche--impact-sur-le-solde-disponible).
Actions d'écriture masquées pour `VIEWER` (backend refuse aussi toute écriture hors
OWNER/EDITOR).

## 10. Configuration dashboard

`GET /api/dashboard/seuils` (authentifié, non scopé foyer) → `{moisARisqueSoldeMin,
tauxEffortCorrect, tauxEffortTendu, tauxEffortSature, tauxEffortSoutenu,
tauxEffortCritique, besoinsPlaisirsBudget, posteAOptimiserScore}`. Seuils d'interprétation
des indicateurs du dashboard (purement affichage, aucune règle moteur) — remplace les
constantes auparavant codées en dur côté frontend.

---

## PARTIE B — Frontend

## 1. Shell & navigation

- **Topbar** : logo, sélecteur de foyer, sélecteur de scénario (badge « référence »), menu
  utilisateur, sélecteur langue/thème.
- **Menu latéral** (`hidden md:flex`) : Tableau de bord (foyer + par membre) · Revenus ·
  Charges · Réserves · Scénarios · Argent de poche · Référentiels (Membres,
  Comptes, Catégories, Taux) · Paramètres / Accès.
- **Shell** synchronise le contexte depuis l'URL (`/f/:foyerId/…`) : charge foyer, membres,
  scénarios → sélectionne le scénario de référence. Auto-sélection si un seul foyer.

**`ContexteService`** (source de vérité globale, signals) : `foyerId`, `foyerCourant`,
`scenarioId`, `scenarioCourant`, `membres`, `deviseBase`, `estEditor`, `estOwner`.
`setFoyer()`/`setScenario()` déclenchent les effets réactifs.

## 2. Routes (lazy)
```
/login, /register                     (public)
/foyers                               (choix / création de foyer)
/f/:foyerId
  ├── /dashboard                       → redirige vers dashboard/foyer/<année courante>
  ├── /dashboard/:sujetId/:annee       ┐ DashboardComponent unique (vue annuelle)
  ├── /dashboard/:sujetId/:annee/:mois ┘ DashboardComponent unique (vue mensuelle)
  │     sujetId = "foyer" (cumul) ou id d'un membre
  ├── /revenus | /charges | /reserves
  ├── /scenarios
  ├── /argent-poche
  ├── /referentiels/(membres|comptes|categories|taux)
  ├── /parametres
  └── /acces
```
`AuthGuard` protège `/f/**`. Actions d'écriture masquées via `contexte.estEditor()` /
`estOwner()`. Guards dashboard : `redirectToCurrentYearGuard` (complète l'année courante) +
`dashboardLegacyRedirectGuard` (rétrocompat anciennes URLs) ; query params préservés.

## 3. Écrans

### 3.1 Tableau de bord (écran unifié `DashboardComponent`)
Deux axes pilotés par l'URL : **sujet** (`foyer` = cumul, ou un membre = données propres,
scoping backend via `parMembre`/`moisParMembre*`) et **vue** (annuelle si `:annee` seul,
mensuelle si `:annee/:mois`). Bloc résumé : `app-metric-ring`, `app-stat-grid`,
`app-kpi-chip-row`. Onglets (`app-tab-group`) : `recap` (bascule catégorie/type/compte),
`graphiques` (flux mensuel / trésorerie / prévu vs réel en `p-chart`), `events`
(`app-event-grid`, alimenté par `…/projection/evenements`). Indicateurs
enrichis (`features/dashboard/indicators/`) dont `taux-effort-membre`
(`app-taux-effort-card`, jauges « charges + réserves » et « + argent de poche »).

### 3.2 Revenus / Charges / Réserves (`PostesListeComponent`, paramétré par `type`)
Liste en cartes (barre accent colorée par type) : description + badge `ESTIMATION ± X.X%`,
méta (catégorie/période/périodicité avec icônes), tags membres colorés (contraste auto),
montant + mensualisé. En-tête : tri (date/catégorie/description), filtres (masquer
inactifs/futurs, catégories/comptes/membres). **Dialog** : périodicité 0–12 (0 = one-shot →
seul `Début` visible ; 1 → mode/moment cachés ; >1 → grille périodicité/moment/mode),
nature (+ pourcentage conditionnel pré-rempli à 10 % en ESTIMATION, obligatoire), mode de
répartition (`CUSTOM` → parts par membre, **somme = 100 % live**, Enregistrer bloqué
sinon), ventilation comptes, aperçu mensuel. Écriture masquée pour `VIEWER`.

### 3.3 Scénarios (`ScenariosListeComponent`)
`p-table` : Nom · Statut (référence) · Année · Trésorerie initiale · Horizon. Actions
(éditer/dupliquer/définir référence/supprimer, masquées pour VIEWER et pour la référence).
Bouton **périodes** (`RepartitionPeriodesComponent`) visible si >1 membre : dialog listant
les périodes + formulaire (début/fin, parts par membre, somme live, « Équitable »).

### 3.4 Référentiels (CRUD `p-table` + `p-dialog`)
- **Membres** : couleur (pastille) · Nom · Actif ; formulaire nom + `p-colorpicker`.
- **Comptes** : Libellé · Solde initial · Devise · Membres (tags) ; `p-multiselect` membres
  actifs **obligatoire**.
- **Catégories** : Libellé · Type (filtrable) · Actif.
- **Taux de change** : Devise · Taux vers base.

### 3.5 Paramètres foyer & accès
- **`/parametres`** : nom + devise de base (enregistrement `OWNER`), zone dangereuse
  (suppression foyer, `OWNER`, `p-confirmdialog`).
- **`/acces`** : table Nom · Email · Rôle ; actions `OWNER` (inviter / changer rôle /
  retirer ; l'OWNER ne peut se retirer lui-même).

### 3.6 Argent de poche (`/argent-poche`, `ArgentPocheComponent`)
Par membre/scénario : **politiques** (`p-table` nom/membre/période/mode/paramètres,
formulaire avec aperçu « 6 prochains mois » via `…/rav-brut`) et **allocations**
ponctuelles (membre/mois/montant/raison, prioritaires sur la politique). Écriture masquée
pour `VIEWER`.

## 4. Pratiques transverses
- Composants partagés du dashboard (`shared/components/`) sans logique métier (agrégats
  reçus en `@Input`) : `tab-group`, `page-nav`, `metric-ring`, `stat-grid`,
  `kpi-chip(-row)`, `event-grid`, `objective-progress`, `taux-effort-card`.
- **Aucun texte en dur** → clés i18n. Formatage montants/dates via `Intl` + `deviseBase`
  (pipes dédiés). Miroir des règles serveur côté UX (répartition à 100 % avant sauvegarde).
