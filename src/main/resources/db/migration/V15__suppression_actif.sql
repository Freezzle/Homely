-- ============================================================
--  V15__suppression_actif.sql — Suppression de la notion d'actif
--  patrimonial (entité Actif). Un objectif référence désormais
--  obligatoirement un compte.
-- ============================================================

ALTER TABLE objectif DROP CONSTRAINT chk_support_objectif;
ALTER TABLE objectif DROP COLUMN actif_id;
ALTER TABLE objectif ALTER COLUMN compte_id SET NOT NULL;

DROP TABLE actif;
