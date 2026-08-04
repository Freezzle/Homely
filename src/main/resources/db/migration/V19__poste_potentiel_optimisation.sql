-- Ajoute une note de potentiel d'optimisation du montant du poste, sur une échelle
-- de 1 (non optimisable) à 5 (très optimisable). Champ descriptif uniquement —
-- n'affecte pas le moteur de calcul. Défaut 3 (neutre) pour les postes existants.
ALTER TABLE poste
    ADD COLUMN potentiel_optimisation INTEGER NOT NULL DEFAULT 3
    CHECK (potentiel_optimisation BETWEEN 1 AND 5);
