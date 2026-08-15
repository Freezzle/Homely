# 01 — Principes fondamentaux & moteur de calcul

> **Référence métier maîtresse.** Ce document définit le modèle financier de l'application
> et l'algorithme de projection budgétaire, à reproduire **à l'identique** du classeur
> Excel d'origine. Le moteur (`ch.homely.moteur`) est une **fonction pure et déterministe**
> (mêmes entrées → mêmes sorties, sans lecture de l'horloge), développée **test-first** à
> partir des [vecteurs golden](#12-vecteurs-de-test-golden). Ces tests ne régressent jamais.

> **Décisions gouvernées par ce doc** : toute logique de calcul (contribution, agrégats, trésorerie chaînée, répartition N membres, devises, ventilations, événements, argent de poche) et la conformité au centime via les vecteurs golden.

---

## 1. Principes — types d'argent & cascade

Tous les mouvements ne se comportent pas pareil ; les confondre est la première source
d'erreurs.

- **Mouvements externes** — l'argent traverse la frontière du foyer. → `Revenu`, `Charge`.
- **Mouvement interne** — l'argent change de compte mais reste dans le foyer (patrimoine
  total inchangé). → `Réserve`.
- **Mouvement dérivé** — calculé à partir du Reste à vivre puis traité comme dépensé. →
  `Argent de poche`.

### Cascade de calcul (mensuelle)
```
Revenus − Charges − Réserves        = Reste à vivre (RàV) / solde disponible brut
RàV − Argent de poche               = solde disponible net (tréso libre du mois)
```
L'argent de poche n'entre **jamais** dans le calcul du RàV : il en est un résultat, puis
il est soustrait. Le RàV peut être négatif (affiché tel quel, pas clampé).

| Type | RàV | Comptes impactés | Modèle de données |
|---|---|---|---|
| Revenu | ↑ | 1 (crédité) | `compteDestination` |
| Charge | ↓ | 1 (débité) | `compteSource` |
| Réserve | ↓ | 2 (débité + crédité) | ventilation du membre (transfert interne) |
| Argent de poche | inchangé | 1 (débité) | `compteId` de dépôt |

## 2. Rôle du moteur

À partir des **postes** d'un scénario, le moteur calcule : la **contribution** de chaque
poste à un mois donné, les **agrégats mensuels** (foyer ou par membre), la **projection
annuelle** (12 mois), la **projection pluriannuelle** avec **trésorerie chaînée**, et les
**ventilations** par catégorie et par compte.

### Données d'un poste (entrée)
| Champ | Type | Rôle |
|---|---|---|
| `type` | REVENU \| CHARGE \| RESERVE | signe dans les agrégats |
| `montant` | décimal ≥ 0 | montant de base `C` |
| `devise` | code ISO | converti vers devise de base (§6) |
| `periodiciteMois` | entier ≥ 0 | longueur du cycle `D` |
| `debut` / `fin` | date \| null | fenêtre de validité |
| `mode` | MENSUALISE \| PERIODIQUE | lissé ou montant plein |
| `moment` | DEBUT_PERIODE \| FIN_PERIODE \| INCONNU | mois d'imputation si périodique ; `INCONNU` impose `MENSUALISE` |
| `nature` | EFFECTIF \| ESTIMATION | étiquette descriptive (sans impact sur `contribution`) |
| `repartition` | `{membre → quotePart}` \| null | découpe entre membres (§5) |
| `ventilationComptes` | `{membre → compte}` | ventilation par compte |

## 3. Brique élémentaire — `contribution(poste, année, mois)`

Mois représenté par le 1ᵉʳ jour : `premierJour = date(année, mois, 1)`, `finDeMois =
dernier jour du mois`. Soit `C = montant`, `D = periodiciteMois`.

```
# Diviseur (D == 0 est traité à part comme "one-shot", cf. ci-dessous)
Dsafe = D

# Fenêtre de validité (poste sans dates = toujours actif)
actifDebut = (debut est null) OU (debut <= finDeMois)
actifFin   = (fin   est null) OU (fin   >= premierJour)
actif      = actifDebut ET actifFin

# Indicateurs (un poste mensuel D==1 est toujours lissé ; D==0 = one-shot)
estOneShot = (D == 0)
estDebut = (D != 1) ET (D != 0) ET (moment == DEBUT_PERIODE) ET (mode == PERIODIQUE)
estFin   = (D != 1) ET (D != 0) ET (moment == FIN_PERIODE)   ET (mode == PERIODIQUE)

# Ancre : numéro de mois 1..12 de la date de début (année/jour ignorés)
ancre = (debut est null) ? 1 : mois(debut)

# Calcul final (modulo EUCLIDIEN : Math.floorMod)
si NON actif           : contribution = 0
sinon si estOneShot    : contribution = (debut != null ET année(debut)==année ET mois(debut)==mois) ? C : 0
sinon si estDebut      : contribution = ((mois - ancre)     mod Dsafe == 0) ? C : 0
sinon si estFin        : contribution = ((mois - ancre + 1) mod Dsafe == 0) ? C : 0
sinon                  : contribution = C / Dsafe        # MENSUALISE, ou D == 1
```

> **One-shot (`D == 0`)** : montant plein imputé **uniquement** au mois exact de `debut`
> (année **et** mois), 0 partout ailleurs. Un one-shot sans `debut` n'est jamais imputé.

> La récurrence périodique se calcule sur le **numéro de mois modulo la périodicité**, en
> ignorant l'année : une charge trimestrielle ancrée en janvier tombe en jan/avr/juil/oct
> **chaque** année.

**Champ dérivé** : `montantMensualise = (C null | D null) ? 0 : (D == 0 ? C : C / Dsafe)`
(un one-shot affiche son montant plein).

### 3.1 Variante réelle — `contributionReelle`
Visualise les flux **effectifs** (sans lissage). Fenêtre identique. Si `D == 0` (one-shot),
= `C` au seul mois exact de `debut`. Si `D == 1`, = `C` chaque mois actif. Si `D > 1`,
imputation forcée en périodique selon `moment` (`DEBUT_PERIODE`/`FIN_PERIODE`), **sauf**
`moment == INCONNU` qui reste lissé (`C / Dsafe`, aucun mois d'ancrage connu). Invariant :
sur une année complète, `Σ contributionReelle = Σ contribution`.

### 3.2 Table de vérité
| Périodicité | Mode | Moment | Comportement |
|---|---|---|---|
| 1 | quelconque | quelconque | montant plein chaque mois actif |
| > 1 | MENSUALISE | — | `C / D` chaque mois actif |
| > 1 | PERIODIQUE | DEBUT_PERIODE | montant plein si `(mois − ancre) mod D == 0` |
| > 1 | PERIODIQUE | FIN_PERIODE | montant plein si `(mois − ancre + 1) mod D == 0` |
| > 1 | MENSUALISE (imposé) | INCONNU | `C / D` chaque mois (y compris en vue réelle) |
| 0 | quelconque | — | **one-shot** : montant plein au seul mois exact de `debut`, 0 sinon (jamais si `debut` null) |

## 4. Agrégats mensuels & projection

Pour une année `Y`, un mois `M`, un **périmètre** (FOYER, ou membre `m`) :
```
facteurMembre = (périmètre == FOYER) ? 1 : quotePartEffective(poste, m, Y, M)   # §5

totalType(T)  = Σ postes de type T de:
                  contribution(poste, Y, M) × facteurMembre × tauxConversion(devise→base)  # §6

revenus, charges, reserves = totalType(REVENU|CHARGE|RESERVE)
soldeDisponibleBrut        = revenus - charges - reserves
soldeDisponible            = soldeDisponibleBrut - argentDePoche(m, Y, M)                # §7
```

### Projection annuelle
Pour `M = 1..12`, calculer `(revenus, charges, reserves, soldeDisponible)` ; le total
annuel est la somme des 12 mois. Deux séries exposées : `mois` (mensualisée, respecte
`mode`) et `moisReel` (imputation non lissée, §3.1) ; idem par membre (`moisParMembre*`).

### Trésorerie chaînée (multi-années)
Soit `Y0` = année de départ, `T0` = trésorerie initiale (hypothèse du scénario) :
```
soldeAnnuel(Y)           = Σ M=1..12 de soldeDisponible(FOYER, Y, M)
tresorerieDebutAnnee(Yi) = T0 + Σ j=0..i-1 de soldeAnnuel(Y0 + j)
tresorerieFinAnnee(Yi)   = tresorerieDebutAnnee(Yi) + soldeAnnuel(Yi)
```
Reproduit la colonne « Trésorerie 1er janv » de l'Excel (`B8 + SUMIF(années < Y ; soldes)`).

## 5. Répartition entre N membres

Le **scénario** possède une liste ordonnée de **périodes de répartition** `[début, fin]`
(couverture continue, une seule ouverte `fin = null`). Chaque période porte un vecteur
`{membre → quotePart}` avec `Σ quotePart = 1`. La **période active** pour `(Y, M)` est la
première dont l'intervalle couvre le 1ᵉʳ du mois.

Chaque **poste** porte un `typeRepartition` :
```
quotePartEffective(poste, m, Y, M) =
    si nbMembres <= 1               → 1,0                              # mono-membre
    si CUSTOM                       → poste.repartition[m]  (0 si absent)
    si AUTO                         → periodeActive(Y,M)[m]  (0 si absent)
    si REVERSE_AUTO                 → (1 − periodeActive(Y,M)[m]) / (N − 1)

partMembre(poste, m, Y, M) = contribution(poste, Y, M) × quotePartEffective(...)
```
- `REVERSE_AUTO` : pour N=2, permute exactement les parts (58/42 → 42/58).
- **Validation (bloquante, 422)** : `|Σ quotePart − 1| ≤ 1e-6` par période et par poste
  CUSTOM ; au plus une période ouverte ; pas de chevauchement.
- **Cycle de vie** : ajout d'un membre → `quotePart = 0` sur les périodes existantes ;
  désactivation → fermeture de la période ouverte + nouvelle période équilibrée pour les
  restants (les périodes fermées conservent l'historique).

> **Compatibilité Excel** : 2 membres, une période ouverte `{M1:0,58 ; M2:0,42}`, tous
> postes `AUTO` ⇒ résultats identiques au classeur (vecteurs golden T2/T4).

## 6. Multi-devises

Le foyer a une `deviseBase` et une table de taux prévisionnels fixes `{devise →
tauxVersBase}`.
```
tauxConversion(devise → base) = (devise == base) ? 1 : foyer.taux[devise]   # défaut 1 + warning
```
Conversion appliquée **après** la contribution et **avant** l'agrégation (§4). Si tous les
postes sont en `deviseBase`, facteur 1 partout (identique à l'Excel).

## 7. Argent de poche — impact sur le solde disponible

Purement prévisionnel (aucune dépense réelle suivie). Pour un `(membre, mois)`, le moteur
retranche un montant du solde disponible brut :
```
poche           = ArgentDePocheProvider.montant(membre, année, mois, ravBrut)  ≥ 0 (clampé)
soldeDisponible = ravBrut − poche
```
Le `ArgentDePocheProvider` (interface du moteur pur) est fourni par `ArgentPocheService`.
Défaut `AUCUN` → `0` (aucun impact si rien n'est configuré : rétro-compatibilité golden).

**Résolution du montant** (priorité) : `AllocationArgentPoche` (ponctuelle, mois précis)
> `PolitiqueArgentPoche` (active ce mois) > `0`.

**Formule d'une politique** (deux modes exclusifs) :
```
# VARIABLE (% du RàV brut, avec socle comme plancher et plafond comme maximum)
brut  = ravBrut × pourcentage / 100
poche = min(max(brut, socle), plafond)
# FIXE
poche = montantFixe
```
Le `pourcentage` s'applique **directement au RàV brut** du mois (pas à un surplus
`RàV − socle`) ; le `socle` est un **plancher** (montant versé si le résultat du
pourcentage tombe en dessous) et le `plafond` un **maximum** absolu.
Le solde disponible peut devenir négatif (découvert assumé). Les politiques d'un membre ne
se chevauchent jamais (validation en service) ; les allocations sont indépendantes.

## 8. Ventilations (tableau de bord mensuel)
```
# Par catégorie
montantCategorie(cat)          = Σ postes de cat de contribution × tauxConversion
# Par compte (pour un membre m)
montantCompteMembre(compte, m) = Σ postes de type T dont ventilationComptes[m] == compte
                                   de partMembre(poste, m, Y, M) × tauxConversion
```

## 9. Événements budgétaires — `MoteurCalcul#evenements`

Détecte **uniquement des changements** (pas le calendrier des échéances récurrentes) pour
la frise chronologique du dashboard. Trois types :
- **DEBUT** — poste qui démarre, non issu d'une révision (`posteOrigineId == null`). Émis
  au mois de `debut`, montant **plein** signé (+ REVENU, − CHARGE/RESERVE).
- **FIN** — poste qui se termine (`fin` renseigné) sans successeur. Émis **le mois
  suivant** la fin, montant = +delta (soulagement, signe opposé).
- **REVISION** — poste issu d'une révision (`posteOrigineId` résolu). Émis au mois de
  `debut`, `montant = signe × (nouveauMontant − ancienMontant)`. Une chaîne de N révisions
  produit 1 DEBUT + (N−1) REVISION, jamais de FIN intermédiaire.

Règles : poste à montant ≤ 0 → aucun événement ; recalculé par année (une fin au 31.12.2026
produit un FIN en janvier 2027). Tri : `mois` croissant, puis priorité **FIN > REVISION >
DEBUT**, puis `description`. Vue par membre (`?membreId=`) : la couche service applique la
`quotePartEffective` et ne renvoie que les événements où elle est > 0 (jamais recalculé
côté frontend). Tests golden : `MoteurEvenementsTest`.

## 10. Précision & performances
- Calculs internes en **double** (comme Excel) ; **arrondir uniquement à l'affichage**
  (2 décimales). Ne jamais arrondir les étapes intermédiaires (sinon divergence golden).
- Cache par `(scénario, version)` invalidé à chaque modification de poste/hypothèse.
- Le moteur ne lit jamais l'horloge (déterminisme) ; la date du jour est passée en
  paramètre explicite.

## 11. Vecteurs de test (golden)

Jeu de référence = classeur d'origine (foyer 2 membres, CHF, répartition défaut
0,58/0,42, année de départ **2026**, trésorerie initiale **0**). **Valeurs vérifiées au
centime.** Le moteur DOIT les reproduire.

### T1 — Contributions élémentaires
| Poste | Type | Montant | D | Mode / Moment | Mois | Attendu |
|---|---|---|---|---|---|---|
| Loyer | CHARGE | 1500 | 1 | MENSUALISE | jan/juin/déc | **1500** chaque mois |
| Électricité | CHARGE | 360 | 3 | MENSUALISE | jan | **120** (= 360/3) |
| 13ᵉ salaire | REVENU | 6300 | 12 | PERIODIQUE / DEBUT (ancre nov) | oct/**nov**/déc | 0 / **6300** / 0 |
| 3a pilier | RESERVE | 3600 | 12 | PERIODIQUE / DEBUT (ancre nov) | juin/**nov** | 0 / **3600** |

### T2 — Projection annuelle 2026 (FOYER), en CHF
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
| **TOTAL** | **140 350,00** | **62 322,00** | **8 520,00** | **69 508,00** |

> Comparer avec tolérance ±0,01 après arrondi d'affichage (ou ±1e-6 en interne) : les
> valeurs internes sont des doubles non arrondis.

### T3 — Trésorerie chaînée (horizon 9 ans, Y0 = 2026, T0 = 0)
| Année | Solde annuel | Trésorerie 1er janv |
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
Pour tout mois, `partMembre(M1) + partMembre(M2) = contribution` (foyer). Répartition
défaut 0,58/0,42 : `revenus(M1, jan) = 11 000 × 0,58 = 6 380` ; `revenus(M2) = 4 620`.

### T5 — Cas limites (tests unitaires)
- `D = 0` → **one-shot** : montant plein au seul mois exact de `debut` (0 sinon, jamais si `debut` null) ; pas de division par zéro.
- Poste sans dates → actif tous les mois ; `fin` en cours d'année → 0 après `fin`.
- `PERIODIQUE` ancre mars, `D = 6` → tombe en mars et septembre.
- Montant manquant → 0 (pas d'exception) ; `mois − ancre` négatif → modulo euclidien.
