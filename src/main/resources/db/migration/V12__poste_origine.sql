-- ============================================================
--  V12__poste_origine.sql
--  Chaînage des postes issus d'une révision de montant planifiée.
-- ============================================================
-- poste_origine_id : référence le poste dont ce poste est issu
-- (révision de montant). Si le poste d'origine est supprimé,
-- le lien est simplement rompu (SET NULL), le poste survit.

ALTER TABLE poste
    ADD COLUMN poste_origine_id UUID NULL;

ALTER TABLE poste
    ADD CONSTRAINT poste_origine_id_fkey
        FOREIGN KEY (poste_origine_id)
        REFERENCES poste(id)
        ON DELETE SET NULL;

CREATE INDEX idx_poste_origine_id ON poste(poste_origine_id);
