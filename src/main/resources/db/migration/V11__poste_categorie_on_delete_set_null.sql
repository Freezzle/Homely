-- ============================================================
--  V11__poste_categorie_on_delete_set_null.sql
--  Permet la suppression en cascade d'un foyer sans blocage FK
-- ============================================================
-- poste.categorie_id est optionnel ; si une catégorie disparaît,
-- le poste est conservé et dissocié de la catégorie.

ALTER TABLE poste
    DROP CONSTRAINT IF EXISTS poste_categorie_id_fkey;

ALTER TABLE poste
    ADD CONSTRAINT poste_categorie_id_fkey
        FOREIGN KEY (categorie_id)
        REFERENCES categorie(id)
        ON DELETE SET NULL;

