-- ============================================================
--  V14__drop_repartition_defaut.sql
--  Supprime la table legacy repartition_defaut : la répartition
--  d'un scénario est désormais exclusivement portée par
--  repartition_periode (période ouverte, fin = null), déjà
--  alimentée depuis V7__repartition_periode.sql.
-- ============================================================

DROP TABLE IF EXISTS repartition_defaut;
