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
- **Nature de poste descriptive** : `EFFECTIF` ou `ESTIMATION` (sans impact sur la
  sémantique du moteur classique).
- **Double lecture annuelle** : projection mensualisée (historique) + projection réelle
  (imputations non lissées au mois d'échéance).

### Modules fonctionnels de la V1
- **Multi-scénarios (what-if)** : chaque scénario est un jeu complet d'hypothèses + de
  postes ; duplication et comparaison côte à côte.
- **Objectifs / projets d'épargne** : montant cible, échéance, compte rattaché,
  suivi de progression.
- **Argent de poche** : par membre et scénario, une `PolitiqueArgentPoche` récurrente
  (socle + % du surplus plafonné, ou montant fixe) et/ou des `AllocationArgentPoche`
  ponctuelles (un mois précis, prioritaires sur la politique) réduisent directement le
  **solde disponible** calculé par le moteur. Purement prévisionnel (aucune dépense
  réelle suivie). Voir [doc 01 §13](01-business-rules-engine.md#13-argent-de-poche--impact-sur-le-solde-disponible).

## 3. Stack technique

| Couche | Choix                                             | Notes |
|---|---------------------------------------------------|---|
| Backend | **Spring Boot 4.0.0**, **Java 21**                | Web, Data JPA, Security, Validation |
| Persistance | **PostgreSQL 16+**, **Flyway**                    | Migrations versionnées |
| Mapping | **MapStruct**, **Lombok**                         | DTO ⇄ entités |
| Doc API | **springdoc-openapi**                             | Swagger UI |
| Auth | **JWT** (access + refresh), BCrypt                | Rôles par foyer |
| Frontend | **Angular 22** (standalone components, signals)   | strict mode |
| UI Kit | **PrimeNG 22.x**, PrimeIcons                      | thème par tokens (preset Aura) |
| CSS / layout | **Tailwind CSS (v4)** couplé à PrimeNG            | plugin officiel `tailwindcss-primeui` + CSS layers (remplace PrimeFlex) |
| Graphiques | **Chart.js** via `p-chart` (PrimeNG)              | |
| i18n | **ngx-translate** (`@ngx-translate/core` + `http-loader`) + `Intl` | traductions JSON (`assets/i18n/fr.json`, `en.json`), sélecteur FR/EN dans la topbar, formats devise/date localisés |
| Build/CI | Maven (back), Angular CLI (front), GitHub Actions | ⚠️ pipeline CI non implémenté à ce jour (voir docs/06 T0.4) |

> ⚠️ Socles du projet : Spring Boot **4**, Angular **22**, Tailwind CSS **v4**.
> L'application tourne avec **PrimeNG 22** (migration depuis 21 effectuée). Pour les
> autres dépendances, garder des versions stables compatibles.

## 4. Comment lire cette spécification

| # | Document | Contenu |
|---|---|---|
| — | [`../README.md`](../README.md) | Exécution projet (dev/prod), stack runtime, publication OpenAPI |
| — | [`README.md`](README.md) | Ce fichier : vision, périmètre, stack, glossaire |
| 0 | [`docs/00-synthese.md`](00-synthese.md) | **Cartographie de synthèse** métier + technique, état réel du code, écarts vs documentation |
| 1 | [`docs/01-business-rules-engine.md`](01-business-rules-engine.md) | **LE moteur de calcul** (règles exactes + vecteurs de test) — pièce maîtresse |
| 2 | [`docs/02-domain-and-data-model.md`](02-domain-and-data-model.md) | Modèle de domaine, entités, schéma SQL, mapping JPA |
| 3 | [`docs/03-architecture.md`](03-architecture.md) | Architecture back/front, sécurité, multi-tenant, multi-devises, i18n |
| 4 | [`docs/04-api-spec.md`](04-api-spec.md) | Contrats REST (endpoints, DTO, erreurs, auth) |
| 5 | [`docs/05-frontend-spec.md`](05-frontend-spec.md) | Écrans Angular + composants PrimeNG + graphiques |
| 6 | [`docs/06-backlog-and-tasks.md`](06-backlog-and-tasks.md) | Backlog séquencé (epics → tâches + critères d'acceptation) |
| — | [`docs/openapi/README.md`](openapi/README.md) | Procédure de publication des snapshots OpenAPI |
| — | [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) | Conventions de code et garde-fous pour l'agent |

**Ordre de développement recommandé** : lire 0 (état réel) → 1 → 2 → 3, puis construire
dans l'ordre du backlog (6). Le moteur (doc 1) se développe **en test-first** : écrire
d'abord les tests depuis les vecteurs fournis, puis implémenter jusqu'au vert.

## 4-bis. État actuel (implémenté) — voir aussi [docs/00-synthese.md](00-synthese.md)

- Auth JWT access (15 min) + refresh (rotation, 7 jours, cookie httpOnly), logout
  explicite, guards Angular.
- CRUD référentiels et scénarios opérationnels avec scoping multi-foyers strict.
- CRUD postes avec répartition par membre, ventilation compte par membre, aperçu mensuel.
- Cycle de vie du poste : révision de montant chaînée, annulation, décalage de fenêtre,
  clôture/réactivation.
- Périodes de répartition (`RepartitionPeriode`) : quotes-parts variables dans le temps,
  classification `AUTO`/`REVERSE_AUTO`/`CUSTOM` par poste.
- Paramètres de poste enrichis : `mode`, `moment`, `nature` (`EFFECTIF`/`ESTIMATION`).
- Projection annuelle enrichie : `mois`, `moisReel`, `moisParMembre`, `moisParMembreReel`.
- Moteur — détection d'**événements budgétaires** (`MoteurCalcul#evenements` :
  DEBUT/FIN/REVISION de poste par mois) exposée via `GET .../projection/evenements`
  (filtrage/prorata par membre côté backend).
- **Tableau de bord unifié** (foyer et **par membre**) : écran unique piloté par l'URL
  (`dashboard/:sujetId/:annee/:mois?`), remplace les anciens écrans séparés annuel/mensuel ;
  frise chronologique des événements budgétaires, onglets récap/graphiques/échéances/objectifs.
- Second foyer de démonstration (« Foyer Berthoud », anonymisé) en plus du foyer Charmillot.
- `run-ng.ps1` : wrapper local pour lancer le frontend Angular (`ng serve`).
- **Argent de poche** : `PolitiquePoche`/`AllocationSurMesure` (CRUD complet), résolution
  (`allocation > politique > 0`) intégrée au moteur (soustraite du solde disponible via
  `ArgentDePocheProvider`) et à l'indicateur **taux d'effort** (jauge "charges + réserves
  + argent de poche"), écran dédié + widget dashboard par membre.
- **Enrichissements poste** : `moment = INCONNU` (date de paiement non connue, impose
  `MENSUALISE`), `importance` et `potentiel_optimisation` (échelle 1-5, descriptifs,
  sans impact sur le moteur).
- **Compte primaire par membre** (`compte_membre.est_primaire`) : compte source des
  virements de comblement, un seul par membre.

**Non implémenté à ce jour** (malgré une mention antérieure « fait » dans le backlog,
corrigée par la cartographie `docs/00`) :
- Projection **patrimoine / net worth** (endpoint + écran).
- **Comparaison de scénarios** (endpoint + écran).
- **Pagination/tri** standard sur les listes API.
- Pipeline **CI GitHub Actions**.
- Couverture de **tests unitaires frontend** (0 fichier `.spec.ts`).

## 4-ter. Règle permanente pour l'agent : maintenir la documentation à jour

> **Toute tâche de développement doit se terminer par une mise à jour des documents
> concernés dans `/docs`**, dans la même PR (pas de PR « doc » séparée). Ne pas attendre
> une demande explicite de « cartographie ».

Checklist à la fin de chaque tâche :

| Changement | Doc(s) à mettre à jour |
|---|---|
| Moteur ou modèle de domaine | [01](01-business-rules-engine.md) (règles/vecteurs), [02](02-domain-and-data-model.md) (entités, schéma, migration Flyway) |
| Architecture, sécurité, stack | [03](03-architecture.md) |
| Endpoint ajouté/modifié/supprimé | [04](04-api-spec.md) |
| Écran/route/composant Angular | [05](05-frontend-spec.md) |
| Statut réel d'une tâche du backlog | [06](06-backlog-and-tasks.md) — ne jamais cocher `[x]` sans avoir vérifié que le code existe |
| Écart doc ↔ code introduit ou corrigé | [00](00-synthese.md) §6 |

Règles pratiques : documenter **l'état réel du code**, pas l'intention (dire
explicitement si une fonctionnalité est partielle) ; une mise à jour peut être une
simple ligne de tableau, pas besoin de réécrire tout un document ; en cas de doute,
préférer une note courte mais exacte à une omission.

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
| **Périodicité** | Longueur du cycle en **mois** (1 = mensuel, 3 = trimestriel, 12 = annuel…) | `periodiciteMois` |
| **Mode** | `MENSUALISE` (lissé) \| `PERIODIQUE` (montant plein sur un mois du cycle) | `ModeComptabilisation` |
| **Réception/Paiement** | Pour un poste périodique : `DEBUT_PERIODE` \| `FIN_PERIODE` | `MomentPeriode` |
| **Nature** | `EFFECTIF` \| `ESTIMATION` (descriptif, sans effet sur les calculs standards) | `NaturePoste` |
| **Fenêtre de validité** | Période `[debut, fin]` durant laquelle le poste est actif | `debut`, `fin` |
| **Montant mensualisé** | `montant / periodiciteMois` (montant lissé) | `montantMensualise` |
| **Répartition** | Ensemble de quotes-parts `{membre → part}` sommant à 1, découpant un poste entre membres | `Repartition` |
| **Quote-part** | Part d'un membre dans un poste (∈ [0,1]) | `quotePart` |
| **Part membre** | `contribution × quotePart` (montant attribué à un membre) | `partMembre` |
| **Contribution** | Montant d'un poste imputé à un mois donné (après moteur) | `contribution` |
| **Solde disponible** | `Revenus − Charges − Réserves` pour un mois/une année | `soldeDisponible` |
| **Trésorerie chaînée** | Solde de trésorerie de début d'année = tréso initiale + cumul des soldes annuels précédents | `tresorerieDebutAnnee` |
| **Objectif** | Cible d'épargne (montant, échéance, compte rattaché) | `Objectif` |
| **Argent de poche** | Montant mensuel résolu pour un membre, retranché du solde disponible ; prévisionnel uniquement | `ArgentPocheService#resoudre` |
| **Politique d'argent de poche** | Règle récurrente sur une période : socle + % du surplus (plafonné) ou montant fixe | `PolitiqueArgentPoche` |
| **Allocation sur mesure** | Montant ponctuel pour un membre/mois précis, prioritaire sur la politique | `AllocationArgentPoche` |

## 6. Données d'origine (contexte)

Le classeur analysé : un foyer suisse (2 membres, devise CHF), répartition par défaut
58 %/42 %, année de base 2026, horizon ~9 ans. Ces données ne sont **pas** à
coder en dur : elles servent de jeu de démonstration/seed et de source des vecteurs de
test (voir doc 1). Le fichier Excel d'origine reste la référence sémantique ultime.
