# Homely — Budget Foyer · Documentation

> Réécriture d'un classeur Excel de **prévision budgétaire familiale** en application web
> SaaS multi-foyers. **Prévision uniquement** : ni saisie de transactions réelles, ni
> import bancaire, ni rapprochement. Cette doc est la **référence métier et technique**
> pour toute nouvelle tâche.

## Vision

Un **simulateur de budget prévisionnel** pour un foyer : on décrit des **postes
récurrents** (revenus, charges, réserves) avec leur périodicité et leur fenêtre de
validité, et l'application **projette mois par mois et année par année** les flux
financiers ainsi que la **trésorerie cumulée** sur plusieurs années.

Le **cœur** reproduit **au centime** la logique du classeur d'origine (lissage vs
comptabilisation périodique, fenêtres de validité, prorata entre membres, trésorerie
chaînée). Extensions par rapport à l'Excel : multi-foyers authentifié, **N membres**
(prorata vectoriel), multi-devises, argent de poche, graphiques.

## Documents de référence

| # | Document | Contenu |
|---|---|---|
| 1 | [`01-principes-et-moteur.md`](01-principes-et-moteur.md) | **Pièce maîtresse** : principes financiers (cascade RàV, types d'argent) + moteur de calcul (règles exactes + **vecteurs golden**) |
| 2 | [`02-domaine-et-donnees.md`](02-domaine-et-donnees.md) | Entités, relations, énumérations, schéma PostgreSQL, migrations Flyway |
| 3 | [`03-architecture.md`](03-architecture.md) | Architecture back/front, moteur isolé, sécurité multi-tenant, devises, i18n, config |
| 4 | [`04-api-et-frontend.md`](04-api-et-frontend.md) | Contrats REST (endpoints réels, `ApiError`) + écrans Angular / PrimeNG |

Exécution du projet (dev/prod, tests) : [`../README.md`](../README.md).
Conventions et garde-fous de l'agent : [`../.github/copilot-instructions.md`](../.github/copilot-instructions.md).

## Règles d'or

1. **Le moteur se développe test-first** depuis les vecteurs golden (doc 01) ; ces tests
   ne régressent **jamais**.
2. **Fidélité à l'Excel au centime** pour le cœur ; les extensions restent neutres quand
   elles ne sont pas utilisées (2 membres, devise unique).
3. **Multi-tenant strict** : toute donnée est scopée par foyer (ou scénario du foyer).
   Test d'accès croisé obligatoire par endpoint sensible.
4. **Calcul en `double`** dans le moteur, `BigDecimal` au stockage/DTO ; **arrondir
   uniquement à l'affichage**. Modulo **euclidien** (`Math.floorMod`).
5. **Ne pas coder en dur** les données du foyer d'exemple (elles vivent dans le seed
   Flyway).

## Glossaire — langage ubiquitaire

Termes FR à utiliser de façon cohérente dans le code, les entités et l'UI.

| Terme | Définition | Nom technique |
|---|---|---|
| **Foyer** | Tenant regroupant membres, comptes, catégories, scénarios | `Foyer` |
| **Utilisateur** | Compte qui s'authentifie ; accède à ≥ 0 foyers | `Utilisateur` |
| **Membre** | Personne du budget (pas forcément un utilisateur) | `Membre` |
| **Accès** | Lien utilisateur ⇄ foyer + rôle (OWNER/EDITOR/VIEWER) | `AccesFoyer` |
| **Scénario** | Jeu d'hypothèses + de postes ; unité de simulation | `Scenario` |
| **Poste** | Ligne budgétaire récurrente REVENU / CHARGE / RESERVE | `Poste` |
| **Catégorie** | Classification d'un poste | `Categorie` |
| **Compte** | Compte bancaire du foyer | `Compte` |
| **Périodicité** | Longueur du cycle en mois (1 = mensuel, 12 = annuel…) | `periodiciteMois` |
| **Mode** | `MENSUALISE` (lissé) \| `PERIODIQUE` (montant plein) | `ModeComptabilisation` |
| **Moment** | Poste périodique : `DEBUT_PERIODE` \| `FIN_PERIODE` \| `INCONNU` | `MomentPeriode` |
| **Nature** | `EFFECTIF` \| `ESTIMATION` (descriptif) | `NaturePoste` |
| **Fenêtre de validité** | Période `[debut, fin]` d'activité du poste | `debut`, `fin` |
| **Montant mensualisé** | `montant / periodiciteMois` | `montantMensualise` |
| **Répartition** | Quotes-parts `{membre → part}` sommant à 1 | `Repartition` |
| **Quote-part** | Part d'un membre dans un poste (∈ [0,1]) | `quotePart` |
| **Part membre** | `contribution × quotePart` | `partMembre` |
| **Contribution** | Montant d'un poste imputé à un mois | `contribution` |
| **Solde disponible / RàV** | `Revenus − Charges − Réserves` | `soldeDisponible` |
| **Trésorerie chaînée** | Tréso initiale + cumul des soldes annuels précédents | `tresorerieDebutAnnee` |
| **Objectif** | Cible d'épargne (montant, échéance, compte) | `Objectif` |
| **Argent de poche** | Montant mensuel retranché du solde disponible (prévisionnel) | `ArgentPocheService` |

> Données d'origine (contexte) : foyer suisse 2 membres, CHF, répartition défaut
> 58 %/42 %, année de base 2026. Servent de seed et de source des vecteurs golden — jamais
> codées en dur.
