# Budget Foyer — Application de prévision budgétaire

> Réécriture d'un classeur Excel de prévision budgétaire familiale en application web
> moderne **Spring Boot + Angular + PrimeNG**. Ce dépôt contient la **spécification
> complète** destinée à être exécutée par un agent LLM (GitHub Copilot). Lis les
> documents dans l'ordre indiqué avant de coder.

---

## 1. Vision

L'outil est un **simulateur de budget prévisionnel** pour un foyer. On y décrit des
**postes récurrents** (revenus, charges, réserves d'épargne) avec leur périodicité et
leur fenêtre de validité, et l'application **projette mois par mois et année par année**
les flux financiers ainsi que la **trésorerie cumulée** sur plusieurs années.

Ce n'est **pas** un logiciel de comptabilité du réalisé : il n'y a ni saisie de
transactions réelles, ni rapprochement bancaire, ni import de relevés. **Uniquement de
la prévision, mais précise.**

## 2. Périmètre (validé avec le commanditaire)

### Cœur — reproduction fidèle de l'Excel
Le moteur de calcul doit reproduire **exactement** la logique du classeur d'origine :
lissage mensuel vs comptabilisation périodique (début/fin de période), fenêtres de
validité début/fin, répartition par prorata entre membres, trésorerie chaînée. Voir
[`docs/01-business-rules-engine.md`](docs/01-business-rules-engine.md). Des **vecteurs de
test dérivés des vraies données** y figurent : le moteur DOIT les reproduire au centime.

### Extensions transverses (par rapport à l'Excel)
- **SaaS multi-foyers** avec authentification (plusieurs utilisateurs, plusieurs foyers).
- **N membres** par foyer (l'Excel n'en gérait que 2) : le prorata scalaire devient une
  **répartition vectorielle** dont la somme des quotes-parts vaut 1.
- **Multi-devises** (chaque poste peut être libellé dans une devise, converti vers la
  devise de base du foyer).
- **Graphiques interactifs** (flux mensuels, tableaux de bord annuel/mensuel, comparaison
  de scénarios, patrimoine).
- **Nature de poste descriptive** : `EFFECTIF` ou `PREVISION` (sans impact sur la
  sémantique du moteur classique).
- **Double lecture annuelle** : projection mensualisée (historique) + projection réelle
  (imputations non lissées au mois d'échéance).

### Modules fonctionnels de la V1
- **Patrimoine / net worth** : comptes et actifs (3ᵉ pilier, investissements, crypto,
  immobilier, véhicule…), soldes initiaux, projection de leur évolution.
- **Multi-scénarios (what-if)** : chaque scénario est un jeu complet d'hypothèses + de
  postes ; duplication et comparaison côte à côte.
- **Objectifs / projets d'épargne** : montant cible, échéance, compte/actif rattaché,
  suivi de progression.

## 3. Stack technique

| Couche | Choix                                             | Notes |
|---|---------------------------------------------------|---|
| Backend | **Spring Boot 4.0.0**, **Java 21**                | Web, Data JPA, Security, Validation |
| Persistance | **PostgreSQL 16+**, **Flyway**                    | Migrations versionnées |
| Mapping | **MapStruct**, **Lombok**                         | DTO ⇄ entités |
| Doc API | **springdoc-openapi**                             | Swagger UI |
| Auth | **JWT** (access + refresh), BCrypt                | Rôles par foyer |
| Frontend | **Angular 22** (standalone components, signals)   | strict mode |
| UI Kit | **PrimeNG 21.1.x**, PrimeIcons                    | thème par tokens (preset Aura) |
| CSS / layout | **Tailwind CSS (v4)** couplé à PrimeNG            | plugin officiel `tailwindcss-primeui` + CSS layers (remplace PrimeFlex) |
| Graphiques | **Chart.js** via `p-chart` (PrimeNG)              | |
| i18n | Angular i18n + `Intl`                             | formats devise/date localisés |
| Build/CI | Maven (back), Angular CLI (front), GitHub Actions | |

> ⚠️ Socles du projet : Spring Boot **4**, Angular **22**, Tailwind CSS **v4**.
> L'application tourne actuellement avec PrimeNG **21.1.x** (migration vers 22 à planifier
> explicitement). Pour les autres dépendances, garder des versions stables compatibles.

## 4. Comment lire cette spécification

| # | Document | Contenu |
|---|---|---|
| — | [`README.md`](README.md) | Ce fichier : vision, périmètre, stack, glossaire |
| 1 | [`docs/01-business-rules-engine.md`](docs/01-business-rules-engine.md) | **LE moteur de calcul** (règles exactes + vecteurs de test) — pièce maîtresse |
| 2 | [`docs/02-domain-and-data-model.md`](docs/02-domain-and-data-model.md) | Modèle de domaine, entités, schéma SQL, mapping JPA |
| 3 | [`docs/03-architecture.md`](docs/03-architecture.md) | Architecture back/front, sécurité, multi-tenant, multi-devises, i18n |
| 4 | [`docs/04-api-spec.md`](docs/04-api-spec.md) | Contrats REST (endpoints, DTO, erreurs, auth) |
| 5 | [`docs/05-frontend-spec.md`](docs/05-frontend-spec.md) | Écrans Angular + composants PrimeNG + graphiques |
| 6 | [`docs/06-backlog-and-tasks.md`](docs/06-backlog-and-tasks.md) | Backlog séquencé (epics → tâches + critères d'acceptation) |
| — | [`.github/copilot-instructions.md`](.github/copilot-instructions.md) | Conventions de code et garde-fous pour l'agent |

**Ordre de développement recommandé** : lire 1 → 2 → 3, puis construire dans l'ordre du
backlog (6). Le moteur (doc 1) se développe **en test-first** : écrire d'abord les tests
depuis les vecteurs fournis, puis implémenter jusqu'au vert.

## 4-bis. État actuel (implémenté)

- Auth JWT access + refresh (rotation), logout explicite, guards Angular.
- CRUD référentiels et scénarios opérationnels avec scoping multi-foyers strict.
- CRUD postes avec répartition par membre, ventilation compte par membre, aperçu mensuel.
- Paramètres de poste enrichis : `mode`, `moment`, `nature` (`EFFECTIF`/`PREVISION`).
- Projection annuelle enrichie : `mois`, `moisReel`, `moisParMembre`, `moisParMembreReel`.
- Dashboard mensuel : KPI foyer + ventilations catégories + synthèse par membre.
- Script de dev local `dev.ps1` (PostgreSQL + backend + frontend en hot reload).

## 5. Glossaire / langage ubiquitaire

Utiliser **ces termes** (FR) de façon cohérente dans le code, les entités et l'UI.

| Terme | Définition | Nom technique suggéré |
|---|---|---|
| **Foyer** | Unité (locataire/tenant) regroupant des membres, comptes, catégories, scénarios | `Foyer` |
| **Utilisateur** | Compte applicatif qui s'authentifie ; peut accéder à ≥ 0 foyers | `Utilisateur` |
| **Membre** | Personne participant au budget du foyer (ex. Dylan, Mélanie). N'est **pas** forcément un utilisateur | `Membre` |
| **Accès** | Lien utilisateur ⇄ foyer avec un rôle (OWNER / EDITOR / VIEWER) | `AccesFoyer` |
| **Scénario** | Jeu complet d'hypothèses + de postes ; unité de simulation. Un scénario est « de référence » | `Scenario` |
| **Poste** (ou mouvement) | Une ligne budgétaire récurrente, de type REVENU / CHARGE / RESERVE | `Poste` |
| **Type de poste** | REVENU \| CHARGE \| RESERVE | `TypePoste` |
| **Catégorie** | Classification d'un poste (ex. Logement, Salaire, 3ᵉ pilier) | `Categorie` |
| **Compte** | Compte bancaire du foyer (courant, épargne, en commun…) | `Compte` |
| **Actif** | Élément de patrimoine hors compte courant (3ᵉ pilier, crypto, immobilier…) | `Actif` |
| **Périodicité** | Longueur du cycle en **mois** (1 = mensuel, 3 = trimestriel, 12 = annuel…) | `periodiciteMois` |
| **Mode** | `MENSUALISE` (lissé) \| `PERIODIQUE` (montant plein sur un mois du cycle) | `ModeComptabilisation` |
| **Réception/Paiement** | Pour un poste périodique : `DEBUT_PERIODE` \| `FIN_PERIODE` | `MomentPeriode` |
| **Nature** | `EFFECTIF` \| `PREVISION` (descriptif, sans effet sur les calculs standards) | `NaturePoste` |
| **Fenêtre de validité** | Période `[debut, fin]` durant laquelle le poste est actif | `debut`, `fin` |
| **Montant mensualisé** | `montant / periodiciteMois` (montant lissé) | `montantMensualise` |
| **Répartition** | Ensemble de quotes-parts `{membre → part}` sommant à 1, découpant un poste entre membres | `Repartition` |
| **Quote-part** | Part d'un membre dans un poste (∈ [0,1]) | `quotePart` |
| **Part membre** | `contribution × quotePart` (montant attribué à un membre) | `partMembre` |
| **Contribution** | Montant d'un poste imputé à un mois donné (après moteur) | `contribution` |
| **Solde disponible** | `Revenus − Charges − Réserves` pour un mois/une année | `soldeDisponible` |
| **Trésorerie chaînée** | Solde de trésorerie de début d'année = tréso initiale + cumul des soldes annuels précédents | `tresorerieDebutAnnee` |
| **Objectif** | Cible d'épargne (montant, échéance, compte/actif rattaché) | `Objectif` |

## 6. Données d'origine (contexte)

Le classeur analysé : un foyer suisse (2 membres, devise CHF), répartition par défaut
58 %/42 %, année de base 2026, horizon ~9 ans. Ces données ne sont **pas** à
coder en dur : elles servent de jeu de démonstration/seed et de source des vecteurs de
test (voir doc 1). Le fichier Excel d'origine reste la référence sémantique ultime.
