-- Suppression de la notion d'objectifs d'épargne et du type de catégorie PROJET.
-- Décision produit : la fonctionnalité "Objectifs" est retirée de l'application, ainsi
-- que la classification de catégorie PROJET (qui n'était utilisée que par les objectifs).

-- 1. Table des objectifs (ses FK vers categorie/compte/actif disparaissent avec elle).
DROP TABLE IF EXISTS objectif;

-- 2. Catégories de type PROJET : les postes éventuellement rattachés repassent
--    categorie_id = NULL grâce au ON DELETE SET NULL défini sur poste.categorie_id (V11).
DELETE FROM categorie WHERE type_poste = 'PROJET';

-- 3. Contrainte CHECK de categorie.type_poste sans la valeur PROJET.
ALTER TABLE categorie DROP CONSTRAINT IF EXISTS categorie_type_poste_check;
ALTER TABLE categorie ADD CONSTRAINT categorie_type_poste_check
    CHECK (type_poste IN ('REVENU', 'CHARGE', 'RESERVE'));
