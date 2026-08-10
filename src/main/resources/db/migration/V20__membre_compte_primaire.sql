-- Compte primaire par membre : le compte "source" qui finance les virements
-- entrants planifiés/de comblement des autres comptes de ce membre (T-recap
-- mensuel par compte, dashboard). Un seul compte primaire par membre (colonne
-- unique, pas de table de jointure). Nullable : mode "legacy" (aucune logique
-- de virements inter-comptes) tant qu'aucun primaire n'est configuré.
ALTER TABLE membre
    ADD COLUMN compte_primaire_id UUID NULL REFERENCES compte(id) ON DELETE SET NULL;
