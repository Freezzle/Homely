-- ============================================================
--  V2__seed_demo.sql — Foyer de démonstration Charmillot
--  Reproduit exactement les vecteurs de test T2/T3 du doc 01.
--  Données issues du classeur Excel d'origine.
-- ============================================================

-- ── Foyer ─────────────────────────────────────────────────
INSERT INTO foyer (id, nom, devise_base) VALUES
    ('10000000-0000-0000-0000-000000000001', 'Foyer Charmillot', 'CHF');

-- ── Membres ───────────────────────────────────────────────
INSERT INTO membre (id, foyer_id, nom, couleur, ordre) VALUES
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Dylan',   '#3B82F6', 0),
    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Mélanie', '#EC4899', 1);

-- ── Comptes ───────────────────────────────────────────────
INSERT INTO compte (id, foyer_id, libelle, type, solde_initial, ordre) VALUES
    ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Compte courant', 'COURANT', 0, 0),
    ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Compte épargne', 'EPARGNE', 0, 1),
    ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Compte en commun', 'COMMUN', 0, 2),
    ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Compte bébé',    'EPARGNE', 0, 3),
    ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Compte privé',   'COURANT', 0, 4),
    ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Compte annexe',  'AUTRE',   0, 5);

-- ── Catégories ────────────────────────────────────────────
-- CHARGE
INSERT INTO categorie (id, foyer_id, libelle, type_poste, systeme, ordre) VALUES
    ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Logement',          'CHARGE',  true,  0),
    ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Maison',            'CHARGE',  true,  1),
    ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Transport',         'CHARGE',  true,  2),
    ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Assurances',        'CHARGE',  true,  3),
    ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Alimentation',      'CHARGE',  true,  4),
    ('40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Abonnements',       'CHARGE',  true,  5),
    ('40000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'Enfant',            'CHARGE',  true,  6),
    ('40000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'Animaux',           'CHARGE',  true,  7),
    ('40000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'Santé',             'CHARGE',  true,  8),
    ('40000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Impôts',            'CHARGE',  true,  9),
    ('40000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Loisirs',           'CHARGE',  true, 10),
    ('40000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'Banque',            'CHARGE',  true, 11),
    ('40000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'Personnel',         'CHARGE',  true, 12),
    ('40000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'Autre',             'CHARGE',  true, 13),
    ('40000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', 'Epargne',           'CHARGE',  true, 14),
    ('40000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001', 'Argent mis de côté','CHARGE',  true, 15),
    ('40000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000001', '3ème pilier',       'CHARGE',  true, 16),
    ('40000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001', 'Investissement',    'CHARGE',  true, 17);
-- REVENU
INSERT INTO categorie (id, foyer_id, libelle, type_poste, systeme, ordre) VALUES
    ('40000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000001', 'Salaire',           'REVENU', true,  0),
    ('40000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000001', 'Allocation',        'REVENU', true,  1),
    ('40000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-000000000001', 'Prime / Bonus',     'REVENU', true,  2),
    ('40000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-000000000001', 'Aide / Subvention', 'REVENU', true,  3);
-- RESERVE
INSERT INTO categorie (id, foyer_id, libelle, type_poste, systeme, ordre) VALUES
    ('40000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000001', 'Epargne',            'RESERVE', true, 0),
    ('40000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-000000000001', 'Argent mis de côté', 'RESERVE', true, 1),
    ('40000000-0000-0000-0000-000000000203', '10000000-0000-0000-0000-000000000001', '3ème pilier',        'RESERVE', true, 2),
    ('40000000-0000-0000-0000-000000000204', '10000000-0000-0000-0000-000000000001', 'Investissement',     'RESERVE', true, 3);
-- PROJET
INSERT INTO categorie (id, foyer_id, libelle, type_poste, systeme, ordre) VALUES
    ('40000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000001', 'Vacances',          'PROJET', true, 0),
    ('40000000-0000-0000-0000-000000000302', '10000000-0000-0000-0000-000000000001', 'Achat',             'PROJET', true, 1),
    ('40000000-0000-0000-0000-000000000303', '10000000-0000-0000-0000-000000000001', 'Réserve d urgence', 'PROJET', true, 2);

-- ── Scénario de référence ─────────────────────────────────
INSERT INTO scenario (id, foyer_id, nom, est_reference, annee_depart, tresorerie_initiale, horizon_annees) VALUES
    ('50000000-0000-0000-0000-000000000001',
     '10000000-0000-0000-0000-000000000001',
     'Prévision principale', true, 2026, 0.00, 9);

-- ── Répartition par défaut : Dylan 58 % / Mélanie 42 % ────
INSERT INTO repartition_defaut (id, scenario_id, membre_id, quote_part) VALUES
    ('60000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001',
     '20000000-0000-0000-0000-000000000001', 0.580000),
    ('60000000-0000-0000-0000-000000000002',
     '50000000-0000-0000-0000-000000000001',
     '20000000-0000-0000-0000-000000000002', 0.420000);

-- ════════════════════════════════════════════════════════════
--  POSTES  (reproduisent exactement les vecteurs T2 du doc 01)
-- ════════════════════════════════════════════════════════════
-- Identifiants postes : 70000000-0000-0000-0000-0000000000xx

-- ── REVENUS ──────────────────────────────────────────────────────────────────
-- Salaire Dylan      6 300/mois, D=1, MENSUALISE  (toujours actif)
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000001',
     '50000000-0000-0000-0000-000000000001',
     'REVENU', 'Salaire net Dylan',
     '40000000-0000-0000-0000-000000000101', 6300.00, 1, 'MENSUALISE', 'DEBUT_PERIODE', 0);

-- Salaire Mélanie base 4 700/mois, D=1, fin 2026-07-31
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, fin, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000002',
     '50000000-0000-0000-0000-000000000001',
     'REVENU', 'Salaire net Mélanie (avant augmentation)',
     '40000000-0000-0000-0000-000000000101', 4700.00, 1, '2026-07-31', 'MENSUALISE', 'DEBUT_PERIODE', 1);

-- Salaire Mélanie augmenté 4 930/mois, D=1, debut 2026-08-01
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, debut, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000003',
     '50000000-0000-0000-0000-000000000001',
     'REVENU', 'Salaire net Mélanie (après augmentation)',
     '40000000-0000-0000-0000-000000000101', 4930.00, 1, '2026-08-01', 'MENSUALISE', 'DEBUT_PERIODE', 2);

-- 13e salaire Dylan 6 300, D=12, PERIODIQUE/DEBUT, ancre novembre
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, debut, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000004',
     '50000000-0000-0000-0000-000000000001',
     'REVENU', '13ème salaire Dylan',
     '40000000-0000-0000-0000-000000000103', 6300.00, 12, '2026-11-01', 'PERIODIQUE', 'DEBUT_PERIODE', 3);

-- Allocation familiale 500, D=12, PERIODIQUE/DEBUT, ancre avril
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, debut, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000005',
     '50000000-0000-0000-0000-000000000001',
     'REVENU', 'Allocation familiale',
     '40000000-0000-0000-0000-000000000102', 500.00, 12, '2026-04-01', 'PERIODIQUE', 'DEBUT_PERIODE', 4);

-- Prime décembre 400, D=12, PERIODIQUE/DEBUT, ancre décembre
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, debut, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000006',
     '50000000-0000-0000-0000-000000000001',
     'REVENU', 'Prime de fin d année',
     '40000000-0000-0000-0000-000000000103', 400.00, 12, '2026-12-01', 'PERIODIQUE', 'DEBUT_PERIODE', 5);

-- ── CHARGES ──────────────────────────────────────────────────────────────────
-- Loyer 1 500/mois, D=1
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000011',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Loyer',
     '40000000-0000-0000-0000-000000000001', 1500.00, 1, 'MENSUALISE', 'DEBUT_PERIODE', 10);

-- Internet 43/mois, D=1
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000012',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Internet / téléphone',
     '40000000-0000-0000-0000-000000000006', 43.00, 1, 'MENSUALISE', 'DEBUT_PERIODE', 11);

-- Place de parc 100/mois, D=1
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000013',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Place de parc',
     '40000000-0000-0000-0000-000000000003', 100.00, 1, 'MENSUALISE', 'DEBUT_PERIODE', 12);

-- Électricité 360, D=3, MENSUALISE (→ 120/mois)
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000014',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Électricité',
     '40000000-0000-0000-0000-000000000002', 360.00, 3, 'MENSUALISE', 'DEBUT_PERIODE', 13);

-- Assurance ménage 630/an, D=12, MENSUALISE (→ 52.50/mois)
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000015',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Assurance ménage',
     '40000000-0000-0000-0000-000000000004', 630.00, 12, 'MENSUALISE', 'DEBUT_PERIODE', 14);

-- Redevance radio/TV 335/an, D=12, MENSUALISE
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000016',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Redevance Serafe',
     '40000000-0000-0000-0000-000000000006', 335.00, 12, 'MENSUALISE', 'DEBUT_PERIODE', 15);

-- Taxes poubelles 111/an, D=12, MENSUALISE
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000017',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Taxes poubelles',
     '40000000-0000-0000-0000-000000000002', 111.00, 12, 'MENSUALISE', 'DEBUT_PERIODE', 16);

-- Assurance AUTO 1 169/an, D=12, MENSUALISE
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000018',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Assurance automobile',
     '40000000-0000-0000-0000-000000000004', 1169.00, 12, 'MENSUALISE', 'DEBUT_PERIODE', 17);

-- Courses alimentation 12 000/an, D=12, MENSUALISE (→ 1 000/mois)
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000019',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Courses alimentation',
     '40000000-0000-0000-0000-000000000005', 12000.00, 12, 'MENSUALISE', 'DEBUT_PERIODE', 18);

-- Argent de poche / loisirs Dylan 9 600/an, D=12, MENSUALISE (→ 800/mois)
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000020',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Loisirs Dylan',
     '40000000-0000-0000-0000-000000000011', 9600.00, 12, 'MENSUALISE', 'DEBUT_PERIODE', 19);

-- Argent de poche / loisirs Mélanie 13 200/an, D=12, MENSUALISE (→ 1 100/mois)
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000021',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Loisirs Mélanie',
     '40000000-0000-0000-0000-000000000011', 13200.00, 12, 'MENSUALISE', 'DEBUT_PERIODE', 20);

-- Santé (franchises + complémentaire) 3 600/an, D=12, MENSUALISE (→ 300/mois)
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000022',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Santé / assurance maladie',
     '40000000-0000-0000-0000-000000000009', 3600.00, 12, 'MENSUALISE', 'DEBUT_PERIODE', 21);

-- Divers banque 252/an, D=12, MENSUALISE
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000023',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Frais bancaires',
     '40000000-0000-0000-0000-000000000012', 252.00, 12, 'MENSUALISE', 'DEBUT_PERIODE', 22);

-- Divers abonnements 19/an, D=12, MENSUALISE
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000024',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Abonnements divers',
     '40000000-0000-0000-0000-000000000006', 19.00, 12, 'MENSUALISE', 'DEBUT_PERIODE', 23);

-- +50 CHF/mois charges supplémentaires à partir d août 2026
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, debut, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000025',
     '50000000-0000-0000-0000-000000000001',
     'CHARGE', 'Charges supplémentaires (dès août)',
     '40000000-0000-0000-0000-000000000014', 50.00, 1, '2026-08-01', 'MENSUALISE', 'DEBUT_PERIODE', 24);

-- ── RÉSERVES ─────────────────────────────────────────────────────────────────
-- Épargne mensuelle 410/mois, D=1
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000031',
     '50000000-0000-0000-0000-000000000001',
     'RESERVE', 'Épargne mensuelle',
     '40000000-0000-0000-0000-000000000201', 410.00, 1, 'MENSUALISE', 'DEBUT_PERIODE', 30);

-- 3e pilier 3 600, D=12, PERIODIQUE/DEBUT, ancre novembre
INSERT INTO poste (id, scenario_id, type, description, categorie_id, montant, periodicite_mois, debut, mode, moment, ordre) VALUES
    ('70000000-0000-0000-0000-000000000032',
     '50000000-0000-0000-0000-000000000001',
     'RESERVE', '3ème pilier',
     '40000000-0000-0000-0000-000000000203', 3600.00, 12, '2026-11-01', 'PERIODIQUE', 'DEBUT_PERIODE', 31);
