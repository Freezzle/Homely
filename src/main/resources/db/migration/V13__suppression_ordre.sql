-- Suppression de la notion d'ordre manuel pour Membre, Compte, Categorie, Actif.
-- Le tri est désormais automatique (libellé/nom, ou typePoste+libellé pour Categorie).
ALTER TABLE membre DROP COLUMN ordre;
ALTER TABLE compte DROP COLUMN ordre;
ALTER TABLE categorie DROP COLUMN ordre;
ALTER TABLE actif DROP COLUMN ordre;
