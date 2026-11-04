-- Routage comptes de l'argent de poche : même modèle « compte pivot + contreparties
-- au prorata » que les postes (V28), appliqué au SENS REVENU.
--
-- Avant : politique_argent_poche / allocation_argent_poche portaient UN SEUL
-- compte_id — le compte CRÉDITÉ — et la SOURCE du versement était déduite d'un
-- réglage global au membre (compte_membre.est_primaire), exactement le défaut
-- corrigé pour les postes. Impossible donc d'exprimer :
--   * « cet argent de poche est financé depuis le compte joint » (source par
--     politique, et non par membre) ;
--   * un versement éclaté sur PLUSIEURS comptes de poche (ex. 75 % compte perso
--     / 25 % compte loisirs).
--
-- Après : chaque politique/allocation porte un compte PIVOT (le compte SOURCE qui
-- finance le versement) et N lignes de routage (compte, quote_part) qu'il alimente.
-- quote_part somme à 1 par politique/allocation. Une contrepartie confondue avec le
-- pivot est un auto-routage : aucun virement, la dépense reste sur le pivot.

ALTER TABLE politique_argent_poche
    ADD COLUMN compte_pivot_id UUID REFERENCES compte(id);

ALTER TABLE allocation_argent_poche
    ADD COLUMN compte_pivot_id UUID REFERENCES compte(id);

CREATE INDEX idx_politique_poche_compte_pivot
    ON politique_argent_poche (compte_pivot_id);

CREATE INDEX idx_allocation_poche_compte_pivot
    ON allocation_argent_poche (compte_pivot_id);

CREATE TABLE routage_politique_poche (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    politique_id  UUID         NOT NULL REFERENCES politique_argent_poche(id) ON DELETE CASCADE,
    compte_id     UUID         NOT NULL REFERENCES compte(id),
    quote_part    NUMERIC(9,6) NOT NULL CHECK (quote_part > 0 AND quote_part <= 1),

    CONSTRAINT uq_routage_politique_poche UNIQUE (politique_id, compte_id)
);

CREATE TABLE routage_allocation_poche (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id  UUID         NOT NULL REFERENCES allocation_argent_poche(id) ON DELETE CASCADE,
    compte_id      UUID         NOT NULL REFERENCES compte(id),
    quote_part     NUMERIC(9,6) NOT NULL CHECK (quote_part > 0 AND quote_part <= 1),

    CONSTRAINT uq_routage_allocation_poche UNIQUE (allocation_id, compte_id)
);

CREATE INDEX idx_routage_politique_poche_compte
    ON routage_politique_poche (compte_id);

CREATE INDEX idx_routage_allocation_poche_compte
    ON routage_allocation_poche (compte_id);

-- ── Backfill : reproduire À L'IDENTIQUE le comportement de l'ancien simulateur ──
-- L'ancien code versait depuis le compte primaire ACTIF du membre vers compte_id ;
-- à défaut (primaire absent/inactif, ou primaire = compte crédité) il n'émettait
-- aucun virement et imputait la dépense directement sur compte_id.
--   pivot   = compte primaire actif du membre, SINON l'ancien compte_id
--   routage = [(ancien compte_id, 1.0)]
-- Le cas « pas de primaire » devient donc un auto-routage (pivot = contrepartie),
-- qui ne produit aucun virement : comportement inchangé.

INSERT INTO routage_politique_poche (politique_id, compte_id, quote_part)
SELECT p.id, p.compte_id, 1
FROM politique_argent_poche p;

INSERT INTO routage_allocation_poche (allocation_id, compte_id, quote_part)
SELECT a.id, a.compte_id, 1
FROM allocation_argent_poche a;

UPDATE politique_argent_poche p
SET compte_pivot_id = COALESCE(
    (SELECT cm.compte_id
     FROM compte_membre cm
     JOIN compte c ON c.id = cm.compte_id
     WHERE cm.membre_id = p.membre_id AND cm.est_primaire AND c.actif
     LIMIT 1),
    p.compte_id);

UPDATE allocation_argent_poche a
SET compte_pivot_id = COALESCE(
    (SELECT cm.compte_id
     FROM compte_membre cm
     JOIN compte c ON c.id = cm.compte_id
     WHERE cm.membre_id = a.membre_id AND cm.est_primaire AND c.actif
     LIMIT 1),
    a.compte_id);

-- Le compte crédité vit désormais exclusivement dans les tables de routage.
ALTER TABLE politique_argent_poche  DROP COLUMN compte_id;
ALTER TABLE allocation_argent_poche DROP COLUMN compte_id;

-- compte_pivot_id reste NULLABLE pour la même raison que poste.compte_pivot_id :
-- l'obligation est portée par la validation applicative (ArgentPocheService), qui
-- résout un pivot par défaut quand la requête n'en fournit pas.
