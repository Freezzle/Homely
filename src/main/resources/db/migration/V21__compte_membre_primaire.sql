-- Le compte primaire devient un attribut de la relation compte↔membre
-- (compte_membre.est_primaire) plutôt qu'une colonne unique sur membre : un
-- compte peut être primaire pour plusieurs co-titulaires, mais un membre ne
-- peut avoir qu'un seul compte primaire (contrainte unique partielle ci-dessous).
ALTER TABLE compte_membre
    ADD COLUMN est_primaire BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill depuis l'ancienne colonne membre.compte_primaire_id
UPDATE compte_membre cm
SET est_primaire = TRUE
FROM membre m
WHERE m.compte_primaire_id = cm.compte_id
  AND m.id = cm.membre_id;

-- Un seul compte primaire par membre (garde-fou DB en plus de la validation service)
CREATE UNIQUE INDEX idx_compte_membre_primaire_unique
    ON compte_membre (membre_id)
    WHERE est_primaire = TRUE;

ALTER TABLE membre
    DROP COLUMN compte_primaire_id;
