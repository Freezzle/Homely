-- Routage comptes d'un poste : modèle « compte pivot + contreparties au prorata ».
--
-- Avant : ventilation_compte portait UN SEUL compte par (poste, membre) — le compte
-- cible — et la SOURCE des virements était déduite d'un réglage global au membre
-- (compte_membre.est_primaire). Impossible donc d'exprimer :
--   * un membre qui éclate sa part sur PLUSIEURS de ses comptes (ex. allocations
--     reçues sur compte 1, redistribuées 60% sur compte 2 / 40% sur compte 3) ;
--   * une source propre à UN poste (« cette facture-ci part de mon épargne »).
--
-- Après : chaque poste porte un compte PIVOT (le compte où la transaction a
-- physiquement lieu : débité pour une CHARGE/RESERVE, crédité pour un REVENU) et
-- N lignes de routage (membre, compte, quote_part) qui l'alimentent (CHARGE/RESERVE)
-- ou qu'il alimente (REVENU). quote_part est la part DANS la part du membre
-- (somme = 1 par membre ayant une part non nulle).

ALTER TABLE poste
    ADD COLUMN compte_pivot_id UUID REFERENCES compte(id);

CREATE INDEX idx_poste_compte_pivot ON poste (compte_pivot_id);

ALTER TABLE ventilation_compte
    ADD COLUMN quote_part NUMERIC(9,6) NOT NULL DEFAULT 1;

-- Plusieurs comptes par (poste, membre) désormais autorisés.
ALTER TABLE ventilation_compte
    DROP CONSTRAINT ventilation_compte_poste_id_membre_id_key;

ALTER TABLE ventilation_compte
    ADD CONSTRAINT ventilation_compte_poste_membre_compte_key
        UNIQUE (poste_id, membre_id, compte_id);

-- ── Backfill du pivot (règle déterministe) ────────────────────────────────
-- 1) Poste ventilé → compte du membre ayant la plus grosse quote-part
--    (départage stable par membre_id ; quote-part absente = 0 pour AUTO/REVERSE_AUTO).
WITH candidat AS (
    SELECT DISTINCT ON (vc.poste_id) vc.poste_id, vc.compte_id
    FROM ventilation_compte vc
    LEFT JOIN repartition_poste rp
           ON rp.poste_id = vc.poste_id AND rp.membre_id = vc.membre_id
    ORDER BY vc.poste_id, COALESCE(rp.quote_part, 0) DESC, vc.membre_id
)
UPDATE poste p
SET compte_pivot_id = c.compte_id
FROM candidat c
WHERE c.poste_id = p.id;

-- 2) Sinon → compte primaire du membre majoritaire du poste.
WITH majoritaire AS (
    SELECT DISTINCT ON (rp.poste_id) rp.poste_id, rp.membre_id
    FROM repartition_poste rp
    ORDER BY rp.poste_id, rp.quote_part DESC, rp.membre_id
)
UPDATE poste p
SET compte_pivot_id = cm.compte_id
FROM majoritaire mj
JOIN compte_membre cm ON cm.membre_id = mj.membre_id AND cm.est_primaire
WHERE mj.poste_id = p.id
  AND p.compte_pivot_id IS NULL;

-- 3) Sinon → premier compte actif du foyer (ordre stable : libellé puis id, le tri des
--    comptes étant automatique par libellé depuis V13).
WITH premier AS (
    SELECT DISTINCT ON (c.foyer_id) c.foyer_id, c.id
    FROM compte c
    WHERE c.actif
    ORDER BY c.foyer_id, c.libelle, c.id
)
UPDATE poste p
SET compte_pivot_id = pr.id
FROM scenario s
JOIN premier pr ON pr.foyer_id = s.foyer_id
WHERE p.scenario_id = s.id
  AND p.compte_pivot_id IS NULL;

-- Volontairement laissé NULLABLE en base : un foyer peut n'avoir aucun compte actif
-- (cas limite non couvert par les 3 règles ci-dessus). L'obligation du pivot est
-- portée par la validation applicative (PosteService / PosteRequest), et le moteur
-- retombe sur le compte primaire du membre quand le pivot est absent.
