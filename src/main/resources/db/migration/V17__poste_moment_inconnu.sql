-- Ajoute la valeur INCONNU à l'énumération moment (poste dont la date de paiement
-- effective n'est pas connue — ex. "dentiste 1x/an"). Ce choix impose mode=MENSUALISE,
-- validé côté application (PosteService).
ALTER TABLE poste DROP CONSTRAINT poste_moment_check;
ALTER TABLE poste ADD CONSTRAINT poste_moment_check
    CHECK (moment IN ('DEBUT_PERIODE','FIN_PERIODE','INCONNU'));
