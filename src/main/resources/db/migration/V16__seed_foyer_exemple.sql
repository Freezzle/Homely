-- ============================================================
--  V16__seed_foyer_exemple.sql
--  Second foyer de démonstration « Foyer Berthoud », anonymisé,
--  reproduisant fidèlement la structure d'un foyer réel :
--  membres, comptes, catégories, scénario, répartitions par
--  période, postes, overrides de répartition (CUSTOM) et
--  ventilations par compte.
--
--  Anonymisation appliquée :
--   * Prénoms des membres remplacés (Alex / Camille).
--   * Nom du foyer et libellés de comptes/postes trop
--     identifiants remplacés par des libellés génériques.
--   * Montants variés de ±5 à 15 % (arrondis) par rapport
--     aux données source, pour ne pas reproduire au centime
--     les finances réelles d'un foyer utilisateur.
--
--  Tous les identifiants sont des UUID v4 générés une seule
--  fois (littéraux ci-dessous, pour une migration Flyway
--  déterministe et reproductible).
-- ============================================================

-- ── Foyer ─────────────────────────────────────────────────
INSERT INTO foyer (id, nom, devise_base) VALUES
    ('2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Foyer Berthoud', 'CHF');

-- ── Membres ───────────────────────────────────────────────
INSERT INTO membre (id, foyer_id, nom, couleur) VALUES
    ('84b16f70-13c5-43de-a330-623f7f9c9156', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Alex', '#8cdb8e'),
    ('4d542796-bd9f-46a8-a3f2-440b8afebe70', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Camille', '#dde64c');

-- ── Comptes ───────────────────────────────────────────────
INSERT INTO compte (id, foyer_id, libelle, solde_initial, devise) VALUES
    ('08d0bddb-da33-4d3f-8ee8-47e8f0973a55', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Compte courant', 35575, 'CHF'),
    ('81ee9635-eba5-440c-9f74-80c1ef4f17e5', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Compte épargne', 7925, 'CHF'),
    ('4a634ade-f6f0-47d2-b2f5-1b56aeaa8967', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Compte commun', 0, 'CHF'),
    ('024274b2-59bd-4a3e-bb27-19c1db151145', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Compte enfant', 0, 'CHF'),
    ('f1077c0e-07ec-418a-a243-5dfbaff42953', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Compte voyage', 1075, 'CHF'),
    ('a4f4c7a9-83f8-42f3-a87d-a13abaceb8a6', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Compte privé', 1195, 'CHF'),
    ('6199c9a0-9601-4069-ad74-d80e1553003c', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Compte courant', 0, 'CHF'),
    ('71181dfe-7323-4eed-b19e-77591400ab53', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Compte épargne', 0, 'CHF');

-- ── Rattachement comptes ↔ membres ────────────────────────
INSERT INTO compte_membre (compte_id, membre_id) VALUES
    ('08d0bddb-da33-4d3f-8ee8-47e8f0973a55', '84b16f70-13c5-43de-a330-623f7f9c9156'),
    ('81ee9635-eba5-440c-9f74-80c1ef4f17e5', '84b16f70-13c5-43de-a330-623f7f9c9156'),
    ('4a634ade-f6f0-47d2-b2f5-1b56aeaa8967', '84b16f70-13c5-43de-a330-623f7f9c9156'),
    ('4a634ade-f6f0-47d2-b2f5-1b56aeaa8967', '4d542796-bd9f-46a8-a3f2-440b8afebe70'),
    ('024274b2-59bd-4a3e-bb27-19c1db151145', '4d542796-bd9f-46a8-a3f2-440b8afebe70'),
    ('024274b2-59bd-4a3e-bb27-19c1db151145', '84b16f70-13c5-43de-a330-623f7f9c9156'),
    ('f1077c0e-07ec-418a-a243-5dfbaff42953', '84b16f70-13c5-43de-a330-623f7f9c9156'),
    ('a4f4c7a9-83f8-42f3-a87d-a13abaceb8a6', '84b16f70-13c5-43de-a330-623f7f9c9156'),
    ('6199c9a0-9601-4069-ad74-d80e1553003c', '4d542796-bd9f-46a8-a3f2-440b8afebe70'),
    ('71181dfe-7323-4eed-b19e-77591400ab53', '4d542796-bd9f-46a8-a3f2-440b8afebe70');

-- ── Catégories ────────────────────────────────────────────
INSERT INTO categorie (id, foyer_id, libelle, type_poste) VALUES
    ('f64260a2-d460-4c78-9c55-55f45392d3f4', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Santé', 'CHARGE'),
    ('4129acfa-25a6-46d8-bd34-b8e7f0f87bcd', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Aide / Subvention', 'REVENU'),
    ('2ad7cacf-6516-4057-a841-24d8dd0b2f33', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', '3ème pilier', 'RESERVE'),
    ('fe519607-0a1b-4a30-971d-dcda7ef1f0ab', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Argent mis de côté', 'RESERVE'),
    ('182718c0-7d25-4b3a-93e3-6c4323fe9007', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Prime / Bonus', 'REVENU'),
    ('4e5a5a0d-bcf4-4cb6-ae69-c1752d583cea', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Impôts', 'CHARGE'),
    ('e928f017-2338-4c7a-88f6-90dabcb8cddf', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Autre', 'CHARGE'),
    ('ac4c5cd5-b572-4315-90a7-d590b80edbb7', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Loisirs', 'CHARGE'),
    ('c9be80f2-ba51-4c02-8758-77ee28295599', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Transport', 'CHARGE'),
    ('6c7e6d28-0dc2-4c7a-b090-d351459fd863', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Revenu passif', 'REVENU'),
    ('9b25e8e2-bc43-4ca6-b2bd-3cd7f540a49e', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Enfant', 'CHARGE'),
    ('80f42dff-ba03-4b27-a690-2b24d7439895', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Salaire', 'REVENU'),
    ('9020ae8e-b701-4037-bc1e-0306dc5020cc', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Investissement', 'RESERVE'),
    ('2ab3bc91-844f-4286-91a2-ef71ddabc711', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Animaux', 'CHARGE'),
    ('bda80934-6d4b-473f-af7b-600d68124e8c', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Epargne', 'RESERVE'),
    ('3be1b179-2a86-420b-8921-b07e35bdc154', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Abonnements', 'CHARGE'),
    ('e080cf92-9270-46f3-a359-ae95d6db0269', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Alimentation', 'CHARGE'),
    ('60b687b8-655e-4cd2-915d-53914ad0b6c5', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Foyer', 'CHARGE'),
    ('950537c3-130b-4338-ade9-ad87f4eb11cb', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Vacances', 'RESERVE'),
    ('73c840f3-7303-427d-8927-56385a0cd19d', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Frais administratif', 'CHARGE');

-- ── Scénario de référence ─────────────────────────────────
INSERT INTO scenario (id, foyer_id, nom, est_reference, annee_depart, tresorerie_initiale, horizon_annees) VALUES
    ('5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'Vie quotidienne', TRUE, 2026, 0, 25);

-- ── Périodes de répartition (quotes-parts évolutives) ─────
INSERT INTO repartition_periode (id, scenario_id, debut, fin) VALUES
    ('bfe97e02-f3aa-4153-b02a-e4d9a3586858', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', '2026-01-01', '2026-07-31'),
    ('e5dea75f-d83c-440d-bfdb-6abbc58d81a5', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', '2026-08-01', '2027-07-31'),
    ('4d14a0fa-e08f-4601-b946-d276f63b1a8a', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', '2027-08-01', NULL);

INSERT INTO repartition_periode_part (id, periode_id, membre_id, quote_part, ordre) VALUES
    (gen_random_uuid(), 'bfe97e02-f3aa-4153-b02a-e4d9a3586858', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 0.42, 1),
    (gen_random_uuid(), 'bfe97e02-f3aa-4153-b02a-e4d9a3586858', '84b16f70-13c5-43de-a330-623f7f9c9156', 0.58, 0),
    (gen_random_uuid(), 'e5dea75f-d83c-440d-bfdb-6abbc58d81a5', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 0.4, 1),
    (gen_random_uuid(), 'e5dea75f-d83c-440d-bfdb-6abbc58d81a5', '84b16f70-13c5-43de-a330-623f7f9c9156', 0.6, 0),
    (gen_random_uuid(), '4d14a0fa-e08f-4601-b946-d276f63b1a8a', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 0.38, 1),
    (gen_random_uuid(), '4d14a0fa-e08f-4601-b946-d276f63b1a8a', '84b16f70-13c5-43de-a330-623f7f9c9156', 0.62, 0);

-- ════════════════════════════════════════════════════════════
--  POSTES (montants variés ±5-15% par rapport aux données
--  source ; libellés trop identifiants anonymisés)
-- ════════════════════════════════════════════════════════════
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, devise, periodicite_mois, debut, fin, mode, moment, nature, estim_pourcentage, type_repartition) VALUES
    ('f8bb7c26-dd14-4a5b-a60d-bc833bea0365', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Activité annexe', '182718c0-7d25-4b3a-93e3-6c4323fe9007', 440, NULL, 12, '2026-03-30', NULL, 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('7fd4140c-7426-45f9-a3ef-5db197278504', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', '13ème salaire', '80f42dff-ba03-4b27-a690-2b24d7439895', 6420, NULL, 12, '2022-11-30', '2024-10-31', 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('ae2dd62c-0374-49af-aca8-8476236bf3f4', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Salaire net (100%)', '80f42dff-ba03-4b27-a690-2b24d7439895', 6520, NULL, 1, '2022-01-01', '2024-03-31', 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('14f01a19-8026-4ac2-91c2-8d9949c23ad8', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Salaire net (90%)', '80f42dff-ba03-4b27-a690-2b24d7439895', 5955, NULL, 1, '2024-04-01', '2026-03-31', 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('5c592efb-f9ee-4cd8-b549-2f443f667920', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Imprévus', 'e928f017-2338-4c7a-88f6-90dabcb8cddf', 740, NULL, 12, '2025-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'CUSTOM'),
    ('0501e8ed-0bc0-4a5e-b380-b1bc53e49205', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Besoins de l''enfant', '9b25e8e2-bc43-4ca6-b2bd-3cd7f540a49e', 610, NULL, 1, '2027-08-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'AUTO'),
    ('3665b41b-736c-43c3-8e91-e581ec089c8a', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Frais grossesse et naissance', '9b25e8e2-bc43-4ca6-b2bd-3cd7f540a49e', 120, 'CHF', 1, '2026-01-01', '2026-07-30', 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('2b3b3004-fa45-4360-94fd-c01c736dfdc9', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Revenu locatif (garanti)', '6c7e6d28-0dc2-4c7a-b090-d351459fd863', 4665, NULL, 12, '2032-11-01', '2033-10-31', 'PERIODIQUE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'CUSTOM'),
    ('c81a4e63-9833-4413-8fab-ca19aeb33f54', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Revenu locatif (garanti)', '6c7e6d28-0dc2-4c7a-b090-d351459fd863', 4295, NULL, 12, '2033-11-01', '2050-11-30', 'PERIODIQUE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'CUSTOM'),
    ('eb5430d4-9a4b-4c23-9c7d-d5390cbe2c22', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Revenu locatif (garanti)', '6c7e6d28-0dc2-4c7a-b090-d351459fd863', 1135, NULL, 12, '2027-11-01', '2028-10-31', 'PERIODIQUE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'CUSTOM'),
    ('f1a5549e-9374-4865-9b8a-d7de61530497', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Revenu locatif (garanti)', '6c7e6d28-0dc2-4c7a-b090-d351459fd863', 1670, NULL, 12, '2028-11-01', '2029-10-31', 'PERIODIQUE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'CUSTOM'),
    ('30badb4b-c171-461e-ba4b-52271bc850d6', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Frais grossesse et naissance', '9b25e8e2-bc43-4ca6-b2bd-3cd7f540a49e', 185, NULL, 1, '2026-01-01', '2026-07-30', 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('f4d19d10-3355-4607-9f9e-bb8f873ed446', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', '13ème salaire', '80f42dff-ba03-4b27-a690-2b24d7439895', 5920, NULL, 12, '2024-11-01', '2026-10-31', 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('88b50ec5-a95a-4d68-9dd7-18dc8d9f2bb2', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Équipement enfant', '9b25e8e2-bc43-4ca6-b2bd-3cd7f540a49e', 320, 'CHF', 1, '2026-08-01', '2027-07-31', 'MENSUALISE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'AUTO'),
    ('f23d2c1b-e648-4f7f-981b-49e40c5573cf', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Salaire net', '80f42dff-ba03-4b27-a690-2b24d7439895', 3740, 'CHF', 1, '2026-07-01', '2026-12-31', 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('69944cf4-9200-42f2-b468-f241fc276ed9', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Impôt', '4e5a5a0d-bcf4-4cb6-ae69-c1752d583cea', 16065, NULL, 12, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'CUSTOM'),
    ('ce585966-5e66-4b64-b985-4a123455df3d', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Impôts', '4e5a5a0d-bcf4-4cb6-ae69-c1752d583cea', 430, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'CUSTOM'),
    ('23eb3410-6dd4-4076-820e-2c9cc7590c6d', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Dentiste', 'f64260a2-d460-4c78-9c55-55f45392d3f4', 110, NULL, 12, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'CUSTOM'),
    ('46a7be83-5fc4-4da3-abc0-d1b4ec5db509', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Revenu locatif (garanti)', '6c7e6d28-0dc2-4c7a-b090-d351459fd863', 425, NULL, 12, '2026-11-30', '2027-10-31', 'PERIODIQUE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'CUSTOM'),
    ('497619c1-c7a8-4a24-9f8b-5e3132f3215f', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Revenu locatif (garanti)', '6c7e6d28-0dc2-4c7a-b090-d351459fd863', 1850, NULL, 12, '2029-11-01', '2030-10-31', 'PERIODIQUE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'CUSTOM'),
    ('41d92a29-ae56-495c-8ad3-656fc6e0f5a2', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Revenu locatif (garanti)', '6c7e6d28-0dc2-4c7a-b090-d351459fd863', 3125, NULL, 12, '2030-11-01', '2031-10-31', 'PERIODIQUE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'CUSTOM'),
    ('c4e21f02-9051-4af8-850e-99410bc1fa1c', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Natel', '3be1b179-2a86-420b-8921-b07e35bdc154', 34, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('0dcdae49-8a91-4a56-9c96-a316846fde5b', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'RESERVE', '3ème pilier B', '2ad7cacf-6516-4057-a841-24d8dd0b2f33', 97, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('c8ff22a8-f56d-423e-9074-a2f2a7d498e4', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Scooter essences', 'c9be80f2-ba51-4c02-8758-77ee28295599', 13, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'AUTO'),
    ('be22f344-707e-4723-84a6-adb4db86b344', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Prime Poste Employé', '182718c0-7d25-4b3a-93e3-6c4323fe9007', 500, NULL, 12, '2026-04-01', NULL, 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('b8001c9a-e7b9-479e-9924-eb1643d4eafc', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Frais compte joint', '73c840f3-7303-427d-8927-56385a0cd19d', 3, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('173072dc-e1e7-4cb1-b145-3bba33083e78', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'RESERVE', 'Argent de poche', 'fe519607-0a1b-4a30-971d-dcda7ef1f0ab', 745, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', 10.0, 'CUSTOM'),
    ('127c5ba4-fca1-4ad0-bffe-510052e4f82e', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Salaire net', '80f42dff-ba03-4b27-a690-2b24d7439895', 4660, NULL, 1, '2024-01-01', '2026-06-30', 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('ed859ba3-38ba-4f5d-bc09-fe013e20c512', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', '13ème salaire', '80f42dff-ba03-4b27-a690-2b24d7439895', 6220, NULL, 12, '2026-11-01', NULL, 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('2f38ee99-f337-4712-b5a2-105b0daf6b2d', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Scooter plaques', 'c9be80f2-ba51-4c02-8758-77ee28295599', 130, NULL, 12, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('08f49d29-9ff8-4082-8777-01af08cdb159', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Scooter assurances', 'c9be80f2-ba51-4c02-8758-77ee28295599', 450, NULL, 12, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('c4e21421-a7a2-4eec-a598-a015626675bf', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Salaire net (90%)', '80f42dff-ba03-4b27-a690-2b24d7439895', 5480, NULL, 1, '2026-04-01', NULL, 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('51260cf4-4d6b-4df7-ba5a-099bdde50491', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Allocation familiale', '4129acfa-25a6-46d8-bd34-b8e7f0f87bcd', 230, 'CHF', 1, '2026-08-01', NULL, 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('8f075f44-3f8a-49a6-bab6-ab5a7f45ec91', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'RESERVE', 'Argent de poche', 'fe519607-0a1b-4a30-971d-dcda7ef1f0ab', 1325, NULL, 1, '2026-01-01', '2026-12-31', 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('c8164498-6491-4762-baa9-23b962608824', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Salaire net', '80f42dff-ba03-4b27-a690-2b24d7439895', 3755, 'CHF', 1, '2027-01-01', NULL, 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('ca24fec4-6eb2-453e-b49f-27615a7d7c95', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'RESERVE', 'Argent de poche', 'fe519607-0a1b-4a30-971d-dcda7ef1f0ab', 1020, 'CHF', 1, '2027-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('4fbe6ed3-8a94-41af-bcf0-42f1d56e8299', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Assurance ménage', '60b687b8-655e-4cd2-915d-53914ad0b6c5', 845, 'CHF', 12, '2026-09-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('fae581ad-3dea-465e-9653-2c14f5b7db58', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Frais carte voyage', '73c840f3-7303-427d-8927-56385a0cd19d', 115, NULL, 12, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('e1cc77a3-53b4-4d10-9649-d8d866fe60e0', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Bancaire', '73c840f3-7303-427d-8927-56385a0cd19d', 14, NULL, 1, '2024-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('d47a0daf-7122-4be5-9d5c-e2bdb4db2421', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Foot en salle', 'ac4c5cd5-b572-4315-90a7-d590b80edbb7', 165, NULL, 12, '2024-06-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('9996257f-13f3-4938-923f-11a99c84753d', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Stockage cloud', '3be1b179-2a86-420b-8921-b07e35bdc154', 6, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('2aaf2f15-4f34-4a82-8665-6b47e4d6971a', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Assurance maladie - Assura', 'f64260a2-d460-4c78-9c55-55f45392d3f4', 445, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('d97f3d7e-22db-48df-a0c0-28f89cd99a2e', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'RESERVE', 'Investissement B', '9020ae8e-b701-4037-bc1e-0306dc5020cc', 98, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('32b85dd6-99a2-4ebd-b125-3540033bf6f0', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'RESERVE', '3ème pilier A', '9020ae8e-b701-4037-bc1e-0306dc5020cc', 85, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('2a177347-ebe5-41aa-b2e9-31d31e1044b6', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'REVENU', 'Revenu locatif (garanti)', '6c7e6d28-0dc2-4c7a-b090-d351459fd863', 3525, NULL, 12, '2031-11-01', '2032-10-31', 'PERIODIQUE', 'DEBUT_PERIODE', 'ESTIMATION', 10.0, 'CUSTOM'),
    ('2f2431b9-4a6b-4794-a60b-16502d2b2f93', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Streaming musique', '3be1b179-2a86-420b-8921-b07e35bdc154', 15, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('0438c94f-4301-43b2-b2fc-b507f19db7c1', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'RESERVE', 'Epargne', 'bda80934-6d4b-473f-af7b-600d68124e8c', 185, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('3f16489f-dbe7-4c32-b890-41d784f34ba1', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Abonnement IA', '3be1b179-2a86-420b-8921-b07e35bdc154', 26, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('0d48eee4-3a57-4909-9b96-effcb868fae7', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Assurance ménage', '60b687b8-655e-4cd2-915d-53914ad0b6c5', 595, 'CHF', 12, '2025-09-01', '2026-08-31', 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('bdfa7d10-6c35-45cd-adcc-6d5fca67b126', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'RESERVE', '3ème pilier A', '2ad7cacf-6516-4057-a841-24d8dd0b2f33', 4105, NULL, 12, '2026-11-01', NULL, 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('c395e508-bbb9-4bcf-9830-58f9ad8067a3', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'RESERVE', '3ème pilier A', '2ad7cacf-6516-4057-a841-24d8dd0b2f33', 5660, NULL, 12, '2025-11-01', '2026-10-31', 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('eaf69138-6437-4e18-95fe-39b2e4594d37', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Assurance maladie + comp', 'f64260a2-d460-4c78-9c55-55f45392d3f4', 535, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('447cb413-8913-4b0f-a8c2-759e6d0a8102', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Frais bancaire', '73c840f3-7303-427d-8927-56385a0cd19d', 7, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('db3d7487-8c98-41cc-aae0-0de06c8f5973', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Natel', '3be1b179-2a86-420b-8921-b07e35bdc154', 33, NULL, 1, '2025-12-31', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('0870c1c2-f16f-4cee-82dd-1762544d342f', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Assurance enfant', '9b25e8e2-bc43-4ca6-b2bd-3cd7f540a49e', 135, 'CHF', 1, '2026-08-01', NULL, 'PERIODIQUE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('156cb133-04a6-4662-b173-e0971c5834d1', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Crêche', '9b25e8e2-bc43-4ca6-b2bd-3cd7f540a49e', 900, 'CHF', 1, '2027-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('0d536197-ddda-4847-b411-a03781ae4e7b', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Loyer', '60b687b8-655e-4cd2-915d-53914ad0b6c5', 1330, NULL, 1, '2025-08-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('c623ffdc-c939-4504-9798-622642085a05', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Internet / TV', '60b687b8-655e-4cd2-915d-53914ad0b6c5', 42, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('d5e0a801-7379-48d8-8535-748959252cb9', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Place de parc', '60b687b8-655e-4cd2-915d-53914ad0b6c5', 89, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('55491d52-1980-4db2-a9c2-f97a3b965032', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Assurance AUTO', 'c9be80f2-ba51-4c02-8758-77ee28295599', 1050, NULL, 12, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('85fd9b1a-f53a-49c8-9368-aff69c989ac4', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Essence AUTO', 'c9be80f2-ba51-4c02-8758-77ee28295599', 98, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('a39e4427-70aa-46b9-9b13-61ae69b60c38', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Plaque / Taxe CO2 AUTO', 'c9be80f2-ba51-4c02-8758-77ee28295599', 350, NULL, 12, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('2ba9eb01-dc3a-4e60-b2f1-7d00468ad0b6', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Vignette', 'c9be80f2-ba51-4c02-8758-77ee28295599', 35, NULL, 12, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('d858c1aa-34fd-4ec1-ad24-dda493d81a92', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Nourriture / recharges / litières', '2ab3bc91-844f-4286-91a2-ef71ddabc711', 22, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('0ddcb3cf-95aa-4503-af62-6bfc5a196984', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Assurance juridique', '60b687b8-655e-4cd2-915d-53914ad0b6c5', 370, 'CHF', 12, '2025-09-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('e04e1989-39fd-4fb6-a798-5ffa3f3700a5', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Streaming vidéo', '3be1b179-2a86-420b-8921-b07e35bdc154', 14, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('80cc04ac-3128-46d7-ae11-57fe0f24d7ea', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Redevance TV / Radio', '60b687b8-655e-4cd2-915d-53914ad0b6c5', 335, NULL, 12, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('a367f694-976f-4d27-b8d5-fac05cd02437', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Taxes poubelles', '60b687b8-655e-4cd2-915d-53914ad0b6c5', 87, NULL, 12, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('b90712dd-0690-4e87-9af7-810cb929e29f', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Courses alimentaires', 'e080cf92-9270-46f3-a359-ae95d6db0269', 795, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('8dfc229e-833b-42f7-a855-98730990cde1', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'RESERVE', 'Investissement', '9020ae8e-b701-4037-bc1e-0306dc5020cc', 150, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'CUSTOM'),
    ('4aab28d1-e381-4d43-9f5e-43dfc856ce77', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Charges AUTO divers (service, réparation, …)', 'c9be80f2-ba51-4c02-8758-77ee28295599', 805, NULL, 12, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('2b059716-035f-47b8-8d37-d2972e69af08', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Divers ménages', '60b687b8-655e-4cd2-915d-53914ad0b6c5', 70, NULL, 1, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO'),
    ('7eddd860-c486-4256-82b8-cf669a6029f6', '5554bbe8-a41b-4695-bd75-3fe0d1e4a76a', 'CHARGE', 'Electricité', '60b687b8-655e-4cd2-915d-53914ad0b6c5', 475, NULL, 3, '2026-01-01', NULL, 'MENSUALISE', 'DEBUT_PERIODE', 'EFFECTIF', NULL, 'AUTO');

-- ── Chaînage des postes issus d'une révision de montant ───
UPDATE poste SET poste_origine_id = 'ae2dd62c-0374-49af-aca8-8476236bf3f4' WHERE id = '14f01a19-8026-4ac2-91c2-8d9949c23ad8';
UPDATE poste SET poste_origine_id = '2a177347-ebe5-41aa-b2e9-31d31e1044b6' WHERE id = '2b3b3004-fa45-4360-94fd-c01c736dfdc9';
UPDATE poste SET poste_origine_id = '2b3b3004-fa45-4360-94fd-c01c736dfdc9' WHERE id = 'c81a4e63-9833-4413-8fab-ca19aeb33f54';
UPDATE poste SET poste_origine_id = '46a7be83-5fc4-4da3-abc0-d1b4ec5db509' WHERE id = 'eb5430d4-9a4b-4c23-9c7d-d5390cbe2c22';
UPDATE poste SET poste_origine_id = 'eb5430d4-9a4b-4c23-9c7d-d5390cbe2c22' WHERE id = 'f1a5549e-9374-4865-9b8a-d7de61530497';
UPDATE poste SET poste_origine_id = '7fd4140c-7426-45f9-a3ef-5db197278504' WHERE id = 'f4d19d10-3355-4607-9f9e-bb8f873ed446';
UPDATE poste SET poste_origine_id = '127c5ba4-fca1-4ad0-bffe-510052e4f82e' WHERE id = 'f23d2c1b-e648-4f7f-981b-49e40c5573cf';
UPDATE poste SET poste_origine_id = 'f1a5549e-9374-4865-9b8a-d7de61530497' WHERE id = '497619c1-c7a8-4a24-9f8b-5e3132f3215f';
UPDATE poste SET poste_origine_id = '497619c1-c7a8-4a24-9f8b-5e3132f3215f' WHERE id = '41d92a29-ae56-495c-8ad3-656fc6e0f5a2';
UPDATE poste SET poste_origine_id = 'f4d19d10-3355-4607-9f9e-bb8f873ed446' WHERE id = 'ed859ba3-38ba-4f5d-bc09-fe013e20c512';
UPDATE poste SET poste_origine_id = '14f01a19-8026-4ac2-91c2-8d9949c23ad8' WHERE id = 'c4e21421-a7a2-4eec-a598-a015626675bf';
UPDATE poste SET poste_origine_id = 'f23d2c1b-e648-4f7f-981b-49e40c5573cf' WHERE id = 'c8164498-6491-4762-baa9-23b962608824';
UPDATE poste SET poste_origine_id = '8f075f44-3f8a-49a6-bab6-ab5a7f45ec91' WHERE id = 'ca24fec4-6eb2-453e-b49f-27615a7d7c95';
UPDATE poste SET poste_origine_id = '0d48eee4-3a57-4909-9b96-effcb868fae7' WHERE id = '4fbe6ed3-8a94-41af-bcf0-42f1d56e8299';
UPDATE poste SET poste_origine_id = '41d92a29-ae56-495c-8ad3-656fc6e0f5a2' WHERE id = '2a177347-ebe5-41aa-b2e9-31d31e1044b6';
UPDATE poste SET poste_origine_id = 'c395e508-bbb9-4bcf-9830-58f9ad8067a3' WHERE id = 'bdfa7d10-6c35-45cd-adcc-6d5fca67b126';

-- ── Overrides de répartition par poste (CUSTOM) ───────────
INSERT INTO repartition_poste (id, poste_id, membre_id, quote_part) VALUES
    (gen_random_uuid(), 'f4d19d10-3355-4607-9f9e-bb8f873ed446', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'db3d7487-8c98-41cc-aae0-0de06c8f5973', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 1.0),
    (gen_random_uuid(), '2aaf2f15-4f34-4a82-8665-6b47e4d6971a', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 1.0),
    (gen_random_uuid(), 'ce585966-5e66-4b64-b985-4a123455df3d', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 1.0),
    (gen_random_uuid(), '69944cf4-9200-42f2-b468-f241fc276ed9', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'b8001c9a-e7b9-479e-9924-eb1643d4eafc', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'c395e508-bbb9-4bcf-9830-58f9ad8067a3', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '14f01a19-8026-4ac2-91c2-8d9949c23ad8', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '51260cf4-4d6b-4df7-ba5a-099bdde50491', '84b16f70-13c5-43de-a330-623f7f9c9156', 0.5),
    (gen_random_uuid(), 'd97f3d7e-22db-48df-a0c0-28f89cd99a2e', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 1.0),
    (gen_random_uuid(), '51260cf4-4d6b-4df7-ba5a-099bdde50491', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 0.5),
    (gen_random_uuid(), 'f23d2c1b-e648-4f7f-981b-49e40c5573cf', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 1.0),
    (gen_random_uuid(), '3f16489f-dbe7-4c32-b890-41d784f34ba1', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '46a7be83-5fc4-4da3-abc0-d1b4ec5db509', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '497619c1-c7a8-4a24-9f8b-5e3132f3215f', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '41d92a29-ae56-495c-8ad3-656fc6e0f5a2', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'c4e21421-a7a2-4eec-a598-a015626675bf', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'c4e21f02-9051-4af8-850e-99410bc1fa1c', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'c4e21f02-9051-4af8-850e-99410bc1fa1c', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 0.0),
    (gen_random_uuid(), 'fae581ad-3dea-465e-9653-2c14f5b7db58', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'fae581ad-3dea-465e-9653-2c14f5b7db58', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 0.0),
    (gen_random_uuid(), 'e1cc77a3-53b4-4d10-9649-d8d866fe60e0', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'e1cc77a3-53b4-4d10-9649-d8d866fe60e0', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 0.0),
    (gen_random_uuid(), 'd47a0daf-7122-4be5-9d5c-e2bdb4db2421', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'd47a0daf-7122-4be5-9d5c-e2bdb4db2421', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 0.0),
    (gen_random_uuid(), '9996257f-13f3-4938-923f-11a99c84753d', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '9996257f-13f3-4938-923f-11a99c84753d', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 0.0),
    (gen_random_uuid(), '2f2431b9-4a6b-4794-a60b-16502d2b2f93', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '2f2431b9-4a6b-4794-a60b-16502d2b2f93', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 0.0),
    (gen_random_uuid(), 'ed859ba3-38ba-4f5d-bc09-fe013e20c512', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'bdfa7d10-6c35-45cd-adcc-6d5fca67b126', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '3665b41b-736c-43c3-8e91-e581ec089c8a', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'eaf69138-6437-4e18-95fe-39b2e4594d37', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'ca24fec4-6eb2-453e-b49f-27615a7d7c95', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '32b85dd6-99a2-4ebd-b125-3540033bf6f0', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 1.0),
    (gen_random_uuid(), '173072dc-e1e7-4cb1-b145-3bba33083e78', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 1.0),
    (gen_random_uuid(), 'eb5430d4-9a4b-4c23-9c7d-d5390cbe2c22', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'f1a5549e-9374-4865-9b8a-d7de61530497', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '2b3b3004-fa45-4360-94fd-c01c736dfdc9', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'c81a4e63-9833-4413-8fab-ca19aeb33f54', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '8f075f44-3f8a-49a6-bab6-ab5a7f45ec91', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '7fd4140c-7426-45f9-a3ef-5db197278504', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '0438c94f-4301-43b2-b2fc-b507f19db7c1', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'c8164498-6491-4762-baa9-23b962608824', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 1.0),
    (gen_random_uuid(), '30badb4b-c171-461e-ba4b-52271bc850d6', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 1.0),
    (gen_random_uuid(), '2a177347-ebe5-41aa-b2e9-31d31e1044b6', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '0dcdae49-8a91-4a56-9c96-a316846fde5b', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 1.0),
    (gen_random_uuid(), '127c5ba4-fca1-4ad0-bffe-510052e4f82e', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 1.0),
    (gen_random_uuid(), '5c592efb-f9ee-4cd8-b549-2f443f667920', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), '447cb413-8913-4b0f-a8c2-759e6d0a8102', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 1.0),
    (gen_random_uuid(), '23eb3410-6dd4-4076-820e-2c9cc7590c6d', '4d542796-bd9f-46a8-a3f2-440b8afebe70', 1.0),
    (gen_random_uuid(), '8dfc229e-833b-42f7-a855-98730990cde1', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'ae2dd62c-0374-49af-aca8-8476236bf3f4', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'be22f344-707e-4723-84a6-adb4db86b344', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0),
    (gen_random_uuid(), 'f8bb7c26-dd14-4a5b-a60d-bc833bea0365', '84b16f70-13c5-43de-a330-623f7f9c9156', 1.0);

-- ── Ventilation par compte (membre → compte pour un poste) ─
INSERT INTO ventilation_compte (id, poste_id, membre_id, compte_id) VALUES
    (gen_random_uuid(), 'c623ffdc-c939-4504-9798-622642085a05', '84b16f70-13c5-43de-a330-623f7f9c9156', 'a4f4c7a9-83f8-42f3-a87d-a13abaceb8a6'),
    (gen_random_uuid(), 'c623ffdc-c939-4504-9798-622642085a05', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), 'c4e21421-a7a2-4eec-a598-a015626675bf', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '173072dc-e1e7-4cb1-b145-3bba33083e78', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '3f16489f-dbe7-4c32-b890-41d784f34ba1', '84b16f70-13c5-43de-a330-623f7f9c9156', 'f1077c0e-07ec-418a-a243-5dfbaff42953'),
    (gen_random_uuid(), 'd5e0a801-7379-48d8-8535-748959252cb9', '84b16f70-13c5-43de-a330-623f7f9c9156', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), 'd5e0a801-7379-48d8-8535-748959252cb9', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '7fd4140c-7426-45f9-a3ef-5db197278504', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'bdfa7d10-6c35-45cd-adcc-6d5fca67b126', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '14f01a19-8026-4ac2-91c2-8d9949c23ad8', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '30badb4b-c171-461e-ba4b-52271bc850d6', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '024274b2-59bd-4a3e-bb27-19c1db151145'),
    (gen_random_uuid(), '7eddd860-c486-4256-82b8-cf669a6029f6', '84b16f70-13c5-43de-a330-623f7f9c9156', 'a4f4c7a9-83f8-42f3-a87d-a13abaceb8a6'),
    (gen_random_uuid(), '7eddd860-c486-4256-82b8-cf669a6029f6', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '8f075f44-3f8a-49a6-bab6-ab5a7f45ec91', '84b16f70-13c5-43de-a330-623f7f9c9156', 'f1077c0e-07ec-418a-a243-5dfbaff42953'),
    (gen_random_uuid(), '0870c1c2-f16f-4cee-82dd-1762544d342f', '84b16f70-13c5-43de-a330-623f7f9c9156', '024274b2-59bd-4a3e-bb27-19c1db151145'),
    (gen_random_uuid(), '0870c1c2-f16f-4cee-82dd-1762544d342f', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '024274b2-59bd-4a3e-bb27-19c1db151145'),
    (gen_random_uuid(), '88b50ec5-a95a-4d68-9dd7-18dc8d9f2bb2', '84b16f70-13c5-43de-a330-623f7f9c9156', '024274b2-59bd-4a3e-bb27-19c1db151145'),
    (gen_random_uuid(), '88b50ec5-a95a-4d68-9dd7-18dc8d9f2bb2', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '024274b2-59bd-4a3e-bb27-19c1db151145'),
    (gen_random_uuid(), '46a7be83-5fc4-4da3-abc0-d1b4ec5db509', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'f23d2c1b-e648-4f7f-981b-49e40c5573cf', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '497619c1-c7a8-4a24-9f8b-5e3132f3215f', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '41d92a29-ae56-495c-8ad3-656fc6e0f5a2', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '4fbe6ed3-8a94-41af-bcf0-42f1d56e8299', '84b16f70-13c5-43de-a330-623f7f9c9156', 'a4f4c7a9-83f8-42f3-a87d-a13abaceb8a6'),
    (gen_random_uuid(), '4fbe6ed3-8a94-41af-bcf0-42f1d56e8299', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), 'c4e21f02-9051-4af8-850e-99410bc1fa1c', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'fae581ad-3dea-465e-9653-2c14f5b7db58', '84b16f70-13c5-43de-a330-623f7f9c9156', 'f1077c0e-07ec-418a-a243-5dfbaff42953'),
    (gen_random_uuid(), 'e1cc77a3-53b4-4d10-9649-d8d866fe60e0', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'd47a0daf-7122-4be5-9d5c-e2bdb4db2421', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '9996257f-13f3-4938-923f-11a99c84753d', '84b16f70-13c5-43de-a330-623f7f9c9156', 'f1077c0e-07ec-418a-a243-5dfbaff42953'),
    (gen_random_uuid(), '2f2431b9-4a6b-4794-a60b-16502d2b2f93', '84b16f70-13c5-43de-a330-623f7f9c9156', 'f1077c0e-07ec-418a-a243-5dfbaff42953'),
    (gen_random_uuid(), 'be22f344-707e-4723-84a6-adb4db86b344', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'be22f344-707e-4723-84a6-adb4db86b344', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'f8bb7c26-dd14-4a5b-a60d-bc833bea0365', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'f8bb7c26-dd14-4a5b-a60d-bc833bea0365', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '80cc04ac-3128-46d7-ae11-57fe0f24d7ea', '84b16f70-13c5-43de-a330-623f7f9c9156', 'a4f4c7a9-83f8-42f3-a87d-a13abaceb8a6'),
    (gen_random_uuid(), '80cc04ac-3128-46d7-ae11-57fe0f24d7ea', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), 'a367f694-976f-4d27-b8d5-fac05cd02437', '84b16f70-13c5-43de-a330-623f7f9c9156', 'a4f4c7a9-83f8-42f3-a87d-a13abaceb8a6'),
    (gen_random_uuid(), 'a367f694-976f-4d27-b8d5-fac05cd02437', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), 'b90712dd-0690-4e87-9af7-810cb929e29f', '84b16f70-13c5-43de-a330-623f7f9c9156', '4a634ade-f6f0-47d2-b2f5-1b56aeaa8967'),
    (gen_random_uuid(), 'b90712dd-0690-4e87-9af7-810cb929e29f', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '4a634ade-f6f0-47d2-b2f5-1b56aeaa8967'),
    (gen_random_uuid(), '4aab28d1-e381-4d43-9f5e-43dfc856ce77', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '4aab28d1-e381-4d43-9f5e-43dfc856ce77', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '2b059716-035f-47b8-8d37-d2972e69af08', '84b16f70-13c5-43de-a330-623f7f9c9156', '4a634ade-f6f0-47d2-b2f5-1b56aeaa8967'),
    (gen_random_uuid(), '2b059716-035f-47b8-8d37-d2972e69af08', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '4a634ade-f6f0-47d2-b2f5-1b56aeaa8967'),
    (gen_random_uuid(), '2f38ee99-f337-4712-b5a2-105b0daf6b2d', '84b16f70-13c5-43de-a330-623f7f9c9156', 'a4f4c7a9-83f8-42f3-a87d-a13abaceb8a6'),
    (gen_random_uuid(), '2f38ee99-f337-4712-b5a2-105b0daf6b2d', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '08f49d29-9ff8-4082-8777-01af08cdb159', '84b16f70-13c5-43de-a330-623f7f9c9156', 'a4f4c7a9-83f8-42f3-a87d-a13abaceb8a6'),
    (gen_random_uuid(), '08f49d29-9ff8-4082-8777-01af08cdb159', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '127c5ba4-fca1-4ad0-bffe-510052e4f82e', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), 'f4d19d10-3355-4607-9f9e-bb8f873ed446', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '0438c94f-4301-43b2-b2fc-b507f19db7c1', '84b16f70-13c5-43de-a330-623f7f9c9156', '81ee9635-eba5-440c-9f74-80c1ef4f17e5'),
    (gen_random_uuid(), '3665b41b-736c-43c3-8e91-e581ec089c8a', '84b16f70-13c5-43de-a330-623f7f9c9156', '024274b2-59bd-4a3e-bb27-19c1db151145'),
    (gen_random_uuid(), '156cb133-04a6-4662-b173-e0971c5834d1', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '156cb133-04a6-4662-b173-e0971c5834d1', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), 'ca24fec4-6eb2-453e-b49f-27615a7d7c95', '84b16f70-13c5-43de-a330-623f7f9c9156', 'f1077c0e-07ec-418a-a243-5dfbaff42953'),
    (gen_random_uuid(), '0ddcb3cf-95aa-4503-af62-6bfc5a196984', '84b16f70-13c5-43de-a330-623f7f9c9156', 'a4f4c7a9-83f8-42f3-a87d-a13abaceb8a6'),
    (gen_random_uuid(), '0ddcb3cf-95aa-4503-af62-6bfc5a196984', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '55491d52-1980-4db2-a9c2-f97a3b965032', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '55491d52-1980-4db2-a9c2-f97a3b965032', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), 'a39e4427-70aa-46b9-9b13-61ae69b60c38', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'a39e4427-70aa-46b9-9b13-61ae69b60c38', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '2ba9eb01-dc3a-4e60-b2f1-7d00468ad0b6', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '2ba9eb01-dc3a-4e60-b2f1-7d00468ad0b6', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '0501e8ed-0bc0-4a5e-b380-b1bc53e49205', '84b16f70-13c5-43de-a330-623f7f9c9156', '024274b2-59bd-4a3e-bb27-19c1db151145'),
    (gen_random_uuid(), '0501e8ed-0bc0-4a5e-b380-b1bc53e49205', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '024274b2-59bd-4a3e-bb27-19c1db151145'),
    (gen_random_uuid(), 'd858c1aa-34fd-4ec1-ad24-dda493d81a92', '84b16f70-13c5-43de-a330-623f7f9c9156', '4a634ade-f6f0-47d2-b2f5-1b56aeaa8967'),
    (gen_random_uuid(), 'd858c1aa-34fd-4ec1-ad24-dda493d81a92', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '4a634ade-f6f0-47d2-b2f5-1b56aeaa8967'),
    (gen_random_uuid(), '0d536197-ddda-4847-b411-a03781ae4e7b', '84b16f70-13c5-43de-a330-623f7f9c9156', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '0d536197-ddda-4847-b411-a03781ae4e7b', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '0dcdae49-8a91-4a56-9c96-a316846fde5b', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), 'eb5430d4-9a4b-4c23-9c7d-d5390cbe2c22', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'f1a5549e-9374-4865-9b8a-d7de61530497', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '2b3b3004-fa45-4360-94fd-c01c736dfdc9', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'c81a4e63-9833-4413-8fab-ca19aeb33f54', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'c8ff22a8-f56d-423e-9074-a2f2a7d498e4', '84b16f70-13c5-43de-a330-623f7f9c9156', '4a634ade-f6f0-47d2-b2f5-1b56aeaa8967'),
    (gen_random_uuid(), 'c8ff22a8-f56d-423e-9074-a2f2a7d498e4', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '4a634ade-f6f0-47d2-b2f5-1b56aeaa8967'),
    (gen_random_uuid(), 'db3d7487-8c98-41cc-aae0-0de06c8f5973', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '2aaf2f15-4f34-4a82-8665-6b47e4d6971a', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), 'ce585966-5e66-4b64-b985-4a123455df3d', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '69944cf4-9200-42f2-b468-f241fc276ed9', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'b8001c9a-e7b9-479e-9924-eb1643d4eafc', '84b16f70-13c5-43de-a330-623f7f9c9156', 'a4f4c7a9-83f8-42f3-a87d-a13abaceb8a6'),
    (gen_random_uuid(), 'd97f3d7e-22db-48df-a0c0-28f89cd99a2e', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), 'ed859ba3-38ba-4f5d-bc09-fe013e20c512', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'c395e508-bbb9-4bcf-9830-58f9ad8067a3', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), 'ae2dd62c-0374-49af-aca8-8476236bf3f4', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '85fd9b1a-f53a-49c8-9368-aff69c989ac4', '84b16f70-13c5-43de-a330-623f7f9c9156', '4a634ade-f6f0-47d2-b2f5-1b56aeaa8967'),
    (gen_random_uuid(), '85fd9b1a-f53a-49c8-9368-aff69c989ac4', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '4a634ade-f6f0-47d2-b2f5-1b56aeaa8967'),
    (gen_random_uuid(), 'e04e1989-39fd-4fb6-a798-5ffa3f3700a5', '84b16f70-13c5-43de-a330-623f7f9c9156', 'a4f4c7a9-83f8-42f3-a87d-a13abaceb8a6'),
    (gen_random_uuid(), 'e04e1989-39fd-4fb6-a798-5ffa3f3700a5', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '51260cf4-4d6b-4df7-ba5a-099bdde50491', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '51260cf4-4d6b-4df7-ba5a-099bdde50491', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), 'c8164498-6491-4762-baa9-23b962608824', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '0d48eee4-3a57-4909-9b96-effcb868fae7', '84b16f70-13c5-43de-a330-623f7f9c9156', 'a4f4c7a9-83f8-42f3-a87d-a13abaceb8a6'),
    (gen_random_uuid(), '0d48eee4-3a57-4909-9b96-effcb868fae7', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '2a177347-ebe5-41aa-b2e9-31d31e1044b6', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '5c592efb-f9ee-4cd8-b549-2f443f667920', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '447cb413-8913-4b0f-a8c2-759e6d0a8102', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), 'eaf69138-6437-4e18-95fe-39b2e4594d37', '84b16f70-13c5-43de-a330-623f7f9c9156', '08d0bddb-da33-4d3f-8ee8-47e8f0973a55'),
    (gen_random_uuid(), '23eb3410-6dd4-4076-820e-2c9cc7590c6d', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '32b85dd6-99a2-4ebd-b125-3540033bf6f0', '4d542796-bd9f-46a8-a3f2-440b8afebe70', '6199c9a0-9601-4069-ad74-d80e1553003c'),
    (gen_random_uuid(), '8dfc229e-833b-42f7-a855-98730990cde1', '84b16f70-13c5-43de-a330-623f7f9c9156', 'f1077c0e-07ec-418a-a243-5dfbaff42953');

-- ── Taux de change prévisionnels ───────────────────────────
INSERT INTO taux_change (id, foyer_id, devise, taux_vers_base) VALUES
    (gen_random_uuid(), '2b3a8e1e-11e6-4ba5-9f05-82c6b2d551e1', 'USD', 0.8301);
