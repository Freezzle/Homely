-- Ajoute une note d'importance « vitale » du poste sur une échelle de 1 (non vital)
-- à 5 (vital). Champ descriptif uniquement — n'affecte pas le moteur de calcul.
-- Défaut 3 (neutre) pour les postes existants.
ALTER TABLE poste
    ADD COLUMN importance INTEGER NOT NULL DEFAULT 3
    CHECK (importance BETWEEN 1 AND 5);
