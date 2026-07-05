-- ============================================================
--  V3__refresh_tokens.sql — Table des refresh tokens JWT
-- ============================================================
CREATE TABLE token_refresh (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    utilisateur_id UUID         NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
    token          VARCHAR(512) NOT NULL UNIQUE,
    expire_a       TIMESTAMPTZ  NOT NULL,
    revoque        BOOLEAN      NOT NULL DEFAULT FALSE,
    date_creation  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_token_refresh_utilisateur ON token_refresh (utilisateur_id);
