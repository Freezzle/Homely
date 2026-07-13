-- ═══════════════════════════════════════════════════════════════════════════════
-- V8 — Relation N-N compte ↔ membre + suppression type_compte + compte_source
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Table de liaison compte_membre ────────────────────────────────────────
CREATE TABLE compte_membre (
    compte_id UUID NOT NULL REFERENCES compte(id) ON DELETE CASCADE,
    membre_id UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
    CONSTRAINT pk_compte_membre PRIMARY KEY (compte_id, membre_id)
);
CREATE INDEX idx_compte_membre_compte ON compte_membre (compte_id);
CREATE INDEX idx_compte_membre_membre ON compte_membre (membre_id);

-- ── 2. Backfill : rattacher chaque compte à tous les membres actifs du foyer ─
INSERT INTO compte_membre (compte_id, membre_id)
SELECT c.id, m.id
FROM   compte  c
JOIN   membre  m ON m.foyer_id = c.foyer_id
WHERE  c.actif = TRUE;

-- ── 3. Suppression colonne type du compte (remplacée par la relation N-N) ────
ALTER TABLE compte DROP COLUMN IF EXISTS type;

-- ── 4. Suppression colonne compte_source du poste (portée par ventilation) ──
ALTER TABLE poste DROP COLUMN IF EXISTS compte_source;

