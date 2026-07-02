# 06 — Backlog & plan de tâches (pour l'agent)

> Backlog séquencé destiné à l'agent LLM. Chaque tâche a un **objectif**, des **critères
> d'acceptation** vérifiables et ses **dépendances**. Avancer **dans l'ordre**, une tâche
> par PR, tests inclus. La règle d'or : **le moteur (E2) se fait en test-first** à partir
> des vecteurs du [doc 01](01-business-rules-engine.md).

Conventions de statut : `[ ]` à faire · `[~]` en cours · `[x]` fait.
Format des tâches : `T<epic>.<n>`.

---

## Jalon 0 — Fondations

### E0 · Amorçage des dépôts
- [ ] **T0.1** Backend **Spring Boot 4** (Java 26, Maven) : dépendances Web, Data JPA,
  Validation, Security, PostgreSQL, Flyway, MapStruct, Lombok, springdoc, Caffeine,
  Testcontainers. *Accept.* : `mvn verify` vert, `/health` répond, Swagger UI accessible.
- [ ] **T0.2** Frontend **Angular 22** (standalone, strict, signals) + **PrimeNG 22** +
  PrimeIcons + **Tailwind CSS v4** couplé via `tailwindcss-primeui` et CSS layers (ordre
  `tailwind, primeng`, preset Aura — voir doc 03 §6.1) + Chart.js. *Accept.* : `ng build`
  + `ng lint` verts ; page shell affiche un composant PrimeNG stylé **et** une classe
  utilitaire Tailwind (`bg-primary`) rendue correctement (preuve du couplage).
- [ ] **T0.3** `docker-compose` dev (PostgreSQL + back + front), `.env.example`,
  Dockerfiles multi-stage. *Accept.* : `docker compose up` démarre la stack.
- [ ] **T0.4** GitHub Actions : jobs back (build+test) et front (build+lint+test) sur PR.
  *Accept.* : pipeline vert sur une PR blanche ; échec bloquant si tests rouges.

---

## Jalon 1 — Cœur métier (priorité absolue)

### E1 · Schéma & entités
- [ ] **T1.1** Migration Flyway `V1__init.sql` = schéma complet du [doc 02 §4](02-domain-and-data-model.md).
  *Accept.* : migration s'applique sur PostgreSQL vierge (Testcontainers).
- [ ] **T1.2** Entités JPA + enums + repositories Spring Data pour toutes les tables.
  *Accept.* : `ddl-auto=validate` passe (schéma ⇔ entités) ; repos chargés au démarrage.
- [ ] **T1.3** Requête optimisée `findScenarioForEngine(scenarioId)` (fetch joints
  postes + répartitions + ventilations, sans N+1). *Accept.* : test vérifie 1–2 requêtes.

### E2 · ★ Moteur de calcul (test-first, module `moteur`)
- [ ] **T2.1** Records d'entrée/sortie (`PosteCalcul`, `RepartitionCalcul`,
  `ParametresScenario`, `ProjectionAnnuelle`, `ProjectionPluriannuelle`, `Ventilations`).
  Aucune dépendance Spring/JPA/horloge.
- [ ] **T2.2** `contribution(poste, annee, mois)` selon [doc 01 §3](01-business-rules-engine.md)
  (fenêtre de validité, Dsafe, mensualisé/périodique début-fin, `floorMod`).
  *Accept.* : tests **T1** (contributions élémentaires) verts au centime.
- [ ] **T2.3** Répartition N membres + `quotePartEffective` + validation somme=1
  ([§6](01-business-rules-engine.md)). *Accept.* : tests **T4** verts ; répartition ≠ 1 → exception dédiée.
- [ ] **T2.4** Conversion multi-devises ([§7](01-business-rules-engine.md)). *Accept.* : tout en deviseBase ⇒
  facteur 1 (résultats identiques à T2/T3) ; devise convertie ⇒ montant attendu.
- [ ] **T2.5** Agrégats mensuels + **projection annuelle** (FOYER + par membre).
  *Accept.* : test **T2** (tableau 2026) vert au centime, total = 140 350 / 62 322 /
  8 520 / 69 508.
- [ ] **T2.6** **Trésorerie chaînée** pluriannuelle. *Accept.* : test **T3** vert (0 →
  69 508 → 128 476 → 187 994 → 248 012 …).
- [ ] **T2.7** Ventilations par catégorie et par compte. *Accept.* : cohérence avec les
  totaux du mois ; somme des ventilations = total du type.
- [ ] **T2.8** Cas limites [§8-bis T5](01-business-rules-engine.md) (D=0, sans dates, fin en cours d'année,
  ancre mars/D=6, valeurs manquantes, modulo négatif). *Accept.* : tests verts, **aucune
  exception non maîtrisée**. Couverture module `moteur` **> 90 %**.

### E3 · Service de projection (pont JPA ↔ moteur)
- [ ] **T3.1** Service qui charge un scénario, mappe vers les records du moteur, exécute,
  mappe en DTO. *Accept.* : test d'intégration sur le **seed** reproduit T2/T3.
- [ ] **T3.2** Cache Caffeine `(scenarioId, version)` invalidé à toute modif de
  poste/hypothèse. *Accept.* : 2ᵉ appel sans modif = cache hit ; modif → recalcul.

---

## Jalon 2 — Sécurité & API socle

### E4 · Auth & multi-tenant
- [ ] **T4.1** Utilisateur + inscription/connexion + hachage BCrypt. *Accept.* : register
  puis login renvoie des tokens.
- [ ] **T4.2** JWT access + refresh (rotation) + filtre d'authentification + `/auth/moi`.
  *Accept.* : endpoint protégé refuse sans token (401), accepte avec token.
- [ ] **T4.3** Foyer + AccesFoyer + rôles ; guard multi-tenant (appartenance + rôle).
  *Accept.* : accès à un foyer non autorisé → 403/404 ; `VIEWER` bloqué en écriture (403).
  **Test de sécurité d'accès croisé obligatoire.**
- [ ] **T4.4** Gestion des accès (inviter/retirer/changer rôle) réservée `OWNER`.

### E5 · Erreurs & fondations API
- [ ] **T5.1** `@RestControllerAdvice` → `ApiError` uniforme + codes métier ([doc 04 §2](04-api-spec.md)).
- [ ] **T5.2** Pagination/tri standard + Bean Validation sur les DTO. *Accept.* : payload
  invalide → 400 structuré ; règle métier → 422.

---

## Jalon 3 — CRUD référentiels & scénarios

### E6 · Référentiels
- [ ] **T6.1** CRUD Membres, Comptes, Catégories, Actifs, TauxChange (scopés foyer).
  *Accept.* : cohérence multi-tenant vérifiée ; suppression d'un membre référencé refusée.
- [ ] **T6.2** Seed `V2__seed_demo.sql` (foyer Charmillot complet, [doc 02 §7](02-domain-and-data-model.md)).
  *Accept.* : après seed, la projection annuelle 2026 = vecteurs T2 (**critère fort**).

### E7 · Scénarios & postes
- [ ] **T7.1** CRUD Scénario + RepartitionDefaut (validation somme=1) + garde « une seule
  référence ». *Accept.* : 2ᵉ référence → 409 ; répartition ≠ 1 → 422.
- [ ] **T7.2** CRUD Poste + RepartitionPoste + VentilationCompte + `montantMensualise`
  calculé. *Accept.* : override répartition validé ; cohérence foyer/scénario.
- [ ] **T7.3** `:dupliquer` scénario (copie profonde postes/objectifs/répartitions) et
  `:definir-reference`. *Accept.* : le duplicata est indépendant de l'original.
- [ ] **T7.4** CRUD Objectif (support compte XOR actif) + calculs [doc 01 §10](01-business-rules-engine.md).
  *Accept.* : progression/épargne requise/date prévue correctes sur un cas de test.

---

## Jalon 4 — API de projection

### E8 · Endpoints de projection
- [ ] **T8.1** `projection/annuelle` + `annuelle-complete` ([doc 04 §9.1](04-api-spec.md)).
  *Accept.* : sur le seed, JSON == vecteurs T2 (foyer + par membre cohérents).
- [ ] **T8.2** `projection/tresorerie` (+ courbe mensuelle). *Accept.* : == vecteurs T3.
- [ ] **T8.3** `projection/mensuelle` (ventilations). *Accept.* : totaux == somme des
  ventilations.
- [ ] **T8.4** `projection/patrimoine` (net worth, [doc 01 §9](01-business-rules-engine.md)). *Accept.* : sur un
  cas jouet, soldes projetés = calcul manuel (transfert réserve source→destination géré).
- [ ] **T8.5** `projection/comparaison` multi-scénarios. *Accept.* : séries alignées par
  année pour 2+ scénarios.
- [ ] **T8.6** `postes/{id}/apercu?annee=` (contribution mensuelle d'un poste).

---

## Jalon 5 — Frontend

### E9 · Socle front
- [ ] **T9.1** Auth (login/register), interceptor JWT + refresh transparent, guards.
- [ ] **T9.2** Shell (topbar, menu, sélecteurs foyer/scénario), `ContexteService`
  (signals), thème/i18n (FR), pipes montant/date (Intl + deviseBase).
- [ ] **T9.3** Services HTTP typés + modèles TS des DTO (générés d'OpenAPI si possible).

### E10 · Écrans
- [ ] **T10.1** Écran générique Revenus/Charges/Réserves : `p-table` + `p-dialog`, éditeur
  de répartition (**somme = 100 % live**), ventilation comptes, aperçu mensuel. *Accept.* :
  création/édition/suppression fonctionnelles ; sauvegarde bloquée si somme ≠ 1.
- [ ] **T10.2** Référentiels (CRUD) + Paramètres foyer + Accès (OWNER).
- [ ] **T10.3** Scénarios (liste, hypothèses, duplication, définir référence).
- [ ] **T10.4** **Tableau de bord annuel** : 3 tableaux + total année + barres empilées +
  courbe de trésorerie. *Accept.* : chiffres affichés == vecteurs T2/T3 sur le seed.
- [ ] **T10.5** **Tableau de bord du mois** : camemberts par catégorie + ventilation
  compte/membre + cartes de synthèse.
- [ ] **T10.6** **Patrimoine** : courbe net worth + répartition + tableau comptes/actifs.
- [ ] **T10.7** **Objectifs** : cartes + barres de progression + formulaire.
- [ ] **T10.8** **Comparaison de scénarios** : multi-sélection + graphe multi-séries +
  tableau des écarts.

---

## Jalon 6 — Finitions
- [ ] **T11.1** Export (PDF/Excel) des tableaux de bord et projections.
- [ ] **T11.2** e2e Playwright sur les parcours clés (login → saisie poste → dashboard).
- [ ] **T11.3** Revue accessibilité/responsive + polish thème.
- [ ] **T11.4** README d'exécution (dev + prod) et documentation OpenAPI publiée.

---

## Definition of Done (toute tâche)
1. Code + **tests** (unitaires ; d'intégration si backend touche la persistance).
2. Tests verts en CI ; **les tests du moteur ne régressent jamais**.
3. Lint/format OK. Pas de secret committé.
4. Multi-tenant respecté (aucune fuite inter-foyers). Validation d'entrée présente.
5. DTO ≠ entités ; endpoints documentés (OpenAPI). UI sans texte en dur (clés i18n).
6. Les **vecteurs golden** (doc 01) restent reproduits au centime.
