-- Ajoute une note de dérive externe attendue sur le montant du poste, sur une
-- échelle de 1 (forte baisse attendue) à 5 (forte hausse attendue), avec 3
-- comme valeur neutre (« aucune variation attendue »). Représente la direction
-- et l'intensité de la dérive de montant hors du contrôle de l'utilisateur
-- (ex. indexation, hausse de prix imposée, tarifs négociés à la baisse).
-- Champ descriptif uniquement — n'affecte pas le moteur de calcul.
-- Défaut 3 (aucune variation) pour les postes existants.
ALTER TABLE poste
    ADD COLUMN derive_externe INTEGER NOT NULL DEFAULT 3
    CHECK (derive_externe BETWEEN 1 AND 5);
