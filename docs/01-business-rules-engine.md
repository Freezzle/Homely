# 01 — Moteur de calcul (règles métier)

> **Pièce maîtresse.** Ce document spécifie l'algorithme de projection budgétaire, à
> reproduire **à l'identique** du classeur Excel d'origine. À développer **en
> test-first** : coder d'abord les tests à partir des [vecteurs de référence](#8-vecteurs-de-test-golden)
> puis implémenter jusqu'au vert. Le moteur doit être une **fonction pure et
> déterministe** (mêmes entrées → mêmes sorties, sans dépendance à l'horloge).

---

## 1. Rôle du moteur

À partir de la liste des **postes** d'un scénario, le moteur calcule :

1. La **contribution** de chaque poste à un mois donné (brique élémentaire).
2. Les **agrégats mensuels** (foyer entier ou par membre) : Revenus, Charges, Réserves,
   Solde disponible.
3. La **projection annuelle** (12 mois) pour une année donnée.
4. La **projection pluriannuelle** avec **trésorerie chaînée** sur l'horizon.
5. Les **ventilations** par catégorie et par compte (pour le tableau de bord mensuel).

## 2. Données d'un poste (entrée du moteur)

| Champ | Type | Rôle dans le moteur |
|---|---|---|
| `type` | REVENU \| CHARGE \| RESERVE | signe dans les agrégats |
| `montant` | décimal ≥ 0 | montant de base `C` |
| `devise` | code ISO | converti vers devise de base (§7) |
| `periodiciteMois` | entier ≥ 0 | longueur du cycle `D` |
| `debut` | date \| null | début de la fenêtre de validité |
| `fin` | date \| null | fin de la fenêtre de validité |
| `mode` | MENSUALISE \| PERIODIQUE | lissé ou montant plein |
| `moment` | DEBUT_PERIODE \| FIN_PERIODE | mois d'imputation si périodique |
| `nature` | EFFECTIF \| ESTIMATION | étiquette métier descriptive (sans impact sur `contribution`) |
| `estimPourcentage` | décimal ∈ [0, 100] \| null | **descriptif uniquement — réservé usage futur** : plage ±% du montant si `nature=ESTIMATION`. Le moteur actuel n'utilise pas ce champ (projections basées sur `montant` seul). |
| `repartition` | `{membre → quotePart}` \| null | découpe entre membres (§6) |
| `ventilationComptes` | `{membre → compte}` | pour la ventilation par compte |

## 3. Brique élémentaire — `contribution(poste, année, mois)`

Le mois est représenté par le **1ᵉʳ jour du mois** : `premierJour = date(année, mois, 1)`.
`finDeMois = dernier jour du mois`. Soit `C = montant`, `D = periodiciteMois`.

### 3.1 Divisor sûr (protection division/modulo par zéro)
```
Dsafe = D + (D == 0 ? 1 : 0)      # si D vaut 0, on le traite comme 1
```

### 3.2 Fenêtre de validité (le poste est-il actif ce mois ?)
```
actifDebut = (debut est null) OU (debut <= finDeMois)
actifFin   = (fin   est null) OU (fin   >= premierJour)
actif      = actifDebut ET actifFin
```
> Sémantique : un poste compte dès que sa date de début est atteinte (au plus tard le
> dernier jour du mois) et tant que sa date de fin n'est pas dépassée (au plus tôt le
> 1ᵉʳ du mois). Un poste sans dates est **toujours actif**.

### 3.3 Indicateurs de comptabilisation
```
estDebut = (D != 1) ET (moment == DEBUT_PERIODE) ET (mode == PERIODIQUE)
estFin   = (D != 1) ET (moment == FIN_PERIODE)   ET (mode == PERIODIQUE)
```
> Un poste **mensuel** (`D == 1`) est toujours lissé, quel que soit le mode.

### 3.4 Ancre de périodicité
```
ancre = (debut est null) ? 1 : mois(debut)     # numéro de mois 1..12 de la date de début
```
> ⚠️ Point subtil confirmé dans l'Excel : la récurrence périodique se calcule **sur le
> numéro de mois modulo la périodicité**, en ignorant l'année et le jour. Une charge
> trimestrielle ancrée en janvier tombe donc en janvier, avril, juillet, octobre de
> **chaque** année.

### 3.5 Calcul final
```
si NON actif:
    contribution = 0
sinon si estDebut:
    contribution = ((mois - ancre)     mod Dsafe == 0) ? C : 0
sinon si estFin:
    contribution = ((mois - ancre + 1) mod Dsafe == 0) ? C : 0
sinon:                              # MENSUALISE, ou D == 1
    contribution = C / Dsafe
```
> Le modulo doit être **euclidien** (résultat ≥ 0). En Java : `Math.floorMod(a, Dsafe)`.

### 3.7 Variante — `contributionReelle(poste, année, mois)`

But : visualiser les encaissements/décaissements **effectifs** mois par mois, sans lissage.

- Fenêtre de validité : identique à `contribution`.
- Si `D == 1` (ou `D == 0`), contribution réelle = `C` chaque mois actif.
- Si `D > 1`, la logique d'imputation est forcée en périodique (même si le poste est
  stocké en `MENSUALISE`) :
  - `moment == DEBUT_PERIODE` → `((mois - ancre) mod Dsafe == 0) ? C : 0`
  - `moment == FIN_PERIODE` → `((mois - ancre + 1) mod Dsafe == 0) ? C : 0`

Invariant utile : sur une année complète couverte par la fenêtre, la somme des 12 mois
de `contributionReelle` est égale à la somme des 12 mois de `contribution`.

### 3.6 Montant mensualisé (champ dérivé, affiché dans les listes)
```
montantMensualise = (C == null OU D == null OU D == 0) ? 0 : C / Dsafe
```

## 4. Agrégats mensuels

Pour une année `Y`, un mois `M`, et un **périmètre** (foyer entier, ou un membre `m`) :

```
facteurMembre(poste, périmètre) =
    si périmètre == FOYER      -> 1
    si périmètre == membre m   -> quotePartEffective(poste, m)     # voir §6

totalType(T) = Σ sur les postes de type T de:
                 contribution(poste, Y, M)
                 × facteurMembre(poste, périmètre)
                 × tauxConversion(poste.devise -> deviseBase)      # voir §7

revenus  = totalType(REVENU)
charges  = totalType(CHARGE)
reserves = totalType(RESERVE)
soldeDisponible = revenus - charges - reserves
```

## 5. Projection annuelle & trésorerie chaînée

### 5.1 Projection annuelle (une année, 12 mois)
Pour chaque `M` de 1 à 12, calculer `(revenus, charges, reserves, soldeDisponible)`.
Le **total annuel** est la somme des 12 mois de chaque colonne. Le tableau de bord
annuel produit trois projections : **FOYER**, puis **une par membre**.

La réponse annuelle expose désormais deux séries mensuelles :

- `mois` : projection **mensualisée** (respecte `mode`).
- `moisReel` : projection **réelle** (imputation non lissée, cf. §3.7).

Et côté membre :

- `moisParMembre` : mensualisé.
- `moisParMembreReel` : réel.

### 5.2 Trésorerie chaînée (multi-années)
Soit `H` = horizon (nombre d'années), `Y0` = année de départ, `T0` = trésorerie
initiale (scalaire, hypothèse du scénario).

```
soldeAnnuel(Y)  = Σ sur M=1..12 de soldeDisponible(FOYER, Y, M)

tresorerieDebutAnnee(Yi) = T0 + Σ sur j de 0 à i-1 de soldeAnnuel(Y0 + j)
```
> C'est-à-dire : trésorerie au 1ᵉʳ janvier de l'année `Yi` = trésorerie initiale + cumul
> des soldes annuels de **toutes les années précédentes**. (Reproduit la colonne
> « Trésorerie 1er janv » du Moteur Excel : `B8 + SUMIF(années < Y ; soldes)`.)

On peut aussi exposer `tresorerieFinAnnee(Yi) = tresorerieDebutAnnee(Yi) + soldeAnnuel(Yi)`
et une **courbe mensuelle** cumulée pour un graphique lissé.

## 6. Répartition entre N membres — périodes temporelles & typeRepartition

### 6.1 Modèle de périodes

Le **scénario** possède une liste ordonnée de **périodes de répartition** `[début, fin]`
(couverture continue recommandée, une seule période ouverte `fin = null`).
Chaque période porte un vecteur `{membre → quotePart}` avec `Σ quotePart = 1`.

La **période active** pour un mois `(Y, M)` est la première période dont `[début, fin]`
couvre le `1er jour du mois`.

### 6.2 typeRepartition d'un poste

Chaque **poste** porte un `typeRepartition` :

| Valeur | Comportement |
|--------|--------------|
| `AUTO` (défaut) | Utilise la quote-part de la **période active** du scénario |
| `REVERSE_AUTO` | Inverse normalisé : `(1 − pᵢ) / (N − 1)` ; pour N=2 permute exactement les parts (58/42 → 42/58) |
| `CUSTOM` | Quote-part stockée ligne par ligne sur le poste (table `repartition_poste`) |

```
quotePartEffective(poste, m, Y, M) =
    si nbMembres ≤ 1                → 1,0                         (cas mono-membre)
    si typeRepartition == CUSTOM    → poste.repartition[m]        (0 si absent)
    si typeRepartition == AUTO      → periodeActive(Y,M)[m]       (0 si absent)
    si typeRepartition == REVERSE_AUTO
                                    → (1 − periodeActive(Y,M)[m]) / (N − 1)

partMembre(poste, m, Y, M) = contribution(poste, Y, M) × quotePartEffective(poste, m, Y, M)
```

### 6.3 Cas mono-membre

Si le scénario n'a qu'un seul membre actif, `quotePartEffective = 1,0` pour tous les
types ; aucune période ni répartition n'est nécessaire. L'UI masque les contrôles de
répartition.

### 6.4 Cycle de vie des membres

- **Ajout d'un membre** : toutes les périodes existantes reçoivent `quotePart = 0` pour
  le nouveau membre (somme reste 1). L'utilisateur doit ajuster les parts via l'éditeur
  de périodes.
- **Désactivation d'un membre** :
  - La période ouverte est fermée (`fin = veille`).
  - Une nouvelle période ouverte est créée pour les membres restants avec parts
    équitables (arrondi sur le dernier membre).
  - Les périodes fermées conservent les données historiques avec le membre désactivé.

### 6.5 Règles de validation (bloquantes)

- `|Σ quotePart − 1| ≤ 1e-6` pour chaque période et chaque poste CUSTOM (HTTP 422).
- Au plus une période ouverte (`fin = null`) par scénario.
- Pas de chevauchement entre périodes.

> **Compatibilité Excel** : avec exactement 2 membres, une période unique ouverte
> `{M1:0,58 ; M2:0,42}` et tous postes `AUTO`, les formules redonnent
> `Part M1 = contribution × 0,58` et `Part M2 = contribution × 0,42` —
> **identiques au classeur**. Les golden vectors §8-bis T2 restent verts.

## 7. Multi-devises (extension)

- Le foyer a une **devise de base** (`deviseBase`, ex. CHF).
- Chaque poste a une `devise` (défaut = `deviseBase`).
- Le foyer maintient une table de **taux** `{devise → tauxVersBase}` (taux prévisionnel
  fixe, pas d'historique FX pour un outil de prévision).

```
tauxConversion(devise -> deviseBase) =
    (devise == deviseBase) ? 1 : foyer.taux[devise]   # défaut 1 si non défini + warning
```
> **Compatibilité Excel** : si tous les postes sont en `deviseBase`, le facteur vaut 1
> partout et le comportement est **identique** à l'Excel. La conversion est appliquée
> **après** la contribution et **avant** l'agrégation (§4). Les montants restituent la
> devise de base ; l'UI formate selon la locale.

## 8. Ventilations (tableau de bord mensuel)

Pour un mois `(Y, M)` donné :

**Par catégorie** (par type) :
```
montantCategorie(cat) = Σ sur postes de catégorie `cat` de
                          contribution(poste, Y, M) × tauxConversion(...)
```

**Par compte** (pour un membre `m`) :
```
montantCompteMembre(compte, m, T) =
    Σ sur postes de type T dont ventilationComptes[m] == compte de
      partMembre(poste, m, Y, M) × tauxConversion(...)
```
> Reproduit les blocs « Charges/Revenus/Réserves par compte » du Dashboard du mois, où
> chaque bloc filtre sur la colonne « Compte M1 » (resp. M2) et somme la part du membre.

## 9. Extension patrimoine (net worth) — sémantique à respecter

Module **nouveau** (absent de l'Excel). Le principe reprend la trésorerie chaînée mais
**par compte/actif** :

- Chaque **compte** et **actif** a un `soldeInitial` (au 1ᵉʳ janvier de `Y0`) et un
  `tauxCroissanceAnnuel` optionnel (appréciation, ex. investissements/3ᵉ pilier).
- **Flux mensuel imputé à un compte** dérivé des postes :
  - REVENU → `+ partMembre` sur le compte du membre.
  - CHARGE → `− partMembre` sur le compte du membre.
  - RESERVE → **transfert** : `− partMembre` sur le compte du membre (débit via
    `ventilationComptes[m]`) et `+ partMembre` sur ce même compte d'épargne/destination.
    Le compte de débit n'est plus configurable au niveau du poste ; il est entièrement
    porté par la ventilation du membre.
- **Solde projeté** d'un compte au mois `t` = `soldeInitial` + cumul des flux imputés
  jusqu'à `t` + appréciation prorata temporis.
- **Net worth** au mois `t` = Σ (soldes projetés de tous les comptes + actifs).

> ⚠️ **Écart assumé vs Excel** : l'Excel ne modélisait que le *décaissement* des
> réserves (elles réduisent le solde disponible) sans créditer le compte d'épargne. Le
> module patrimoine **ajoute** le côté crédit (transfert), afin que le net worth
> augmente quand on épargne. Cet écart est **volontaire** et documenté ; il ne modifie
> **pas** le calcul du solde disponible / de la trésorerie du §5 (qui reste identique à
> l'Excel).

## 10. Objectifs / projets d'épargne — calculs

Un objectif = `{montantCible, echeance, compteOuActifRattache, membre(s)}`.

```
soldeCourantObjectif = solde projeté (§9) du compte/actif rattaché à la date du jour
progressionPct       = min(100, soldeCourantObjectif / montantCible × 100)
moisRestants         = nb de mois entre aujourd'hui et echeance
epargneMensuelleRequise = max(0, (montantCible - soldeCourantObjectif) / moisRestants)
dateAtteintePrevue   = 1er mois où le solde projeté ≥ montantCible (ou null si jamais)
```

## 11. Précision, arrondis, performances

- Calculs internes en **double** (comme Excel) ; **arrondir uniquement à l'affichage**
  (2 décimales). Ne pas arrondir les étapes intermédiaires (sinon divergence vs vecteurs).
- Une projection annuelle FOYER = 12 mois × N postes ; multi-années = H × 12 × N. Pour
  N ≤ quelques centaines et H ≤ 50, un calcul direct suffit (pas d'optimisation
  prématurée). Prévoir un **cache** par (scénario, version) invalidé à chaque
  modification de poste.
- Le moteur ne lit **jamais** l'horloge pour la projection (déterminisme). Seuls les
  écrans « mois courant / objectifs » utilisent la date du jour, en paramètre explicite.

## 12. Table de vérité (mode × périodicité × moment)

| Périodicité | Mode | Moment | Comportement |
|---|---|---|---|
| 1 | quelconque | quelconque | lissé = montant plein chaque mois actif |
| > 1 | MENSUALISE | — | `montant / D` chaque mois actif |
| > 1 | PERIODIQUE | DEBUT_PERIODE | montant plein le mois où `(mois − ancre) mod D == 0` |
| > 1 | PERIODIQUE | FIN_PERIODE | montant plein le mois où `(mois − ancre + 1) mod D == 0` |
| 0 | quelconque | — | Dsafe = 1 ⇒ traité comme mensuel |

### Lecture complémentaire — projection réelle

Pour la projection réelle, les lignes `D > 1` se lisent comme si le `Mode` était
`PERIODIQUE` (le `moment` reste déterminant). Les lignes `D == 1` restent inchangées.

---

## 8-bis. Vecteurs de test (golden)

Jeu de données de référence = le classeur d'origine (foyer 2 membres, CHF, répartition
défaut 0,58/0,42, année de départ **2026**, trésorerie initiale **0**). **Valeurs
vérifiées au centime contre Excel/LibreOffice.** Le moteur DOIT les reproduire.

### T1 — Contributions élémentaires
| Poste | Type | Montant | D | Mode / Moment | Mois testé | Contribution attendue |
|---|---|---|---|---|---|---|
| Loyer | CHARGE | 1500 | 1 | MENSUALISE | jan/juin/déc 2026 | **1500** chaque mois |
| Électricité | CHARGE | 360 | 3 | MENSUALISE | jan 2026 | **120** (= 360/3, chaque mois) |
| 13ᵉ salaire | REVENU | 6300 | 12 | PERIODIQUE / DEBUT (ancre nov) | oct / **nov** / déc 2026 | 0 / **6300** / 0 |
| 3a pilier (réserve) | RESERVE | 3600 | 12 | PERIODIQUE / DEBUT (ancre nov) | juin / **nov** 2026 | 0 / **3600** |

### T2 — Projection annuelle 2026 (périmètre FOYER)
Colonnes en CHF : Revenus / Charges / Réserves / Solde disponible.

| Mois | Revenus | Charges | Réserves | Solde |
|---|---:|---:|---:|---:|
| Janvier | 11 000,00 | 5 172,67 | 410,00 | 5 417,33 |
| Février | 11 000,00 | 5 172,67 | 410,00 | 5 417,33 |
| Mars | 11 000,00 | 5 172,67 | 410,00 | 5 417,33 |
| Avril | 11 500,00 | 5 172,67 | 410,00 | 5 917,33 |
| Mai | 11 000,00 | 5 172,67 | 410,00 | 5 417,33 |
| Juin | 11 000,00 | 5 172,67 | 410,00 | 5 417,33 |
| Juillet | 11 000,00 | 5 172,67 | 410,00 | 5 417,33 |
| Août | 11 230,00 | 5 222,67 | 410,00 | 5 597,33 |
| Septembre | 11 230,00 | 5 222,67 | 410,00 | 5 597,33 |
| Octobre | 11 230,00 | 5 222,67 | 410,00 | 5 597,33 |
| Novembre | 17 530,00 | 5 222,67 | 4 010,00 | 8 297,33 |
| Décembre | 11 630,00 | 5 222,67 | 410,00 | 5 997,33 |
| **TOTAL ANNÉE** | **140 350,00** | **62 322,00** | **8 520,00** | **69 508,00** |

> Note : les valeurs 5 172,66… sont des doubles non arrondis en interne (360/3 + 630/12
> + 335/12 + … donnent des fractions). Comparer avec une tolérance de ±0,01 après arrondi
> d'affichage, ou ±1e-6 en interne.

### T3 — Trésorerie chaînée (horizon 9 ans, Y0 = 2026, T0 = 0)
| Année | Solde annuel (CHF) | Trésorerie 1er janv (CHF) |
|---|---:|---:|
| 2026 | 69 508,00 | 0,00 |
| 2027 | 58 968,00 | 69 508,00 |
| 2028 | 59 518,00 | 128 476,00 |
| 2029 | 60 018,00 | 187 994,00 |
| 2030 | 61 068,00 | 248 012,00 |
| 2031 | 61 568,00 | 309 080,00 |
| 2032 | 62 068,00 | 370 648,00 |
| 2033 | 62 618,00 | 432 716,00 |
| 2034 | 62 618,00 | 495 334,00 |

### T4 — Répartition par membre (contrôle)
Pour n'importe quel mois, `partMembre(M1) + partMembre(M2) = contribution` (foyer). Avec
la répartition défaut 0,58/0,42 : `revenus(M1, 2026, janvier) = 11 000 × 0,58 = 6 380` ;
`revenus(M2, …) = 4 620`. (Certains postes ont un override — la somme M1+M2 doit toujours
égaler le total FOYER du T2.)

### T5 — Cas limites à couvrir par des tests unitaires
- `D = 0` → traité comme mensuel (Dsafe = 1), pas de division par zéro.
- Poste sans date de début **et** sans date de fin → actif tous les mois.
- Poste dont `fin` tombe en cours d'année → contributions nulles après `fin`.
- Poste `PERIODIQUE` dont l'ancre = mars, `D = 6` → tombe en mars et septembre.
- Montant/valeur manquants → contribution 0 (pas d'exception).
- Modulo avec `mois - ancre` négatif → doit utiliser le modulo euclidien (`floorMod`).
