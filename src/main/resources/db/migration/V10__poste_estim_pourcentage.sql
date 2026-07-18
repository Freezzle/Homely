-- ============================================================
--  V10__poste_estim_pourcentage.sql — Ajouter estimation % aux postes
-- ============================================================
--  Ajoute une colonne `estim_pourcentage` sur `poste` pour les estimations.
--  Les postes avec nature='ESTIMATION' reçoivent par défaut 10.0%.
--  Les autres postes conservent NULL.
--  Colonne nullable pour les postes EFFECTIF.
-- ============================================================

ALTER TABLE poste
    ADD COLUMN estim_pourcentage NUMERIC(3, 1);

-- Remplir les postes ESTIMATION existants avec 10.0%
UPDATE poste
SET estim_pourcentage = 10.0
WHERE nature = 'ESTIMATION';

