-- ═══════════════════════════════════════════════════════════════════════════════
-- V9 — Suppression des ventilation_compte pour les membres à 0% dans les postes
--       CUSTOM (repartition_poste.quote_part = 0)
-- ═══════════════════════════════════════════════════════════════════════════════

DELETE FROM ventilation_compte vc
WHERE EXISTS (
    SELECT 1
    FROM   repartition_poste rp
    WHERE  rp.poste_id  = vc.poste_id
    AND    rp.membre_id = vc.membre_id
    AND    rp.quote_part = 0
);

