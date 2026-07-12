-- ============================================================
--  V7 — Répartition par période temporelle
-- ------------------------------------------------------------
--  1. Ajoute type_repartition sur le poste (AUTO par défaut).
--  2. Crée repartition_periode + repartition_periode_part.
--  3. Migre repartition_defaut → une période ouverte par scénario.
--  4. Classifie les repartition_poste existants :
--       • parts = 0 / 0.5 / 1        → CUSTOM  (conserve repartition_poste)
--       • parts ≈ défaut scénario     → AUTO    (supprime repartition_poste)
--       • parts ≈ inverse du défaut   → REVERSE_AUTO (supprime repartition_poste)
--       • autres                      → CUSTOM  (conserve repartition_poste)
-- ============================================================

-- ─── 1. Colonne type_repartition ─────────────────────────────────────────────
ALTER TABLE poste
    ADD COLUMN IF NOT EXISTS type_repartition VARCHAR(16) NOT NULL DEFAULT 'AUTO'
        CHECK (type_repartition IN ('AUTO','REVERSE_AUTO','CUSTOM'));

-- ─── 2. Nouvelles tables ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repartition_periode (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID        NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
    debut       DATE,
    fin         DATE,
    CONSTRAINT chk_repartition_periode_coherence CHECK (fin IS NULL OR debut IS NULL OR debut <= fin)
);
CREATE INDEX IF NOT EXISTS idx_repartition_periode_scenario ON repartition_periode(scenario_id);

CREATE TABLE IF NOT EXISTS repartition_periode_part (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    periode_id UUID         NOT NULL REFERENCES repartition_periode(id) ON DELETE CASCADE,
    membre_id  UUID         NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
    quote_part NUMERIC(9,6) NOT NULL,
    ordre      INT          NOT NULL DEFAULT 0,
    UNIQUE (periode_id, membre_id)
);

-- ─── 3. Migrer repartition_defaut → période ouverte ──────────────────────────
-- Une période ouverte par scénario (debut = annee_depart-01-01, fin = NULL)
INSERT INTO repartition_periode (id, scenario_id, debut, fin)
SELECT
    gen_random_uuid(),
    rd.scenario_id,
    (s.annee_depart || '-01-01')::DATE,
    NULL
FROM (SELECT DISTINCT scenario_id FROM repartition_defaut) rd
JOIN scenario s ON s.id = rd.scenario_id;

-- Parts des périodes migrées
INSERT INTO repartition_periode_part (id, periode_id, membre_id, quote_part, ordre)
SELECT
    gen_random_uuid(),
    rp.id,
    rd.membre_id,
    rd.quote_part,
    (ROW_NUMBER() OVER (PARTITION BY rd.scenario_id ORDER BY rd.id) - 1)::INT
FROM repartition_defaut rd
JOIN repartition_periode rp ON rp.scenario_id = rd.scenario_id;

-- ─── 4a. CUSTOM : parts à 0, 0.5 ou 1 ───────────────────────────────────────
UPDATE poste p
SET type_repartition = 'CUSTOM'
WHERE EXISTS (
    SELECT 1 FROM repartition_poste rp
    WHERE rp.poste_id = p.id
      AND (rp.quote_part = 0 OR rp.quote_part = 0.5 OR rp.quote_part = 1)
);

-- ─── 4b. AUTO : toutes les parts du poste ≈ défaut scénario ─────────────────
WITH auto_candidates AS (
    SELECT p.id AS poste_id,
           COUNT(*) AS total,
           SUM(CASE
               WHEN ABS(rpost.quote_part - rdef.quote_part) < 0.001 THEN 1
               ELSE 0
           END) AS matches
    FROM poste p
    JOIN repartition_poste  rpost ON rpost.poste_id   = p.id
    JOIN repartition_defaut rdef  ON rdef.scenario_id = p.scenario_id
                                 AND rdef.membre_id    = rpost.membre_id
    WHERE p.type_repartition = 'AUTO'  -- déjà classifiés en CUSTOM non retenus
    GROUP BY p.id
)
UPDATE poste SET type_repartition = 'AUTO'
WHERE id IN (SELECT poste_id FROM auto_candidates WHERE matches = total AND total > 0);

-- Supprimer les repartition_poste redondants pour les postes AUTO
DELETE FROM repartition_poste rp
WHERE EXISTS (
    SELECT 1 FROM poste p WHERE p.id = rp.poste_id AND p.type_repartition = 'AUTO'
);

-- ─── 4c. REVERSE_AUTO : toutes les parts ≈ (1 - défaut) / (N - 1) ───────────
WITH member_counts AS (
    SELECT scenario_id, COUNT(*) AS n FROM repartition_defaut GROUP BY scenario_id
),
reverse_candidates AS (
    SELECT p.id AS poste_id,
           COUNT(*) AS total,
           SUM(CASE
               WHEN ABS(rpost.quote_part -
                   (1.0 - rdef.quote_part) / GREATEST(mc.n - 1, 1)) < 0.001
               THEN 1 ELSE 0
           END) AS rev_matches
    FROM poste p
    JOIN repartition_poste  rpost ON rpost.poste_id   = p.id
    JOIN repartition_defaut rdef  ON rdef.scenario_id = p.scenario_id
                                 AND rdef.membre_id    = rpost.membre_id
    JOIN member_counts mc ON mc.scenario_id = p.scenario_id
    WHERE p.type_repartition = 'AUTO'  -- pas encore reclassifiés
    GROUP BY p.id
)
UPDATE poste SET type_repartition = 'REVERSE_AUTO'
WHERE id IN (SELECT poste_id FROM reverse_candidates WHERE rev_matches = total AND total > 0);

-- Supprimer les repartition_poste pour les postes REVERSE_AUTO
DELETE FROM repartition_poste rp
WHERE EXISTS (
    SELECT 1 FROM poste p WHERE p.id = rp.poste_id AND p.type_repartition = 'REVERSE_AUTO'
);

-- ─── 4d. Tout le reste encore AUTO mais avec repartition_poste → CUSTOM ─────
UPDATE poste p
SET type_repartition = 'CUSTOM'
WHERE p.type_repartition = 'AUTO'
  AND EXISTS (SELECT 1 FROM repartition_poste rp WHERE rp.poste_id = p.id);

