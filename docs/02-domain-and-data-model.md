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
      │              │                                        
      └──────┐       │                                        
             ▼       ▼                                        
          Scenario (n par Foyer, dont 1 « de référence »)     
             │                                                
      ┌──────┴───────────────┐                                
      ▼                       ▼                                
    Poste ──< RepartitionPoste >── Membre                      
      │  └──< VentilationCompte >── (Membre, Compte)           
      ▼                                                        
   Objectif ── (rattaché à un Compte ou Actif)                 
```

**Niveau Foyer (référentiels partagés entre scénarios)** : Membre, Compte, Categorie,
Actif, TauxChange, deviseBase.
**Niveau Scénario (hypothèses variables)** : année de départ, trésorerie initiale,
horizon, répartition par défaut, Postes, Objectifs.

> Ce découpage est ce qui rend le **what-if** propre : dupliquer un scénario copie les
> postes/hypothèses sans toucher aux membres/comptes/catégories du foyer.

## 2. Entités (description fonctionnelle)

### Utilisateur
Compte applicatif d'authentification. Champs : `id`, `email` (unique), `motDePasseHash`,
`nomComplet`, `actif`, `dateCreation`. **Aucune** donnée budgétaire directe.

### Foyer
Tenant. Champs : `id`, `nom`, `deviseBase` (code ISO 4217, ex. `CHF`), `dateCreation`.

**Initialisation à la création** : la création d'un foyer via `POST /api/foyers` déclenche
automatiquement, dans la même transaction :
1. La création du lien `AccesFoyer` (rôle `OWNER`) pour l'utilisateur courant.
2. La création des **membres initiaux** fournis dans le payload (`membres[{nom, couleur}]`,
   minimum 1). L'ordre est attribué par position dans la liste ; la couleur défaut est
   `#6366F1` si absente.
3. La création d'un **scénario de référence** «&nbsp;Scénario de base&nbsp;» avec les valeurs par
   défaut : `anneeDepart = année courante`, `tresorerieInitiale = 0`, `horizonAnnees = 25`,
   `estReference = true`, et des `RepartitionDefaut` équilibrées (2 décimales, somme = 1,00).

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
sans au moins un membre**.

### Categorie
Classification d'un poste. Champs : `id`, `foyerId`, `libelle`, `typePoste` (REVENU |
CHARGE | RESERVE | PROJET), `systeme` (bool : catégorie livrée par défaut vs custom),
`ordre`, `actif`. Les catégories `PROJET` servent aux objectifs.

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
`horizonAnnees` (int, défaut opérationnel : 25 pour le scénario initial), `dateCreation`,
`dateModification`. La **répartition par défaut** est portée par `RepartitionDefaut` (voir
ci-dessous). Un foyer dispose toujours d'au moins un scénario (le scénario de base créé à
l'initialisation).

### RepartitionDefaut
Quotes-parts par défaut du scénario. Champs : `id`, `scenarioId`, `membreId`,
`quotePart` (décimal ∈ [0,1]). **Σ quotePart par scénario = 1** (validé).

### Poste
Ligne budgétaire récurrente. Champs :
`id`, `scenarioId`, `type` (REVENU | CHARGE | RESERVE), `description`, `categorieId`,
`montant` (décimal ≥ 0), `devise` (défaut = deviseBase), `periodiciteMois` (int ≥ 0),
`debut` (date null), `fin` (date null), `mode` (MENSUALISE | PERIODIQUE), `moment`
(DEBUT_PERIODE | FIN_PERIODE), `nature` (EFFECTIF | PREVISION, descriptif),
`ordre`, `dateCreation`, `dateModification`.

> **Note** : le champ `compteSource` (anciennement présent sur les postes RESERVE) est
> supprimé. Le compte de débit d'une réserve est désormais porté par `VentilationCompte`
> du membre concerné.

### RepartitionPoste
Override de répartition pour un poste. Champs : `id`, `posteId`, `membreId`, `quotePart`.
Si aucune ligne pour un poste → hériter de `RepartitionDefaut`. **Σ par poste = 1** si
présent (validé).

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
NaturePoste          = EFFECTIF | PREVISION
RoleFoyer            = OWNER | EDITOR | VIEWER
TypeActif            = COMPTE_EPARGNE | TROISIEME_PILIER | INVESTISSEMENT | CRYPTO
                     | IMMOBILIER | VEHICULE | AUTRE
```

Correspondance des libellés Excel → enums (à respecter dans le seed) :
- Mode : `mensualisé` → `MENSUALISE`, `périodique` → `PERIODIQUE`.
- Moment : `début périodicité` → `DEBUT_PERIODE`, `fin périodicité` → `FIN_PERIODE`.

## 4. Schéma SQL (PostgreSQL) — Flyway `V1__init.sql`

> Conventions : `snake_case`, PK `bigserial`/`uuid` (choisir **UUID v7** de préférence),
> montants `NUMERIC(15,2)`, taux `NUMERIC(10,6)`, `TIMESTAMPTZ` pour les dates système,
> `DATE` pour les dates métier. Tous les référentiels portent `foyer_id` pour le scoping.

```sql
CREATE TABLE utilisateur (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  nom_complet     VARCHAR(255),
  actif           BOOLEAN NOT NULL DEFAULT TRUE,
  date_creation   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE foyer (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           VARCHAR(255) NOT NULL,
  devise_base   CHAR(3) NOT NULL DEFAULT 'CHF',
  date_creation TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE acces_foyer (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  foyer_id       UUID NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  role           VARCHAR(16) NOT NULL,
  date_ajout     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (utilisateur_id, foyer_id)
);

CREATE TABLE membre (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id UUID NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  nom      VARCHAR(120) NOT NULL,
  couleur  CHAR(7),
  ordre    INT NOT NULL DEFAULT 0,
  actif    BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_membre_foyer ON membre(foyer_id);

CREATE TABLE compte (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id      UUID NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  libelle       VARCHAR(120) NOT NULL,
  solde_initial NUMERIC(15,2) NOT NULL DEFAULT 0,
  devise        CHAR(3),
  ordre         INT NOT NULL DEFAULT 0,
  actif         BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_compte_foyer ON compte(foyer_id);

-- Relation N-N compte ↔ membre
CREATE TABLE compte_membre (
  compte_id UUID NOT NULL REFERENCES compte(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  CONSTRAINT pk_compte_membre PRIMARY KEY (compte_id, membre_id)
);
CREATE INDEX idx_compte_membre_compte ON compte_membre(compte_id);
CREATE INDEX idx_compte_membre_membre ON compte_membre(membre_id);

CREATE TABLE categorie (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id    UUID NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  libelle     VARCHAR(120) NOT NULL,
  type_poste  VARCHAR(16) NOT NULL,
  systeme     BOOLEAN NOT NULL DEFAULT FALSE,
  ordre       INT NOT NULL DEFAULT 0,
  actif       BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_categorie_foyer ON categorie(foyer_id, type_poste);

CREATE TABLE actif (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id               UUID NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  libelle                VARCHAR(120) NOT NULL,
  type_actif             VARCHAR(24) NOT NULL DEFAULT 'AUTRE',
  solde_initial          NUMERIC(15,2) NOT NULL DEFAULT 0,
  devise                 CHAR(3),
  taux_croissance_annuel NUMERIC(10,6) NOT NULL DEFAULT 0,
  ordre                  INT NOT NULL DEFAULT 0,
  actif                  BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_actif_foyer ON actif(foyer_id);

CREATE TABLE taux_change (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id       UUID NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  devise         CHAR(3) NOT NULL,
  taux_vers_base NUMERIC(18,8) NOT NULL,
  UNIQUE (foyer_id, devise)
);

CREATE TABLE scenario (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id            UUID NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  nom                 VARCHAR(160) NOT NULL,
  est_reference       BOOLEAN NOT NULL DEFAULT FALSE,
  annee_depart        INT NOT NULL,
  tresorerie_initiale NUMERIC(15,2) NOT NULL DEFAULT 0,
  horizon_annees      INT NOT NULL DEFAULT 9,
  date_creation       TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_modification   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scenario_foyer ON scenario(foyer_id);
-- au plus un scénario de référence par foyer :
CREATE UNIQUE INDEX uq_scenario_ref ON scenario(foyer_id) WHERE est_reference;

CREATE TABLE repartition_periode (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  debut       DATE,
  fin         DATE,
  CONSTRAINT chk_repartition_periode_coherence CHECK (fin IS NULL OR debut IS NULL OR debut <= fin)
);
CREATE INDEX idx_repartition_periode_scenario ON repartition_periode(scenario_id);

CREATE TABLE repartition_periode_part (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  periode_id UUID         NOT NULL REFERENCES repartition_periode(id) ON DELETE CASCADE,
  membre_id  UUID         NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  quote_part NUMERIC(9,6) NOT NULL,
  ordre      INT          NOT NULL DEFAULT 0,
  UNIQUE (periode_id, membre_id)
);

-- NB : repartition_defaut conservée pour rétro-compat (données historiques)
CREATE TABLE repartition_defaut (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  membre_id   UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  quote_part  NUMERIC(9,6) NOT NULL,
  UNIQUE (scenario_id, membre_id)
);

CREATE TABLE poste (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id       UUID NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  type              VARCHAR(16) NOT NULL,
  description       VARCHAR(255) NOT NULL,
  categorie_id      UUID REFERENCES categorie(id),
  montant           NUMERIC(15,2) NOT NULL DEFAULT 0,
  devise            CHAR(3),
  periodicite_mois  INT NOT NULL DEFAULT 1,
  debut             DATE,
  fin               DATE,
  mode              VARCHAR(16) NOT NULL DEFAULT 'MENSUALISE',
  moment            VARCHAR(16) NOT NULL DEFAULT 'DEBUT_PERIODE',
  type_repartition  VARCHAR(16) NOT NULL DEFAULT 'AUTO'
                    CHECK (type_repartition IN ('AUTO','REVERSE_AUTO','CUSTOM')),
  ordre             INT NOT NULL DEFAULT 0,
  date_creation     TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_modification TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_periodicite CHECK (periodicite_mois >= 0),
  CONSTRAINT chk_montant CHECK (montant >= 0)
);
CREATE INDEX idx_poste_scenario_type ON poste(scenario_id, type);

CREATE TABLE repartition_poste (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poste_id   UUID NOT NULL REFERENCES poste(id) ON DELETE CASCADE,
  membre_id  UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  quote_part NUMERIC(9,6) NOT NULL,
  UNIQUE (poste_id, membre_id)
);

CREATE TABLE ventilation_compte (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poste_id  UUID NOT NULL REFERENCES poste(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  compte_id UUID NOT NULL REFERENCES compte(id),
  UNIQUE (poste_id, membre_id)
);

CREATE TABLE objectif (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id         UUID NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  libelle             VARCHAR(160) NOT NULL,
  categorie_projet_id UUID REFERENCES categorie(id),
  montant_cible       NUMERIC(15,2) NOT NULL,
  echeance            DATE,
  compte_id           UUID REFERENCES compte(id),
  actif_id            UUID REFERENCES actif(id),
  date_creation       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_support_objectif CHECK (
    (compte_id IS NOT NULL) <> (actif_id IS NOT NULL)  -- exactement un des deux
  )
);
CREATE INDEX idx_objectif_scenario ON objectif(scenario_id);
```

> Migration `V2__seed_demo.sql` : insère le foyer de démonstration (voir §7) pour servir
> d'exemple et de base aux tests d'intégration.

> Migration `V5__poste_nature.sql` : ajoute la colonne `poste.nature` avec défaut
> `EFFECTIF` et contrainte `CHECK (nature IN ('EFFECTIF','PREVISION'))`.

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

1. **Somme des quotes-parts = 1** pour toute `RepartitionDefaut` (par scénario) et toute
   `RepartitionPoste` (par poste), tolérance 1e-6 → sinon 422.
2. **Un seul scénario de référence** par foyer (index partiel + validation service).
3. Un `Poste`, une `Categorie`, un `Compte` référencés doivent appartenir au **même
   foyer/scénario** que l'entité qui les porte (validation de cohérence multi-tenant).
4. `Objectif` : exactement un support (`compte_id` XOR `actif_id`).
5. Suppression d'un `Membre` référencé par des répartitions → refuser ou recalculer les
   quotes-parts (choix : **refuser** si des postes le référencent, message explicite).
6. `devise` d'un poste/compte/actif non nulle doit exister dans `taux_change` du foyer
   (ou == deviseBase) — sinon avertissement + taux 1 par défaut (ne pas bloquer).
7. Côté API, `periodiciteMois` est validée à `>= 1` ; le moteur garde néanmoins une
   robustesse interne `Dsafe` pour les cas historiques/tests où `D=0`.

## 7. Données de seed (foyer de démonstration — issu de l'Excel)

**Foyer** : nom « Foyer Charmillot », deviseBase `CHF`.
**Membres** : `Dylan` (ordre 0), `Mélanie` (ordre 1).
**Scénario de référence** : « Prévision principale », `anneeDepart = 2026`,
`tresorerieInitiale = 0`, `horizonAnnees = 9`. **RepartitionDefaut** : Dylan 0,58 /
Mélanie 0,42.
**Comptes** : Compte courant (COURANT), Compte épargne (EPARGNE), Compte en commun
(COMMUN), Compte bébé, Compte privé, Compte annexe.
**Catégories** (systeme=true) :
- CHARGE : Logement, Maison, Transport, Assurances, Alimentation, Abonnements, Enfant,
  Animaux, Santé, Impôts, Loisirs, Banque, Personnel, Autre, Epargne, Argent mis de côté,
  3ᵉ pilier, Investissement.
- REVENU : Salaire, Allocation, Prime / Bonus, Aide / Subvention, Revenu locatif,
  Investissement, Autre, Revenu passif, Dividendes.
- RESERVE : Epargne, Argent mis de côté, 3ᵉ pilier, Investissement.
- PROJET : Vacances, Achat, Travaux, Réserve d'urgence, Cadeau, Santé, Auto, Autre.
**Actifs (types épargne)** : Compte épargne, Compte courant, Cash, 3e pilier,
Investissement, Crypto, Immobilier, Véhicule, Autre.
**Postes** : reprendre les lignes du classeur (Salaire net 6300/4700, 13ᵉ salaire,
Allocation familiale, Manguiers…, Loyer 1500, Électricité 360 trimestriel, Internet 43,
Assurance ménage 630/an, Redevance 335/an, Taxes poubelles 111/an, Place de parc 100,
Assurance AUTO 1169/an, etc.), avec leurs `mode`/`moment`/`debut`/`fin`/prorata.

> Le seed doit produire **exactement** les vecteurs de test du doc 1 (§8-bis) : c'est un
> critère d'acceptation. Les données brutes complètes sont extractibles du fichier Excel
> d'origine fourni au commanditaire.
