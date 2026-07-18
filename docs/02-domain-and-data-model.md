# 02 — Modèle de domaine & modèle de données

> Entités, relations, schéma PostgreSQL, mapping JPA et données de seed. Le langage
> ubiquitaire est défini dans le [README](README.md#5-glossaire--langage-ubiquitaire).

---

## 1. Vue d'ensemble des agrégats

Hiérarchie de possession (multi-tenant : tout est rattaché à un **Foyer**) :

```
Utilisateur ──< AccesFoyer >── Foyer
                                 │
      ┌──────────────┬───────────┼────────────┬───────────────┐
      │              │           │            │               │
   Membre        Compte      Categorie      Actif        TauxChange
      │
      └──── compte_membre (N-N)
              │
           Scenario (n par Foyer, dont 1 « de référence »)
              │
      ┌───────┼──────────────────────┐
      ▼       ▼                      ▼
   Poste  RepartitionPeriode     Objectif
      │      └─< RepartitionPeriodePart >─ Membre
      ├──< RepartitionPoste >── Membre   (CUSTOM uniquement)
      └──< VentilationCompte >── (Membre, Compte)
```

**Niveau Foyer (référentiels partagés entre scénarios)** : Membre, Compte, Categorie,
Actif, TauxChange, deviseBase.
**Niveau Scénario (hypothèses variables)** : année de départ, trésorerie initiale,
horizon, périodes de répartition, Postes, Objectifs.

> Ce découpage est ce qui rend le **what-if** propre : dupliquer un scénario copie les
> postes/hypothèses sans toucher aux membres/comptes/catégories du foyer.

## 2. Entités (description fonctionnelle)

### Utilisateur
Compte applicatif d'authentification. Champs : `id`, `email` (unique), `motDePasseHash`,
`nomComplet`, `actif`, `dateCreation`. **Aucune** donnée budgétaire directe.

### TokenRefresh
Token opaque de renouvellement JWT. Champs : `id`, `utilisateurId`, `token` (unique),
`expireA`, `revoque`, `dateCreation`. Table : `token_refresh`.

### Foyer
Tenant. Champs : `id`, `nom`, `deviseBase` (code ISO 4217, ex. `CHF`), `dateCreation`.

**Initialisation à la création** : la création d'un foyer via `POST /api/foyers` déclenche
automatiquement, dans la même transaction :
1. La création du lien `AccesFoyer` (rôle `OWNER`) pour l'utilisateur courant.
2. La création des **membres initiaux** fournis dans le payload (`membres[{nom, couleur}]`,
   minimum 1). L'ordre est attribué par position dans la liste ; la couleur défaut est
   `#6366F1` si absente.
3. La création d'un **scénario de référence** « Scénario de base » avec les valeurs par
   défaut : `anneeDepart = année courante`, `tresorerieInitiale = 0`,
   `horizonAnnees = 9`, `estReference = true`, et une `RepartitionPeriode` ouverte avec
   des parts équilibrées (2 décimales, somme = 1,00).

Si `membres` est absent ou vide, le backend renvoie `422 FOYER_MEMBRES_INVALIDES`.

### AccesFoyer
Lien N–N Utilisateur/Foyer + rôle. Champs : `id`, `utilisateurId`, `foyerId`, `role`
(`OWNER` | `EDITOR` | `VIEWER`), `dateAjout`. Contrainte d'unicité `(utilisateurId,
foyerId)`.

### Membre
Personne du budget (Dylan, Mélanie…). Champs : `id`, `foyerId`, `nom`, `couleur` (hex,
pour les graphiques), `ordre`, `actif`. **N membres autorisés.**

### Compte
Compte bancaire du foyer. Champs : `id`, `foyerId`, `libelle`,
`soldeInitial` (décimal, au 1ᵉʳ janvier de l'année de départ du scénario
de référence — utilisé par le module patrimoine), `devise` (défaut = deviseBase),
`ordre`, `actif`.

Relation N-N avec `Membre` via la table de liaison `compte_membre`. Un compte appartient à
**1..N membres**. Lors de la création ou modification, seuls les membres **actifs** peuvent
être rattachés. Si un membre devient inactif après coup, le rattachement est conservé, mais
il ne peut plus être sélectionné dans les nouveaux postes. Un compte **ne peut pas être créé
sans au moins un membre** (422 `COMPTE_SANS_MEMBRE`).

### Categorie
Classification d'un poste. Champs : `id`, `foyerId`, `libelle`, `typePoste` (REVENU |
CHARGE | RESERVE | PROJET), `ordre`, `actif`. Les catégories `PROJET` servent aux objectifs.

### Actif
Élément de patrimoine hors compte courant. Champs : `id`, `foyerId`, `libelle`,
`typeActif` (voir enum), `soldeInitial`, `devise`, `tauxCroissanceAnnuel` (décimal, ex.
0,03 pour +3 %/an ; défaut 0), `ordre`, `actif`.

### TauxChange
Taux de conversion prévisionnel vers la devise de base. Champs : `id`, `foyerId`,
`devise`, `tauxVersBase` (décimal). Contrainte d'unicité `(foyerId, devise)`.

### Scenario
Jeu d'hypothèses + postes. Champs : `id`, `foyerId`, `nom`, `estReference` (bool ; un
seul `true` par foyer), `anneeDepart` (int), `tresorerieInitiale` (décimal, = B8 Excel),
`horizonAnnees` (int, défaut DB = **9**), `dateCreation`, `dateModification`.
Un foyer dispose toujours d'au moins un scénario (le scénario de base créé à
l'initialisation).

### RepartitionPeriode *(entité active — remplace RepartitionDefaut)*
Fenêtre temporelle de quotes-parts pour un scénario. Champs : `id`, `scenarioId`,
`debut` (date, null = depuis toujours), `fin` (date, null = ouverte / en cours).
Contrainte : `fin IS NULL OR debut IS NULL OR debut <= fin`.

Une période ouverte (fin = null) représente la répartition courante du scénario. Plusieurs
périodes non chevauchantes permettent de modéliser des changements de quote-part dans le
temps (ex. : arrêt de travail, séparation progressive des finances…).

### RepartitionPeriodePart
Quote-part d'un membre dans une période. Champs : `id`, `periodeId`, `membreId`,
`quotePart` (décimal ∈ [0,1]), `ordre`. Contrainte d'unicité `(periodeId, membreId)`.
**Σ quotePart par periode = 1** (validé).

### RepartitionDefaut *(legacy — rétrocompatiblité uniquement)*
> **Déprécié.** Cette table a été remplacée par `RepartitionPeriode` +
> `RepartitionPeriodePart` (migration V7). Elle est conservée uniquement pour la
> rétrocompatibilité des données historiques. Ne pas utiliser dans les nouveaux
> développements.

### Poste
Ligne budgétaire récurrente. Champs :
`id`, `scenarioId`, `type` (REVENU | CHARGE | RESERVE), `description`, `categorieId`,
`montant` (décimal ≥ 0), `devise` (défaut = deviseBase), `periodiciteMois` (int **≥ 0** ;
0 = ponctuel one-shot), `debut` (date null), `fin` (date null), `mode` (MENSUALISE |
PERIODIQUE), `moment` (DEBUT_PERIODE | FIN_PERIODE), `nature` (EFFECTIF | ESTIMATION,
descriptif), `estimPourcentage` (NUMERIC(3,1), nullable — obligatoire si nature=ESTIMATION,
null si nature=EFFECTIF ; représente la plage de variation ± du montant, ex. 10.0 signifie
montant peut varier de montant×0.90 à montant×1.10), `typeRepartition` (AUTO | REVERSE_AUTO
| CUSTOM, défaut AUTO), `ordre`, `dateCreation`, `dateModification`.

**Sémantique de `typeRepartition`** :
- `AUTO` : les quotes-parts suivent la `RepartitionPeriode` active du scénario à la date
  du flux. Aucune `RepartitionPoste` n'est stockée.
- `REVERSE_AUTO` : chaque membre reçoit `(1 − part_auto) / (N − 1)`. Aucune
  `RepartitionPoste` n'est stockée.
- `CUSTOM` : quotes-parts fixes stockées dans `RepartitionPoste` pour ce poste
  spécifiquement (override permanent).

**One-shot** (`periodiciteMois = 0`) : le montant est imputé en totalité une seule fois,
au mois défini par `debut`. Les champs `mode` et `moment` sont ignorés.

### RepartitionPoste
Override de répartition pour un poste **CUSTOM**. Champs : `id`, `posteId`, `membreId`,
`quotePart`. Uniquement présent pour les postes `typeRepartition = CUSTOM`.
**Σ par poste = 1** (validé).

### VentilationCompte
Compte utilisé par chaque membre pour un poste. Champs : `id`, `posteId`, `membreId`,
`compteId`. (Optionnel ; sert aux ventilations par compte et au patrimoine.)
Le membre ne peut sélectionner que les comptes auxquels il est rattaché
(via `compte_membre`).

### Objectif
Cible d'épargne. Champs : `id`, `scenarioId`, `libelle`, `categorieProjetId` (FK
Categorie type PROJET, null), `montantCible` (décimal), `echeance` (date), `compteId`
(null), `actifId` (null), `dateCreation`. Exactement un de `compteId` / `actifId`
renseigné (le support de l'objectif).

## 3. Énumérations

```
TypePoste            = REVENU | CHARGE | RESERVE
TypeCategorie        = REVENU | CHARGE | RESERVE | PROJET
ModeComptabilisation = MENSUALISE | PERIODIQUE
MomentPeriode        = DEBUT_PERIODE | FIN_PERIODE
NaturePoste          = EFFECTIF | ESTIMATION
TypeRepartition      = AUTO | REVERSE_AUTO | CUSTOM
RoleFoyer            = OWNER | EDITOR | VIEWER
TypeActif            = COMPTE_EPARGNE | TROISIEME_PILIER | INVESTISSEMENT | CRYPTO
                     | IMMOBILIER | VEHICULE | AUTRE
```

Correspondance des libellés Excel → enums (à respecter dans le seed) :
- Mode : `mensualisé` → `MENSUALISE`, `périodique` → `PERIODIQUE`.
- Moment : `début périodicité` → `DEBUT_PERIODE`, `fin périodicité` → `FIN_PERIODE`.

## 4. Schéma SQL (PostgreSQL) — état consolidé après V1→V10

> Conventions : `snake_case`, PK `uuid` (`gen_random_uuid()`), montants `NUMERIC(15,2)`,
> taux `NUMERIC(10,6)`, `TIMESTAMPTZ` pour les dates système, `DATE` pour les dates métier.
> `VARCHAR` utilisé pour la compatibilité Hibernate `ddl-auto=validate` (évite `bpchar`).
> Tous les référentiels portent `foyer_id` pour le scoping multi-tenant.

```sql
-- ── Utilisateurs ────────────────────────────────────────────────────────────
CREATE TABLE utilisateur (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR(255) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  nom_complet       VARCHAR(255),
  actif             BOOLEAN      NOT NULL DEFAULT TRUE,
  date_creation     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Refresh tokens JWT ───────────────────────────────────────────────────────
CREATE TABLE token_refresh (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id UUID         NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  token          VARCHAR(512) NOT NULL UNIQUE,
  expire_a       TIMESTAMPTZ  NOT NULL,
  revoque        BOOLEAN      NOT NULL DEFAULT FALSE,
  date_creation  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_token_refresh_utilisateur ON token_refresh (utilisateur_id);

-- ── Foyers ──────────────────────────────────────────────────────────────────
CREATE TABLE foyer (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           VARCHAR(255) NOT NULL,
  devise_base   VARCHAR(3)   NOT NULL DEFAULT 'CHF',
  date_creation TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Accès foyer (N–N Utilisateur ⇄ Foyer + rôle) ───────────────────────────
CREATE TABLE acces_foyer (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id UUID        NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  foyer_id       UUID        NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  role           VARCHAR(16) NOT NULL CHECK (role IN ('OWNER','EDITOR','VIEWER')),
  date_ajout     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (utilisateur_id, foyer_id)
);

-- ── Membres ─────────────────────────────────────────────────────────────────
CREATE TABLE membre (
  id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id UUID         NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  nom      VARCHAR(120) NOT NULL,
  couleur  VARCHAR(7),
  ordre    INT          NOT NULL DEFAULT 0,
  actif    BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_membre_foyer ON membre (foyer_id);

-- ── Comptes bancaires ────────────────────────────────────────────────────────
-- Note : la colonne `type` (COURANT/EPARGNE/COMMUN/AUTRE) a été supprimée en V8.
--        La colonne `compte_source` sur `poste` a aussi été supprimée en V8.
CREATE TABLE compte (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id      UUID          NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  libelle       VARCHAR(120)  NOT NULL,
  solde_initial NUMERIC(15,2) NOT NULL DEFAULT 0,
  devise        VARCHAR(3),
  ordre         INT           NOT NULL DEFAULT 0,
  actif         BOOLEAN       NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_compte_foyer ON compte (foyer_id);

-- ── Relation N-N compte ↔ membre ────────────────────────────────────────────
CREATE TABLE compte_membre (
  compte_id UUID NOT NULL REFERENCES compte(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  CONSTRAINT pk_compte_membre PRIMARY KEY (compte_id, membre_id)
);
CREATE INDEX idx_compte_membre_compte ON compte_membre (compte_id);
CREATE INDEX idx_compte_membre_membre ON compte_membre (membre_id);

-- ── Catégories de postes ─────────────────────────────────────────────────────
-- Note : la colonne `systeme` (bool) a été supprimée en V6.
CREATE TABLE categorie (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id   UUID         NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  libelle    VARCHAR(120) NOT NULL,
  type_poste VARCHAR(16)  NOT NULL
             CHECK (type_poste IN ('REVENU','CHARGE','RESERVE','PROJET')),
  ordre      INT          NOT NULL DEFAULT 0,
  actif      BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_categorie_foyer ON categorie (foyer_id, type_poste);

-- ── Actifs patrimoniaux ──────────────────────────────────────────────────────
CREATE TABLE actif (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id               UUID          NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  libelle                VARCHAR(120)  NOT NULL,
  type_actif             VARCHAR(24)   NOT NULL DEFAULT 'AUTRE'
                         CHECK (type_actif IN (
                           'COMPTE_EPARGNE','TROISIEME_PILIER','INVESTISSEMENT',
                           'CRYPTO','IMMOBILIER','VEHICULE','AUTRE'
                         )),
  solde_initial          NUMERIC(15,2) NOT NULL DEFAULT 0,
  devise                 VARCHAR(3),
  taux_croissance_annuel NUMERIC(10,6) NOT NULL DEFAULT 0,
  ordre                  INT           NOT NULL DEFAULT 0,
  actif                  BOOLEAN       NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_actif_foyer ON actif (foyer_id);

-- ── Taux de change prévisionnels ─────────────────────────────────────────────
CREATE TABLE taux_change (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id       UUID          NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  devise         VARCHAR(3)    NOT NULL,
  taux_vers_base NUMERIC(18,8) NOT NULL,
  UNIQUE (foyer_id, devise)
);

-- ── Scénarios ────────────────────────────────────────────────────────────────
CREATE TABLE scenario (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id            UUID          NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  nom                 VARCHAR(160)  NOT NULL,
  est_reference       BOOLEAN       NOT NULL DEFAULT FALSE,
  annee_depart        INT           NOT NULL,
  tresorerie_initiale NUMERIC(15,2) NOT NULL DEFAULT 0,
  horizon_annees      INT           NOT NULL DEFAULT 9,    -- défaut opérationnel = 9
  date_creation       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  date_modification   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_scenario_foyer ON scenario (foyer_id);
-- Un seul scénario de référence par foyer :
CREATE UNIQUE INDEX uq_scenario_ref ON scenario (foyer_id) WHERE est_reference;

-- ── Périodes de répartition (remplace repartition_defaut) ───────────────────
CREATE TABLE repartition_periode (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  debut       DATE,
  fin         DATE,
  CONSTRAINT chk_repartition_periode_coherence
    CHECK (fin IS NULL OR debut IS NULL OR debut <= fin)
);
CREATE INDEX idx_repartition_periode_scenario ON repartition_periode (scenario_id);

CREATE TABLE repartition_periode_part (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  periode_id UUID         NOT NULL REFERENCES repartition_periode(id) ON DELETE CASCADE,
  membre_id  UUID         NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  quote_part NUMERIC(9,6) NOT NULL,
  ordre      INT          NOT NULL DEFAULT 0,
  UNIQUE (periode_id, membre_id)
);

-- ── Répartition par défaut (LEGACY — rétrocompatibilité uniquement) ─────────
-- Déprécié depuis V7. Conservé pour les données historiques. Ne pas créer de
-- nouvelles entrées ; utiliser repartition_periode à la place.
CREATE TABLE repartition_defaut (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID         NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  membre_id   UUID         NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  quote_part  NUMERIC(9,6) NOT NULL,
  UNIQUE (scenario_id, membre_id)
);

-- ── Postes budgétaires ───────────────────────────────────────────────────────
CREATE TABLE poste (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id       UUID          NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  type              VARCHAR(16)   NOT NULL CHECK (type IN ('REVENU','CHARGE','RESERVE')),
  description       VARCHAR(255)  NOT NULL,
  categorie_id      UUID          REFERENCES categorie(id),
  montant           NUMERIC(15,2) NOT NULL DEFAULT 0,
  devise            VARCHAR(3),
  periodicite_mois  INT           NOT NULL DEFAULT 1,
  debut             DATE,
  fin               DATE,
  mode              VARCHAR(16)   NOT NULL DEFAULT 'MENSUALISE'
                    CHECK (mode IN ('MENSUALISE','PERIODIQUE')),
  moment            VARCHAR(16)   NOT NULL DEFAULT 'DEBUT_PERIODE'
                    CHECK (moment IN ('DEBUT_PERIODE','FIN_PERIODE')),
  nature            VARCHAR(16)   NOT NULL DEFAULT 'EFFECTIF'
                    CHECK (nature IN ('EFFECTIF','ESTIMATION')),
  estim_pourcentage NUMERIC(3,1),          -- NULL si nature=EFFECTIF, obligatoire si ESTIMATION
  type_repartition  VARCHAR(16)   NOT NULL DEFAULT 'AUTO'
                    CHECK (type_repartition IN ('AUTO','REVERSE_AUTO','CUSTOM')),
  ordre             INT           NOT NULL DEFAULT 0,
  date_creation     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  date_modification TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT chk_periodicite CHECK (periodicite_mois >= 0),   -- 0 = one-shot
  CONSTRAINT chk_montant     CHECK (montant >= 0),
  CONSTRAINT chk_estim_pct   CHECK (estim_pourcentage IS NULL OR (estim_pourcentage >= 0 AND estim_pourcentage <= 100))
);
CREATE INDEX idx_poste_scenario_type ON poste (scenario_id, type);
CREATE INDEX idx_poste_nature        ON poste (nature);
CREATE INDEX idx_poste_estim_pourcentage ON poste (estim_pourcentage);

-- ── Répartitions par poste (CUSTOM uniquement) ──────────────────────────────
CREATE TABLE repartition_poste (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  poste_id   UUID         NOT NULL REFERENCES poste(id) ON DELETE CASCADE,
  membre_id  UUID         NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  quote_part NUMERIC(9,6) NOT NULL,
  UNIQUE (poste_id, membre_id)
);

-- ── Ventilation par compte (membre → compte pour un poste) ──────────────────
CREATE TABLE ventilation_compte (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poste_id  UUID NOT NULL REFERENCES poste(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  compte_id UUID NOT NULL REFERENCES compte(id),
  UNIQUE (poste_id, membre_id)
);

-- ── Objectifs d'épargne ──────────────────────────────────────────────────────
CREATE TABLE objectif (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id         UUID          NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  libelle             VARCHAR(160)  NOT NULL,
  categorie_projet_id UUID          REFERENCES categorie(id),
  montant_cible       NUMERIC(15,2) NOT NULL,
  echeance            DATE,
  compte_id           UUID          REFERENCES compte(id),
  actif_id            UUID          REFERENCES actif(id),
  date_creation       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- Exactement un des deux supports obligatoire :
  CONSTRAINT chk_support_objectif CHECK (
    (compte_id IS NOT NULL)::int + (actif_id IS NOT NULL)::int = 1
  )
);
CREATE INDEX idx_objectif_scenario ON objectif (scenario_id);
```

> Migrations appliquées : V1 (schéma initial) → V2 (seed démo) → V3 (token_refresh) →
> V4 (seed réel) → V5 (poste.nature) → V6 (suppression categorie.systeme) →
> V7 (repartition_periode + type_repartition) → V8 (compte_membre, suppression
> compte.type et poste.compte_source) → V9 (nettoyage ventilations à 0%) →
> **V10 (poste.estim_pourcentage — plage de variation ± pour les postes ESTIMATION)**.
>
> Migration V10 : postes existants avec `nature='ESTIMATION'` reçoivent automatiquement
> `estim_pourcentage = 10.0` (valeur par défaut). Postes `EFFECTIF` conservent `NULL`.

## 5. Mapping JPA (indications)

- Une entité JPA par table, packages `domain` (ou `model`) + `repository` Spring Data.
- Utiliser des **enums Java** mappées en `@Enumerated(EnumType.STRING)`.
- `@ManyToOne(fetch = LAZY)` par défaut ; charger explicitement via `@EntityGraph` ou
  requêtes dédiées pour éviter le N+1 lors du calcul (le moteur a besoin de tous les
  postes + répartitions + ventilations d'un scénario → prévoir une requête
  `findScenarioForEngine(scenarioId)` avec fetch joints).
- Montants en `java.math.BigDecimal` pour le stockage/DTO ; **convertir en `double` dans
  le moteur** pour rester strictement fidèle à Excel (voir doc 1 §11), puis reconvertir.
- Auditing : `@CreatedDate` / `@LastModifiedDate` (`date_creation`/`date_modification`).
- Concurrence : `@Version` optionnel sur `Poste` et `Scenario` si édition concurrente.

## 6. Règles d'intégrité applicatives (au-delà des contraintes SQL)

1. **Somme des quotes-parts = 1** pour toute `RepartitionPeriodePart` (par période) et
   toute `RepartitionPoste` (par poste CUSTOM), tolérance 1e-6 → sinon 422
   `REPARTITION_INVALIDE`.
2. **Un seul scénario de référence** par foyer (index partiel + validation service).
3. Un `Poste`, une `Categorie`, un `Compte` référencés doivent appartenir au **même
   foyer/scénario** que l'entité qui les porte (validation de cohérence multi-tenant).
4. `Objectif` : exactement un support (`compte_id` XOR `actif_id`).
5. Suppression d'un `Membre` référencé par des répartitions → **refuser** si des postes
   CUSTOM ou des périodes le référencent (message `MEMBRE_REFERENCE_SUPPRESSION`).
6. `devise` d'un poste/compte/actif non nulle doit exister dans `taux_change` du foyer
   (ou == deviseBase) — sinon avertissement + taux 1 par défaut (ne pas bloquer).
7. `periodiciteMois` est validé à **>= 0** côté API ; 0 signifie one-shot (le moteur
   utilise la date `debut` comme unique mois d'imputation).
8. `VentilationCompte` : le `compteId` doit appartenir à un compte rattaché au membre
   concerné via `compte_membre` → sinon 422 `VENTILATION_COMPTE_NON_RATTACHE`.
9. Un compte **ne peut pas être créé sans au moins un membre actif** → 422
   `COMPTE_SANS_MEMBRE`.
10. **`estimPourcentage`** : obligatoire (non nul, > 0) si `nature = ESTIMATION` → sinon 422
    `ESTIMATION_POURCENTAGE_REQUIS`. Doit être nul si `nature = EFFECTIF`. Valeur comprise
    dans `[0, 100]`. Interprétation : le montant réel peut varier de `montant × (1 − estimPourcentage/100)`
    à `montant × (1 + estimPourcentage/100)`. Exemple : 100 CHF à ±10 % → plage [90, 110].
    Ce champ est **purement descriptif** pour le moment : le moteur de calcul utilise
    uniquement `montant` dans ses projections (les plages min/max sont réservées à un
    usage futur de stress-test). Valeur par défaut à la création : **10.0 %**.

## 7. Données de seed (foyer de démonstration — issu de l'Excel)

**Foyer** : nom « Foyer Charmillot », deviseBase `CHF`.
**Membres** : `Dylan` (ordre 0), `Mélanie` (ordre 1).
**Scénario de référence** : « Prévision principale », `anneeDepart = 2026`,
`tresorerieInitiale = 0`, `horizonAnnees = 9`.
**RepartitionPeriode** (ouverte, debut = 2026-01-01) : Dylan 0,58 / Mélanie 0,42.
**Comptes** : Compte courant, Compte épargne, Compte en commun,
Compte bébé, Compte privé, Compte annexe.
**Catégories** :
- CHARGE : Logement, Maison, Transport, Assurances, Alimentation, Abonnements, Enfant,
  Animaux, Santé, Impôts, Loisirs, Banque, Personnel, Autre, Epargne, Argent mis de côté,
  3ᵉ pilier, Investissement.
- REVENU : Salaire, Allocation, Prime / Bonus, Aide / Subvention, Revenu locatif,
  Investissement, Autre, Revenu passif, Dividendes.
- RESERVE : Epargne, Argent mis de côté, 3ᵉ pilier, Investissement.
- PROJET : Vacances, Achat, Travaux, Réserve d'urgence, Cadeau, Santé, Auto, Autre.
**Actifs** : types issus de l'enum `TypeActif`
(COMPTE_EPARGNE, TROISIEME_PILIER, INVESTISSEMENT, CRYPTO, IMMOBILIER, VEHICULE, AUTRE).
**Postes** : reprendre les lignes du classeur (Salaire net 6300/4700, 13ᵉ salaire,
Allocation familiale, Manguiers…, Loyer 1500, Électricité 360 trimestriel, Internet 43,
Assurance ménage 630/an, Redevance 335/an, Taxes poubelles 111/an, Place de parc 100,
Assurance AUTO 1169/an, etc.), avec leurs `mode`/`moment`/`debut`/`fin`/prorata.

> Le seed doit produire **exactement** les vecteurs de test du doc 1 (§8-bis) : c'est un
> critère d'acceptation. Les données brutes complètes sont extractibles du fichier Excel
> d'origine fourni au commanditaire.
