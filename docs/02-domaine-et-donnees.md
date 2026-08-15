# 02 — Domaine & modèle de données

> Entités, relations, énumérations et schéma PostgreSQL. Langage ubiquitaire défini dans
> l'[index](README.md#glossaire--langage-ubiquitaire). Le schéma est géré par **Flyway**
> (Hibernate en `ddl-auto=validate`) : toute évolution passe par une nouvelle migration
> `V{n}__description.sql`.

> **Décisions gouvernées par ce doc** : ajout/modification d'entité, de champ ou d'énumération, conception du schéma, écriture d'une migration Flyway et données de seed.

---

## 1. Agrégats & multi-tenant

Tout est rattaché à un **Foyer** (tenant). Hiérarchie de possession :
```
Utilisateur ──< AccesFoyer >── Foyer
                                 │
      ┌──────────────┬───────────┼────────────┐
   Membre        Compte      Categorie      TauxChange
      │
      └──── compte_membre (N-N)
              │
           Scenario (n par Foyer, dont 1 « de référence »)
              │
      ┌───────┼──────────────────────┐
   Poste  RepartitionPeriode      ArgentPoche
      │      └─< RepartitionPeriodePart >─ Membre
      ├──< RepartitionPoste >── Membre   (CUSTOM uniquement)
      └──< VentilationCompte >── (Membre, Compte)
```
- **Niveau Foyer** (référentiels partagés) : Membre, Compte, Categorie, TauxChange,
  `deviseBase`.
- **Niveau Scénario** (hypothèses variables) : année de départ, trésorerie initiale,
  horizon, périodes de répartition, Postes, argent de poche.

Dupliquer un scénario copie les postes/hypothèses sans toucher aux référentiels du foyer.

## 2. Entités (résumé)

- **Utilisateur** — compte d'authentification (`email` unique, `motDePasseHash`,
  `nomComplet`, `actif`). Aucune donnée budgétaire directe.
- **TokenRefresh** — token opaque de renouvellement JWT (`token` unique, `expireA`,
  `revoque`).
- **Foyer** — tenant (`nom`, `deviseBase` ISO 4217). **À la création** (`POST
  /api/foyers`, même transaction) : `AccesFoyer` OWNER pour l'utilisateur courant +
  membres initiaux (min. 1, sinon `422 FOYER_MEMBRES_INVALIDES`) + scénario de référence
  « Scénario de base » (année courante, tréso 0, horizon 9, période de répartition ouverte
  équilibrée).
- **AccesFoyer** — lien N-N Utilisateur/Foyer + `role` (OWNER | EDITOR | VIEWER), unique
  `(utilisateurId, foyerId)`.
- **Membre** — personne du budget (`nom`, `couleur` hex, `actif`). N membres autorisés ;
  tri automatique par nom.
- **Compte** — compte bancaire (`libelle`, `soldeInitial`, `devise`, `actif`). N-N avec
  Membre via `compte_membre` (`estPrimaire` : au plus un primaire par membre). Un compte
  ne peut être créé sans au moins un membre actif (`422 COMPTE_SANS_MEMBRE`).
- **Categorie** — classification (`libelle`, `typePoste` REVENU | CHARGE | RESERVE).
  `poste.categorieId` en `ON DELETE SET NULL` (supprimer une catégorie dissocie
  les postes sans les supprimer).
- **TauxChange** — taux prévisionnel vers la devise de base (`devise`, `tauxVersBase`),
  unique `(foyerId, devise)`.
- **Scenario** — hypothèses + postes (`nom`, `estReference` — un seul true/foyer,
  `anneeDepart`, `tresorerieInitiale`, `horizonAnnees`). CRUD + duplication profonde
  (`:dupliquer`) + `:definir-reference`.
- **RepartitionPeriode / RepartitionPeriodePart** — fenêtres temporelles de quotes-parts
  d'un scénario (`Σ quotePart = 1` par période, une seule ouverte, pas de chevauchement).
- **Poste** — ligne budgétaire récurrente : `type`, `description`, `categorieId`,
  `montant`, `devise`, `periodiciteMois` (0 = one-shot), `debut`/`fin`, `mode`, `moment`,
  `nature`, `estimPourcentage` (obligatoire si ESTIMATION), `importance` /
  `potentielOptimisation` (1-5, **descriptifs**, sans impact moteur), `typeRepartition`,
  `posteOrigineId` (chaînage des révisions). **Cycle de vie** : révision de montant
  (crée un poste chaîné + clôture l'ancien), annulation de révision, décalage de fenêtre,
  clôture/réactivation. Pas d'endpoint de duplication de poste.
- **RepartitionPoste** — override CUSTOM (`Σ par poste = 1`), présent uniquement pour
  `typeRepartition = CUSTOM`.
- **VentilationCompte** — compte utilisé par chaque membre pour un poste (le membre ne
  peut choisir qu'un compte auquel il est rattaché).
- **PolitiqueArgentPoche** — politique récurrente par `(scenario, membre)` : `compteId`,
  `dateDebut`/`dateFin` (null = ouverte), `mode` (VARIABLE : socle/pourcentage/plafond, ou
  FIXE : montantFixe). Chevauchements interdits, trous autorisés (validation en service).
- **AllocationArgentPoche** — allocation ponctuelle `(scenario, membre, mois)`,
  prioritaire sur la politique, unique par clé.

## 3. Énumérations
```
TypePoste                 = REVENU | CHARGE | RESERVE
TypeCategorie             = REVENU | CHARGE | RESERVE
ModeComptabilisation      = MENSUALISE | PERIODIQUE
MomentPeriode             = DEBUT_PERIODE | FIN_PERIODE | INCONNU
NaturePoste               = EFFECTIF | ESTIMATION
TypeRepartition           = AUTO | REVERSE_AUTO | CUSTOM
RoleFoyer                 = OWNER | EDITOR | VIEWER
ModePolitiqueArgentPoche  = VARIABLE | FIXE
```
`@Enumerated(EnumType.STRING)` — jamais d'ordinal en base.

## 4. Schéma SQL (PostgreSQL)

> Conventions : `snake_case`, PK `uuid` (`gen_random_uuid()`), montants `NUMERIC(15,2)`,
> `TIMESTAMPTZ` (dates système) / `DATE` (dates métier), `VARCHAR` (compat
> `ddl-auto=validate`). Tous les référentiels portent `foyer_id` (scoping multi-tenant).

```sql
CREATE TABLE utilisateur (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE, mot_de_passe_hash VARCHAR(255) NOT NULL,
  nom_complet VARCHAR(255), actif BOOLEAN NOT NULL DEFAULT TRUE,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE token_refresh (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  token VARCHAR(512) NOT NULL UNIQUE, expire_a TIMESTAMPTZ NOT NULL,
  revoque BOOLEAN NOT NULL DEFAULT FALSE, date_creation TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE foyer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(255) NOT NULL, devise_base VARCHAR(3) NOT NULL DEFAULT 'CHF',
  date_creation TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE acces_foyer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  foyer_id UUID NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL CHECK (role IN ('OWNER','EDITOR','VIEWER')),
  date_ajout TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (utilisateur_id, foyer_id)
);

CREATE TABLE membre (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id UUID NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  nom VARCHAR(120) NOT NULL, couleur VARCHAR(7), actif BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE compte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id UUID NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  libelle VARCHAR(120) NOT NULL, solde_initial NUMERIC(15,2) NOT NULL DEFAULT 0,
  devise VARCHAR(3), actif BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE compte_membre (
  compte_id UUID NOT NULL REFERENCES compte(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  est_primaire BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT pk_compte_membre PRIMARY KEY (compte_id, membre_id)
);
CREATE UNIQUE INDEX idx_compte_membre_primaire_unique
  ON compte_membre (membre_id) WHERE est_primaire;

CREATE TABLE categorie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id UUID NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  libelle VARCHAR(120) NOT NULL,
  type_poste VARCHAR(16) NOT NULL CHECK (type_poste IN ('REVENU','CHARGE','RESERVE')),
  actif BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE taux_change (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id UUID NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  devise VARCHAR(3) NOT NULL, taux_vers_base NUMERIC(18,8) NOT NULL, UNIQUE (foyer_id, devise)
);

CREATE TABLE scenario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foyer_id UUID NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
  nom VARCHAR(160) NOT NULL, est_reference BOOLEAN NOT NULL DEFAULT FALSE,
  annee_depart INT NOT NULL, tresorerie_initiale NUMERIC(15,2) NOT NULL DEFAULT 0,
  horizon_annees INT NOT NULL DEFAULT 9,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT now(), date_modification TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_scenario_ref ON scenario (foyer_id) WHERE est_reference;

CREATE TABLE repartition_periode (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  debut DATE, fin DATE,
  CONSTRAINT chk_repartition_periode_coherence CHECK (fin IS NULL OR debut IS NULL OR debut <= fin)
);

CREATE TABLE repartition_periode_part (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periode_id UUID NOT NULL REFERENCES repartition_periode(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  quote_part NUMERIC(9,6) NOT NULL, ordre INT NOT NULL DEFAULT 0, UNIQUE (periode_id, membre_id)
);

CREATE TABLE poste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  type VARCHAR(16) NOT NULL CHECK (type IN ('REVENU','CHARGE','RESERVE')),
  description VARCHAR(255) NOT NULL,
  categorie_id UUID REFERENCES categorie(id) ON DELETE SET NULL,
  montant NUMERIC(15,2) NOT NULL DEFAULT 0, devise VARCHAR(3),
  periodicite_mois INT NOT NULL DEFAULT 1,        -- 0 = one-shot
  debut DATE, fin DATE,
  mode VARCHAR(16) NOT NULL DEFAULT 'MENSUALISE' CHECK (mode IN ('MENSUALISE','PERIODIQUE')),
  moment VARCHAR(16) NOT NULL DEFAULT 'DEBUT_PERIODE' CHECK (moment IN ('DEBUT_PERIODE','FIN_PERIODE','INCONNU')),
  nature VARCHAR(16) NOT NULL DEFAULT 'EFFECTIF' CHECK (nature IN ('EFFECTIF','ESTIMATION')),
  estim_pourcentage NUMERIC(3,1),                 -- NULL si EFFECTIF, obligatoire si ESTIMATION
  importance INT NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),                        -- descriptif
  potentiel_optimisation INT NOT NULL DEFAULT 3 CHECK (potentiel_optimisation BETWEEN 1 AND 5), -- descriptif
  type_repartition VARCHAR(16) NOT NULL DEFAULT 'AUTO' CHECK (type_repartition IN ('AUTO','REVERSE_AUTO','CUSTOM')),
  ordre INT NOT NULL DEFAULT 0,
  poste_origine_id UUID REFERENCES poste(id) ON DELETE SET NULL,   -- chaînage des révisions
  date_creation TIMESTAMPTZ NOT NULL DEFAULT now(), date_modification TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_periodicite CHECK (periodicite_mois >= 0),
  CONSTRAINT chk_montant CHECK (montant >= 0),
  CONSTRAINT chk_estim_pct CHECK (estim_pourcentage IS NULL OR (estim_pourcentage BETWEEN 0 AND 100))
);

CREATE TABLE repartition_poste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poste_id UUID NOT NULL REFERENCES poste(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  quote_part NUMERIC(9,6) NOT NULL, UNIQUE (poste_id, membre_id)
);

CREATE TABLE ventilation_compte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poste_id UUID NOT NULL REFERENCES poste(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  compte_id UUID NOT NULL REFERENCES compte(id), UNIQUE (poste_id, membre_id)
);

CREATE TABLE politique_argent_poche (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  compte_id UUID NOT NULL REFERENCES compte(id),
  nom VARCHAR(160) NOT NULL, date_debut DATE NOT NULL, date_fin DATE,
  mode VARCHAR(16) NOT NULL CHECK (mode IN ('VARIABLE','FIXE')),
  socle NUMERIC(15,2), pourcentage NUMERIC(5,2), plafond NUMERIC(15,2), montant_fixe NUMERIC(15,2),
  date_creation TIMESTAMPTZ NOT NULL DEFAULT now(), date_modif TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_politique_poche_periode CHECK (date_fin IS NULL OR date_fin >= date_debut),
  CONSTRAINT chk_politique_poche_mode_variable CHECK (mode <> 'VARIABLE' OR
    (socle IS NOT NULL AND socle >= 0 AND pourcentage BETWEEN 0 AND 100 AND plafond >= socle)),
  CONSTRAINT chk_politique_poche_mode_fixe CHECK (mode <> 'FIXE' OR montant_fixe >= 0)
);

CREATE TABLE allocation_argent_poche (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  membre_id UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  compte_id UUID NOT NULL REFERENCES compte(id),
  mois DATE NOT NULL, montant NUMERIC(15,2) NOT NULL CHECK (montant >= 0), raison VARCHAR(255),
  date_creation TIMESTAMPTZ NOT NULL DEFAULT now(), date_modif TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_allocation_poche_scenario_membre_mois UNIQUE (scenario_id, membre_id, mois)
);
```

## 5. Migrations Flyway (état)

| Version | Contenu |
|---|---|
| V1 | Schéma initial complet |
| V2 / V4 | Seed démo « Charmillot » (données réelles Excel, 2 membres CHF) |
| V3 | `token_refresh` |
| V5 / V10 | `poste.nature` (EFFECTIF/ESTIMATION) ; `poste.estim_pourcentage` |
| V7 | `repartition_periode` + `repartition_periode_part` (remplace `repartition_defaut`) |
| V8 | `compte_membre` (N-N) ; suppression `compte.type` et `poste.compte_source` |
| V11 | `poste.categorie_id` en `ON DELETE SET NULL` |
| V12 | `poste.poste_origine_id` (chaînage des révisions) |
| V13 | Suppression des colonnes `ordre` (tri automatique) |
| V16 | Second foyer de démonstration « Berthoud » (anonymisé) |
| V17 | `poste.moment` accepte `INCONNU` |
| V18 / V19 | `poste.importance` / `poste.potentiel_optimisation` (1-5, descriptifs) |
| V20 / V21 | Compte primaire → `compte_membre.est_primaire` |
| V22 / V23 | `politique_argent_poche` / `allocation_argent_poche` |

> Le foyer d'exemple n'est **jamais** codé en dur : il vit dans le seed Flyway et sert de
> base aux vecteurs golden ([doc 01](01-principes-et-moteur.md#12-vecteurs-de-test-golden)).
