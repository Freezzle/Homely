# Instructions Copilot — Budget Foyer

> Consignes permanentes pour l'agent LLM travaillant sur ce dépôt. À respecter dans
> **chaque** contribution. En cas de doute sur le métier, la **référence absolue** est
> [`docs/01-business-rules-engine.md`](../docs/01-business-rules-engine.md) et ses
> vecteurs de test ; le fichier Excel d'origine tranche en dernier recours.

---

## Contexte du projet
Réécriture d'un classeur Excel de **prévision budgétaire familiale** en application web
**Spring Boot 4 (Java 21) + Angular 22 + PrimeNG 22 + Tailwind CSS v4**, en **SaaS
multi-foyers**. Prévision uniquement (pas de réel, pas d'import bancaire). Lis, dans
l'ordre : `README.md`, puis `docs/01` → `docs/06`. Suis le backlog `docs/06`
**séquentiellement**, une tâche par PR.

## Règles d'or
1. **Le moteur de calcul se développe en test-first.** Écris d'abord les tests JUnit
   depuis les vecteurs golden (doc 01 §8-bis), puis implémente jusqu'au vert. Ces tests
   ne doivent **jamais** régresser.
2. **Fidélité à l'Excel** pour le cœur : lissage/périodique début-fin, fenêtres de
   validité, prorata, trésorerie chaînée — au **centime**. Les extensions (N membres,
   devises, patrimoine) ne doivent **pas** altérer ce comportement quand elles sont
   neutres (2 membres, devise unique).
3. **Multi-tenant strict** : toute donnée est scopée par `foyer` (ou `scenario` du
   foyer). Aucune requête ne doit exposer une entité d'un autre foyer. Ajoute un test de
   sécurité d'accès croisé pour chaque endpoint sensible.
4. **Calcul en `double` dans le moteur** (comme Excel), `BigDecimal` pour
   stockage/DTO ; **arrondir uniquement à l'affichage**. Modulo **euclidien**
   (`Math.floorMod`).
5. **Ne code pas en dur** les données du foyer d'exemple : elles vivent dans le seed
   Flyway et servent de base aux tests.

## Conventions backend (Java / Spring)
- Java 21, records pour les DTO et les objets de valeur du moteur (immuables).
- Package-by-feature (voir doc 03 §2). Le module `moteur` **n'importe ni Spring, ni JPA,
  ni `java.time` lié à l'horloge** (dates passées en paramètre).
- `@Enumerated(EnumType.STRING)` pour les enums ; jamais d'ordinal en base.
- Persistance gérée par **Flyway** ; Hibernate en `ddl-auto=validate` (pas de génération
  auto du schéma).
- DTO ⇄ entités via **MapStruct** ; ne jamais exposer les entités JPA dans les
  contrôleurs.
- Validation d'entrée via **Bean Validation** ; erreurs renvoyées au format `ApiError`
  (doc 04 §2) avec un **code métier** stable.
- Éviter le **N+1** : requêtes de chargement du scénario avec fetch joints.
- Tests : JUnit 5 + AssertJ ; intégration avec **Testcontainers** (PostgreSQL réel).
  Couverture module `moteur` > 90 %.

## Conventions frontend (Angular 22 / PrimeNG 22 / Tailwind v4)
- Angular **22**, **standalone components** + **signals** ; strict mode TS ; pas de
  NgModule.
- **Aucun texte en dur** dans les composants → clés i18n. Formatage montants/dates via
  `Intl` + locale + `deviseBase` (pipes dédiés).
- Composants **PrimeNG 22** (tables, dialogs, selects, inputnumber, datepicker,
  progressbar, chart, toast, confirmdialog). Thème par tokens (preset **Aura**,
  `@primeng/themes`, mode styled). Graphiques via `p-chart` (Chart.js).
- **Tailwind CSS v4** pour layout/espacement/responsive, **couplé à PrimeNG** via le
  plugin officiel `tailwindcss-primeui` + **CSS layers** (ordre `tailwind, primeng`, le
  layer `primeng` avant les utilitaires Tailwind) — voir doc 03 §6.1. **Ne pas** utiliser
  PrimeFlex (legacy). Éviter le préfixe `!` : régler la spécificité par les layers.
  Utiliser les couleurs de tokens (`bg-primary`, `text-surface-*`) ; sur un composant
  PrimeNG, passer les utilitaires via `styleClass`. Aligner `darkModeSelector` avec la
  variante `dark` de Tailwind.
- **Interdit** : `localStorage`/`sessionStorage` pour l'état applicatif métier ;
  privilégier les signals/état en mémoire (le token de refresh suit la stratégie de
  sécurité définie, pas d'astuce de contournement).
- Services HTTP typés ; interceptor JWT (ajout token + refresh transparent). Guards
  d'auth et de rôle. Masquer les actions d'écriture pour les `VIEWER`.
- Miroir des règles serveur côté UX : la répartition d'un poste/scénario doit sommer à
  100 % **avant** de pouvoir sauvegarder (feedback live).

## Ubiquitous language
Utilise les termes FR du [glossaire](../README.md#5-glossaire--langage-ubiquitaire)
(Foyer, Membre, Scénario, Poste, Catégorie, Compte, Actif, Répartition, Quote-part,
Contribution, Solde disponible, Trésorerie chaînée, Objectif). Cohérence entités ↔ API ↔
UI.

## Sécurité & config
- Secrets uniquement via variables d'environnement ; **jamais** committés. `.env.example`
  documente les clés (`DB_*`, `JWT_SECRET`, `CORS_ORIGINS`).
- Endpoints publics limités à `/api/auth/*`. Le reste exige un JWT valide + un
  `AccesFoyer`.
- Journalise toute tentative d'accès inter-foyers.

## Definition of Done (rappel)
Une tâche est terminée quand : code + tests verts en CI, moteur non régressé, lint OK,
multi-tenant respecté (test d'accès croisé), DTO ≠ entités, OpenAPI à jour, UI en clés
i18n, et **les vecteurs golden restent reproduits au centime**. Une tâche = une PR, dans
l'ordre du backlog `docs/06`.

## Ce qu'il ne faut PAS faire
- Ne pas introduire de suivi du **réalisé**, d'import bancaire, ni de rapprochement (hors
  périmètre).
- Ne pas modifier la sémantique du moteur pour « simplifier » : elle doit rester
  identique à l'Excel.
- Ne pas contourner le scoping multi-tenant ni la validation de la somme des quotes-parts.
- Ne pas arrondir les étapes intermédiaires de calcul.
- Respecter les versions **imposées** (Spring Boot 4, Angular 22, PrimeNG 22, Tailwind
  v4) ; pour les autres dépendances, épingler la **dernière version stable** compatible à
  l'initialisation. Ne pas revenir à PrimeFlex ni à une version antérieure de ces socles.
