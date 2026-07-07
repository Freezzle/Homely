-- ============================================================
--  V5__poste_nature.sql — Nature descriptive du poste (EFFECTIF | ANTICIPE)
-- ------------------------------------------------------------
--  Ajoute une colonne `nature` sur `poste` pour distinguer :
--    * EFFECTIF  : charge/revenu/réserve « certain » (loyer, salaire,
--                  cotisation, facture…).
--    * ANTICIPE  : provision pour frais variables estimés (alimentation,
--                  habits, loisirs…).
--
--  Purement descriptif : n'affecte pas les calculs du moteur, sert de
--  filtre pour les tableaux de bord et les futurs stress-tests.
--
--  Valeur par défaut EFFECTIF pour tous les postes existants ;
--  l'utilisateur peut ensuite requalifier les postes anticipés via l'UI.
-- ============================================================

ALTER TABLE poste
    ADD COLUMN nature VARCHAR(16) NOT NULL DEFAULT 'EFFECTIF'
        CHECK (nature IN ('EFFECTIF', 'PREVISION'));

CREATE INDEX idx_poste_nature ON poste (nature);


