-- ============================================================
--  V1__init.sql — Schéma complet Budget Foyer
--  Conventions : snake_case, UUID PK, NUMERIC(15,2) montants,
--  NUMERIC(10,6) taux, TIMESTAMPTZ timestamps, DATE dates métier
--  Note : VARCHAR utilisé partout (pas CHAR) pour compatibilité
--         avec Hibernate ddl-auto=validate (CHAR → bpchar en PG)
-- ============================================================

-- ── Utilisateurs ──────────────────────────────────────────
CREATE TABLE utilisateur (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             VARCHAR(255) NOT NULL UNIQUE,
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    nom_complet       VARCHAR(255),
    actif             BOOLEAN NOT NULL DEFAULT TRUE,
    date_creation     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Foyers ────────────────────────────────────────────────
CREATE TABLE foyer (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom           VARCHAR(255) NOT NULL,
    devise_base   VARCHAR(3)  NOT NULL DEFAULT 'CHF',
    date_creation TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Accès foyer (N–N Utilisateur ⇄ Foyer + rôle) ─────────
CREATE TABLE acces_foyer (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utilisateur_id UUID        NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    foyer_id       UUID        NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
    role           VARCHAR(16) NOT NULL CHECK (role IN ('OWNER','EDITOR','VIEWER')),
    date_ajout     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (utilisateur_id, foyer_id)
);

-- ── Membres ───────────────────────────────────────────────
CREATE TABLE membre (
    id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    foyer_id UUID         NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
    nom      VARCHAR(120) NOT NULL,
    couleur  VARCHAR(7),
    ordre    INT          NOT NULL DEFAULT 0,
    actif    BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_membre_foyer ON membre (foyer_id);

-- ── Comptes bancaires ─────────────────────────────────────
CREATE TABLE compte (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    foyer_id      UUID         NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
    libelle       VARCHAR(120) NOT NULL,
    type          VARCHAR(16)  NOT NULL DEFAULT 'AUTRE'
                               CHECK (type IN ('COURANT','EPARGNE','COMMUN','AUTRE')),
    solde_initial NUMERIC(15,2) NOT NULL DEFAULT 0,
    devise        VARCHAR(3),
    ordre         INT          NOT NULL DEFAULT 0,
    actif         BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_compte_foyer ON compte (foyer_id);

-- ── Catégories de postes ──────────────────────────────────
CREATE TABLE categorie (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    foyer_id   UUID         NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
    libelle    VARCHAR(120) NOT NULL,
    type_poste VARCHAR(16)  NOT NULL
               CHECK (type_poste IN ('REVENU','CHARGE','RESERVE','PROJET')),
    systeme    BOOLEAN      NOT NULL DEFAULT FALSE,
    ordre      INT          NOT NULL DEFAULT 0,
    actif      BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_categorie_foyer ON categorie (foyer_id, type_poste);

-- ── Actifs patrimoniaux ───────────────────────────────────
CREATE TABLE actif (
    id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    foyer_id               UUID         NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
    libelle                VARCHAR(120) NOT NULL,
    type_actif             VARCHAR(24)  NOT NULL DEFAULT 'AUTRE'
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

-- ── Taux de change prévisionnels ──────────────────────────
CREATE TABLE taux_change (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    foyer_id       UUID         NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
    devise         VARCHAR(3)   NOT NULL,
    taux_vers_base NUMERIC(18,8) NOT NULL,
    UNIQUE (foyer_id, devise)
);

-- ── Scénarios ─────────────────────────────────────────────
CREATE TABLE scenario (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    foyer_id            UUID         NOT NULL REFERENCES foyer(id) ON DELETE CASCADE,
    nom                 VARCHAR(160) NOT NULL,
    est_reference       BOOLEAN      NOT NULL DEFAULT FALSE,
    annee_depart        INT          NOT NULL,
    tresorerie_initiale NUMERIC(15,2) NOT NULL DEFAULT 0,
    horizon_annees      INT          NOT NULL DEFAULT 9,
    date_creation       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    date_modification   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_scenario_foyer ON scenario (foyer_id);
-- Un seul scénario de référence par foyer
CREATE UNIQUE INDEX uq_scenario_ref ON scenario (foyer_id) WHERE est_reference;

-- ── Répartition par défaut (quotes-parts du scénario) ─────
CREATE TABLE repartition_defaut (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID         NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
    membre_id   UUID         NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
    quote_part  NUMERIC(9,6) NOT NULL,
    UNIQUE (scenario_id, membre_id)
);

-- ── Postes budgétaires ────────────────────────────────────
CREATE TABLE poste (
    id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id      UUID          NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
    type             VARCHAR(16)   NOT NULL
                     CHECK (type IN ('REVENU','CHARGE','RESERVE')),
    description      VARCHAR(255)  NOT NULL,
    categorie_id     UUID          REFERENCES categorie(id),
    montant          NUMERIC(15,2) NOT NULL DEFAULT 0,
    devise           VARCHAR(3),
    periodicite_mois INT           NOT NULL DEFAULT 1,
    debut            DATE,
    fin              DATE,
    mode             VARCHAR(16)   NOT NULL DEFAULT 'MENSUALISE'
                     CHECK (mode IN ('MENSUALISE','PERIODIQUE')),
    moment           VARCHAR(16)   NOT NULL DEFAULT 'DEBUT_PERIODE'
                     CHECK (moment IN ('DEBUT_PERIODE','FIN_PERIODE')),
    compte_source    UUID          REFERENCES compte(id),
    ordre            INT           NOT NULL DEFAULT 0,
    date_creation    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    date_modification TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_periodicite CHECK (periodicite_mois >= 0),
    CONSTRAINT chk_montant     CHECK (montant >= 0)
);
CREATE INDEX idx_poste_scenario_type ON poste (scenario_id, type);

-- ── Répartitions par poste (override de la répartition défaut) ──
CREATE TABLE repartition_poste (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    poste_id   UUID         NOT NULL REFERENCES poste(id) ON DELETE CASCADE,
    membre_id  UUID         NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
    quote_part NUMERIC(9,6) NOT NULL,
    UNIQUE (poste_id, membre_id)
);

-- ── Ventilation par compte (membre → compte pour un poste) ──
CREATE TABLE ventilation_compte (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poste_id  UUID NOT NULL REFERENCES poste(id) ON DELETE CASCADE,
    membre_id UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
    compte_id UUID NOT NULL REFERENCES compte(id),
    UNIQUE (poste_id, membre_id)
);

-- ── Objectifs d'épargne ───────────────────────────────────
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
    -- Exactement un des deux supports obligatoire
    CONSTRAINT chk_support_objectif CHECK (
        (compte_id IS NOT NULL)::int + (actif_id IS NOT NULL)::int = 1
    )
);
CREATE INDEX idx_objectif_scenario ON objectif (scenario_id);
