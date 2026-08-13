-- ============================================================
--  V23__allocation_argent_poche.sql
--  Allocation ponctuelle d'argent de poche (exception mois précis).
--  Prime sur le calcul de la politique éventuellement active.
-- ============================================================

CREATE TABLE allocation_argent_poche (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id    UUID          NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
    membre_id      UUID          NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
    compte_id      UUID          NOT NULL REFERENCES compte(id),
    mois           DATE          NOT NULL,
    montant        NUMERIC(15,2) NOT NULL CHECK (montant >= 0),
    raison         VARCHAR(255),
    date_creation  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    date_modif     TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uq_allocation_poche_scenario_membre_mois
        UNIQUE (scenario_id, membre_id, mois)
);

CREATE INDEX idx_allocation_poche_scenario_mois
    ON allocation_argent_poche (scenario_id, mois);
