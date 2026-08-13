-- ============================================================
--  V22__politique_argent_poche.sql
--  Politique récurrente d'argent de poche par membre, scopée
--  scénario. Mode VARIABLE (socle + % surplus, plafonné) ou FIXE.
-- ============================================================

CREATE TABLE politique_argent_poche (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id    UUID          NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
    membre_id      UUID          NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
    compte_id      UUID          NOT NULL REFERENCES compte(id),
    nom            VARCHAR(160)  NOT NULL,
    date_debut     DATE          NOT NULL,
    date_fin       DATE,
    mode           VARCHAR(16)   NOT NULL CHECK (mode IN ('VARIABLE', 'FIXE')),
    socle          NUMERIC(15,2),
    pourcentage    NUMERIC(5,2),
    plafond        NUMERIC(15,2),
    montant_fixe   NUMERIC(15,2),
    date_creation  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    date_modif     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT chk_politique_poche_periode
        CHECK (date_fin IS NULL OR date_fin >= date_debut),

    CONSTRAINT chk_politique_poche_mode_variable
        CHECK (mode <> 'VARIABLE' OR (
            socle IS NOT NULL AND socle >= 0
            AND pourcentage IS NOT NULL AND pourcentage BETWEEN 0 AND 100
            AND plafond IS NOT NULL AND plafond >= socle
        )),

    CONSTRAINT chk_politique_poche_mode_fixe
        CHECK (mode <> 'FIXE' OR (
            montant_fixe IS NOT NULL AND montant_fixe >= 0
        ))
);

CREATE INDEX idx_politique_poche_scenario_membre
    ON politique_argent_poche (scenario_id, membre_id, date_debut);
