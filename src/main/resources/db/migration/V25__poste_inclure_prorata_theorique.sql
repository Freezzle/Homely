-- Ajoute un indicateur permettant d'exclure un poste REVENU du calcul du prorata
-- théorique des membres (part de revenus de chacun dans le total du foyer, utilisée
-- par l'indicateur "Prorata des postes partagés" du dashboard — cf.
-- ProjectionService#prorataPartageInterne). Pertinent uniquement pour les foyers à
-- plusieurs membres et les postes de type REVENU ; champ non affiché sinon côté UI.
-- Défaut true (comportement inchangé) pour les postes existants.
ALTER TABLE poste
    ADD COLUMN inclure_prorata_theorique BOOLEAN NOT NULL DEFAULT true;
