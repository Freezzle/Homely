-- ============================================================
--  V26__poste_source_poste_id.sql
--  Lien stable entre un poste et le poste dont il est issu par
--  duplication de scénario (comparaison de scénarios, feature_5_bis §9).
-- ============================================================
-- source_poste_id : id du poste "racine" dont ce poste est une copie
-- (transitif : si A est dupliqué en B puis B en C, C.source_poste_id = A.id,
-- pas B.id — cf. ScenarioService#dupliquerPostes). Pointe potentiellement
-- vers un poste d'un autre scénario, y compris un scénario supprimé entre
-- temps : volontairement PAS de contrainte de clé étrangère (le poste source
-- peut disparaître sans que la copie ne soit affectée), juste un index pour
-- les recherches d'appariement.
ALTER TABLE poste
    ADD COLUMN source_poste_id UUID NULL;

CREATE INDEX idx_poste_source_poste_id ON poste(source_poste_id);
