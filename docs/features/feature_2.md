# Spécification des composants Dashboard - Indicateurs financiers

## Contexte

Ce document décrit les composants Angular à créer pour un système de dashboard financier. Les composants sont **agnostiques** : ils reçoivent des données en entrée et s'occupent uniquement de l'affichage. Adapte l'implémentation aux conventions, au design system et à la stack du projet.

---

## 1. Composant Carte (`DashboardCardComponent`)

Composant conteneur réutilisable. Il encapsule n'importe quel indicateur via projection de contenu.

### Structure visuelle

```
┌─────────────────────────────────────────────────┐
│  HEADER (couleur de fond configurable)          │
│  ┌──────────────────────────────────┐  ┌──────┐ │
│  │ Titre  (i)                      │  │ Badge│ │
│  └──────────────────────────────────┘  └──────┘ │
├─────────────────────────────────────────────────┤
│                                                 │
│  BODY (ng-content)                              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Inputs

| Input | Type | Requis | Description |
|-------|------|--------|-------------|
| `title` | `string` | oui | Texte du titre affiché dans le header |
| `subtitle` | `string` | non | Si fourni, affiche une petite icône "info" (cercle avec un `i`) à droite du titre. Au survol de l'icône, le texte du sous-titre apparaît en tooltip natif (`title` attribute) |
| `headerColor` | `string` | non | Couleur de fond du header. Accepte toute valeur CSS valide (hex, rgb, variable CSS, `color-mix()`...). Par défaut : transparent ou couleur neutre du thème |
| `badgeText` | `string` | non | Texte affiché à l'extrême droite du header (ex: `#01`, `Nouveau`, `CHF`...) |
| `badgeColor` | `string` | non | Couleur du texte du badge. Par défaut : couleur muted du thème |

### Icone info (sous-titre)

L'icône est un petit SVG inline de 14x14px représentant un cercle avec la lettre "i" :

```html
<svg width="14" height="14" viewBox="0 0 16 16">
  <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <path d="M8 7v4M8 5.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>
```

- Couleur : hérite de la couleur de texte muted
- Opacité par défaut : ~0.55, passe à 1 au hover
- Curseur : `help`

### Comportement

- Le header occupe toute la largeur, avec un `border-bottom` subtil pour séparer du body
- Le body est projeté via `<ng-content></ng-content>` avec un padding interne
- La carte a un `border-radius`, une bordure fine et une ombre légère
- Le composant doit être compatible avec les CSS Container Queries (`container: card / inline-size`) pour permettre aux indicateurs enfants de s'adapter

### Accessibilite

- Si `subtitle` est fourni, l'icône porte un `aria-label` ou un `title` avec le texte du sous-titre
- Le badge, s'il est purement décoratif, porte `aria-hidden="true"`

---

## 2. Composants indicateurs

Chaque composant ci-dessous est **indépendant de la carte**. Il représente uniquement la partie graphique/visualisation qui va dans le body de la carte.

---

### 2.1 Mini-histogramme (`BarChartIndicatorComponent`)

Affiche une série de barres verticales représentant des valeurs mensuelles (ou autre granularité).

#### Structure visuelle

```
│▁▃▅▇█▃▅▇▃▁▅▇│  ← barres verticales, hauteur proportionnelle
 J F M A M J J A S O N D  ← labels en dessous
```

#### Inputs

| Input | Type | Requis | Description |
|-------|------|--------|-------------|
| `values` | `number[]` | oui | Tableau de valeurs numériques, une par barre |
| `labels` | `string[]` | oui | Labels sous chaque barre (meme longueur que `values`) |
| `highlightIndex` | `number` | non | Index de la barre mise en valeur (couleur pleine au lieu de la couleur atténuée) |
| `negativeIndices` | `number[]` | non | Indices des barres à afficher en couleur "danger/négatif" |
| `barColor` | `string` | non | Couleur des barres normales (version atténuée). Par défaut : couleur accent-soft du thème |
| `barHighlightColor` | `string` | non | Couleur de la barre mise en valeur. Par défaut : couleur accent du thème |
| `negativeColor` | `string` | non | Couleur des barres négatives. Par défaut : couleur danger du thème |
| `height` | `string` | non | Hauteur de la zone des barres. Par défaut : `58px` |
| `tooltipFormatter` | `(value: number, index: number) => string` | non | Fonction pour formater le tooltip de chaque barre. Par défaut : affiche la valeur brute |

#### Comportement

- La hauteur de chaque barre est proportionnelle à la valeur max du tableau (minimum 3% pour les petites valeurs)
- Chaque barre a un tooltip natif au survol
- Les labels de la barre mise en valeur (`highlightIndex`) apparaissent en gras
- Les barres ont un léger `border-radius` en haut
- L'espacement entre barres : `gap: 4px`, chaque barre prend `flex: 1`

---

### 2.2 Donut (`DonutChartIndicatorComponent`)

Affiche un diagramme en anneau SVG avec une légende textuelle à côté.

#### Structure visuelle

```
  ┌──────┐
  │ 79k  │   ● Charges      68 %
  │ CHF  │   ● Réserves     14 %
  └──────┘   ● Arg. poche    5 %
             ● Solde         13 %
```

#### Inputs

| Input | Type | Requis | Description |
|-------|------|--------|-------------|
| `segments` | `{ label: string, value: number, color?: string }[]` | oui | Segments du donut. `value` = pourcentage (les valeurs doivent totaliser ~100). `color` optionnel par segment |
| `palette` | `string[]` | non | Palette de couleurs appliquée dans l'ordre aux segments n'ayant pas de `color` propre |
| `centerValue` | `string` | oui | Texte principal au centre du donut (ex: `79k`, `14`, `100%`) |
| `centerLabel` | `string` | non | Texte secondaire sous la valeur centrale (ex: `CHF`, `postes`) |
| `size` | `string` | non | Taille du donut en CSS. Par défaut : `clamp(88px, 48cqi, 120px)` |

#### Comportement SVG

Le donut est un SVG avec `viewBox="0 0 100 100"` :
- Un cercle de fond (track) : `r="38"`, `stroke-width="14"`, couleur neutre
- Les segments sont des `<circle>` avec `pathLength="100"` pour simplifier le calcul des arcs :
  - `stroke-dasharray` : `"[valeur-1] [100-valeur+1]"` (le `-1` crée un petit gap entre segments)
  - `stroke-dashoffset` : `-[cumul des segments précédents]`
  - `transform="rotate(-90 50 50)"` pour démarrer à 12h
- Deux `<text>` centrés : la valeur (taille 14, gras) et le label (taille 8, muted)

#### Legende

- Disposition : grille verticale par défaut, 2 colonnes si le conteneur est assez large (container query `min-width: 560px`)
- Chaque entrée : pastille colorée (9x9px, border-radius 3px) + label (muted, truncated) + valeur en gras + `%`
- Le donut et la légende sont côte à côte dans un flex container (`flex-wrap: wrap`)

---

### 2.3 Heatmap (`HeatmapIndicatorComponent`)

Grille de cellules colorées, chacune représentant une période (mois).

#### Structure visuelle

```
┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
│ J│ F│ M│ A│ M│ J│ J│ A│ S│ O│ N│ D│  ← cellules carrées colorées
└──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
● Sain   ● Correct   ● Attention   ● Déficit   ← légende
```

#### Inputs

| Input | Type | Requis | Description |
|-------|------|--------|-------------|
| `cells` | `{ label: string, color: string, tooltip: string }[]` | oui | Une cellule par période. `label` = texte court dans la cellule (ex: `J`), `color` = couleur CSS de fond, `tooltip` = texte au survol |
| `legend` | `{ label: string, color: string }[]` | non | Entrées de la légende sous la grille |
| `columns` | `number` | non | Nombre de colonnes dans la grille. Par défaut : `12` |

#### Comportement

- Grille CSS : `grid-template-columns: repeat(columns, minmax(0, 1fr))`
- Chaque cellule : `aspect-ratio: 1`, `border-radius: 6px`, texte centré (10px, blanc, gras)
- Au survol : légère mise à l'échelle (`transform: scale(1.15)`) avec transition
- La légende est un flex-wrap sous la grille, chaque entrée : pastille + texte (11px, muted)
- Responsive : gap et font-size réduites dans les petits conteneurs (container query)

---

### 2.4 Nombre + tendance (`NumberTrendIndicatorComponent`)

Affiche une valeur clé (nombre, montant) accompagnée d'un badge de variation par rapport à la période précédente.

#### Structure visuelle

```
  14,8 M CHF

  ▲ +6,3 %  vs 2025
```

#### Inputs

| Input | Type | Requis | Description |
|-------|------|--------|-------------|
| `value` | `string` | oui | Valeur principale affichée en grand (ex: `14,8`, `28'410`) |
| `unit` | `string` | non | Unité affichée après la valeur en plus petit et muted (ex: `M CHF`, `%`, `ms`) |
| `delta` | `number` | oui | Variation en pourcentage par rapport à la période de référence. Positif = hausse, négatif = baisse |
| `invertDelta` | `boolean` | non | Si `true`, une baisse est considérée comme positive (ex: temps de réponse, taux de churn). Par défaut : `false` |
| `comparisonLabel` | `string` | non | Texte muted affiché à droite du badge delta (ex: `vs 2025`, `vs mois préc.`) |
| `deltaFormatter` | `(delta: number) => string` | non | Fonction pour formater le texte du delta. Par défaut : affiche le pourcentage avec `▲` ou `▼` |

#### Comportement

- La valeur utilise la classe de style "value" : taille grande (`clamp(24px, 13cqi, 38px)`), `font-weight: 700`, `letter-spacing: -.02em`, `font-variant-numeric: tabular-nums`
- L'unité est affichée en `.45em` du parent, `font-weight: 600`, couleur muted, avec un `margin-left: 4px`
- Le badge delta est un `inline-flex` avec :
  - Fond et texte colorés : vert (success) si variation favorable, rouge (danger) si défavorable
  - Le caractère favorable dépend de `invertDelta`
  - `padding: 3px 7px`, `border-radius: 99px`, `font-size: 12px`, `font-weight: 700`
  - Icône flèche : `▲` pour positif, `▼` pour négatif
- Le `comparisonLabel` est affiché dans un `<span>` muted à côté du badge
- Le footer (badge + label) est un flex container avec `align-items: center`, `gap: 8px`, `font-size: 12px`

---

### 2.5 Progression (`ProgressIndicatorComponent`)

Barre de progression horizontale montrant l'avancement par rapport à un objectif.

#### Structure visuelle

```
  ┌────────────────────────────────────────┐
  │████████████████████░░░░░░░░░░░░░░░░░░░░│  ← barre de progression
  └────────────────────────────────────────┘
   11'200 / 14'000 k CHF          Reste 2'800
```

#### Inputs

| Input | Type | Requis | Description |
|-------|------|--------|-------------|
| `current` | `number` | oui | Valeur actuelle |
| `target` | `number` | oui | Valeur cible (100%) |
| `unit` | `string` | non | Unité affichée dans les labels (ex: `k CHF`, `postes`, `h`) |
| `barColor` | `string` | non | Couleur de la barre de progression. Par défaut : couleur accent du thème. Passe automatiquement en couleur success si `current >= target` |
| `warningThreshold` | `number` | non | Si le pourcentage dépasse ce seuil, la couleur passe en warning. Utile pour les budgets (ex: `90`) |
| `showRemaining` | `boolean` | non | Affiche `Reste X` à droite. Par défaut : `true` |
| `completedLabel` | `string` | non | Texte affiché à droite quand 100% est atteint. Par défaut : `Atteint ✓` |

#### Comportement

- La barre : `height: 10px`, `background: surface-soft`, `border-radius: 99px`, `overflow: hidden`
- La partie remplie : `display: block`, `height: 100%`, `border-radius: 99px`, largeur en `%` = `current / target * 100`, plafonnée à 100%
- Sous la barre : un flex container `justify-content: space-between`, `gap: 8px`, `font-size: 12px`, couleur muted
  - À gauche : `<b>current</b> / target unit` (le current en gras, couleur text-primary)
  - À droite : `Reste X` ou `completedLabel` si atteint (masqué dans les petits conteneurs via `hide-xs`)
- La couleur de la barre change dynamiquement : accent → warning (si seuil dépassé) → success (si ≥ 100%)

---

### 2.6 Sparkline (`SparklineIndicatorComponent`)

Courbe de tendance SVG miniature avec remplissage en dégradé, accompagnée d'une valeur et d'un badge delta.

#### Structure visuelle

```
  48'920  ▲ +6,1 %

  ╱╲  ╱╲    ╱╲╱╲╱      ← courbe SVG avec gradient fill
  ╱  ╲╱  ╲╱╱        ╲
```

#### Inputs

| Input | Type | Requis | Description |
|-------|------|--------|-------------|
| `series` | `number[]` | oui | Tableau de valeurs pour tracer la courbe |
| `value` | `string` | oui | Valeur principale affichée au-dessus de la courbe |
| `unit` | `string` | non | Unité après la valeur |
| `delta` | `number` | oui | Variation en pourcentage |
| `invertDelta` | `boolean` | non | Si `true`, une baisse est favorable. Par défaut : `false` |
| `strokeColor` | `string` | non | Couleur de la ligne. Par défaut : déterminée automatiquement (success si favorable, danger sinon) |
| `height` | `string` | non | Hauteur du SVG. Par défaut : `52px` |

#### Comportement SVG

Le sparkline est un SVG avec `viewBox="0 0 100 40"` et `preserveAspectRatio="none"` :

- **Calcul des points** : chaque valeur est mappée sur X = `i / (n-1) * 100` et Y = `36 - (v - min) / (max - min) * 32` (inversé car Y descend en SVG)
- **Remplissage** : un `<path>` fermé (ligne + retour bas `L100 40 L0 40 Z`) avec un `<linearGradient>` vertical : couleur à 25% d'opacité en haut → 0% en bas
- **Ligne** : un `<path>` avec `fill: none`, `stroke-width: 2`, `vector-effect: non-scaling-stroke`, `stroke-linejoin: round`, `stroke-linecap: round`
- La couleur du stroke et du gradient est success si delta favorable, danger sinon
- Chaque gradient a un `id` unique pour éviter les conflits SVG

#### Partie valeur

- La valeur et le badge delta sont dans un flex container (`row`) avec `align-items: center`, `gap: 10px`
- Le badge delta suit les mêmes règles que `NumberTrendIndicatorComponent`

---

### 2.7 Comparaison de périodes (`ComparisonIndicatorComponent`)

Deux valeurs côte à côte représentant la période actuelle et la période de référence, avec un badge de variation.

#### Structure visuelle

```
  ┌──────────────┐│┌──────────────┐
  │ 2026         ││ 2025         │
  │ 4,0 j        ││ 4,8 j        │
  └──────────────┘│└──────────────┘

  ▼ -16,7 %  d'une période à l'autre
```

#### Inputs

| Input | Type | Requis | Description |
|-------|------|--------|-------------|
| `currentLabel` | `string` | oui | Label de la période actuelle (ex: `2026`, `Sept.`) |
| `currentValue` | `string` | oui | Valeur de la période actuelle (ex: `4,0 j`, `45 CHF`) |
| `previousLabel` | `string` | oui | Label de la période de référence |
| `previousValue` | `string` | oui | Valeur de la période de référence |
| `delta` | `number` | oui | Variation en pourcentage |
| `invertDelta` | `boolean` | non | Si `true`, une baisse est favorable. Par défaut : `false` |
| `comparisonLabel` | `string` | non | Texte muted après le delta. Par défaut : `d'une période à l'autre` |

#### Comportement

- Layout en grille CSS : `grid-template-columns: 1fr 1fr`, `gap: 0`
- La colonne de droite a un `border-left: 1px solid` (couleur border du thème) et un `padding-left: 14px`
- **Labels** : `font-size: 11px`, `font-weight: 600`, couleur muted, `text-transform: uppercase`, `letter-spacing: .04em`, `margin-bottom: 4px`
- **Valeurs** : `font-size: clamp(18px, 10cqi, 30px)`, `font-weight: 700`, `letter-spacing: -.02em`, `font-variant-numeric: tabular-nums`
- La valeur de droite (période précédente) est en couleur muted
- En format large (container `min-width: 560px`) : valeurs à `30px`, grille min-width `260px`
- Le badge delta + label est dans un footer flex, mêmes règles que les autres composants

---

### 2.8 Barre empilée (`StackedBarIndicatorComponent`)

Barre horizontale unique décomposée en segments colorés proportionnels, avec légende.

#### Structure visuelle

```
  ┌══════════════════════════╤═══════╤════╤═══┐
  │ Projets         58%     │ Réu.  │Sup.│Adm│  ← barre unique
  └══════════════════════════╧═══════╧════╧═══┘

  ● Projets  58%   ● Réunions  22%   ● Support  12%   ● Admin  8%
```

#### Inputs

| Input | Type | Requis | Description |
|-------|------|--------|-------------|
| `segments` | `{ label: string, value: number, color?: string }[]` | oui | Segments de la barre. `value` = pourcentage (total ~100) |
| `palette` | `string[]` | non | Palette de couleurs appliquée dans l'ordre aux segments sans `color` |
| `barHeight` | `string` | non | Hauteur de la barre. Par défaut : `12px` |

#### Comportement

- La barre : flex container, `height: 12px`, `border-radius: 99px`, `overflow: hidden`, `gap: 2px`
- Chaque segment : `height: 100%`, largeur en `%` = `value`, pas de border-radius individuel (l'overflow du parent arrondit les extrémités)
- Chaque segment a un tooltip natif : `label value %`
- **Légende** : grille verticale avec `gap: 4px` (classe "tight")
  - Chaque entrée : pastille colorée (`9x9px`, `border-radius: 3px`) + label (muted, truncated) + valeur en gras + `%`
  - Mêmes styles que la légende du donut
- `margin-bottom: 10px` entre la barre et la légende

---

### 2.9 Niveau sur échelle (`LevelIndicatorComponent`)

Indicateur qualitatif positionné sur une échelle visuelle à 5 segments.

#### Structure visuelle

```
  Modéré  3/5

  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐
  │███│ │███│ │███│ │░░░│ │░░░│   ← 5 segments, 3 remplis
  └───┘ └───┘ └───┘ └───┘ └───┘
  Faible              Critique
```

#### Inputs

| Input | Type | Requis | Description |
|-------|------|--------|-------------|
| `level` | `number` | oui | Niveau actuel de 1 à 5 |
| `label` | `string` | oui | Texte qualitatif du niveau (ex: `Modéré`, `Élevé`, `Critique`) |
| `tone` | `'good' \| 'warn' \| 'bad' \| 'neutral'` | oui | Coloration sémantique : `good` = success, `warn` = warning, `bad` = danger, `neutral` = accent |
| `startLabel` | `string` | oui | Label à gauche de l'échelle (ex: `Faible`) |
| `endLabel` | `string` | oui | Label à droite de l'échelle (ex: `Critique`) |

#### Comportement

- **Texte du niveau** : affiché au-dessus de l'échelle, `font-size: clamp(18px, 10cqi, 26px)`, `font-weight: 700`, couleur selon `tone`
  - Le ratio `level/5` est affiché à côté en plus petit (`.55em`), `font-weight: 600`, couleur muted
- **Échelle** : grille CSS `grid-template-columns: repeat(5, 1fr)`, `gap: 4px`
  - Chaque segment : `height: 10px`, `border-radius: 3px`
  - Segments inactifs : `background: surface-soft`
  - Segments actifs (index < `level`) : couleur selon `tone` (la couleur thématique correspondante)
- **Labels** : flex container `justify-content: space-between`, `font-size: 10px`, couleur muted, `margin-top: 5px`

#### Mapping des tons

| Tone | Couleur |
|------|---------|
| `good` | `success` |
| `warn` | `warning` |
| `bad` | `danger` |
| `neutral` | `accent` |

---

### 2.10 Courbe comparée (`DualLineIndicatorComponent`)

Deux courbes SVG superposées (période actuelle en trait plein, période précédente en pointillés) avec mini-légende.

#### Structure visuelle

```
  1,28 M CHF  ▲ +8,2 %

  ───────╱╲──────────     ← courbe actuelle (trait plein)
  ┈┈┈┈╱╲┈┈╲┈┈┈┈┈┈┈┈     ← courbe précédente (pointillés)

  ── Sept.    ┈┈ Août
```

#### Inputs

| Input | Type | Requis | Description |
|-------|------|--------|-------------|
| `currentSeries` | `number[]` | oui | Valeurs de la période actuelle |
| `previousSeries` | `number[]` | oui | Valeurs de la période précédente (même longueur) |
| `value` | `string` | oui | Valeur principale |
| `unit` | `string` | non | Unité |
| `delta` | `number` | oui | Variation en pourcentage |
| `invertDelta` | `boolean` | non | Baisse favorable. Par défaut : `false` |
| `currentLabel` | `string` | oui | Label de la courbe actuelle dans la légende |
| `previousLabel` | `string` | oui | Label de la courbe précédente dans la légende |
| `currentColor` | `string` | non | Couleur de la courbe actuelle. Par défaut : couleur accent |
| `previousColor` | `string` | non | Couleur de la courbe précédente. Par défaut : couleur muted |

#### Comportement SVG

Le graphique est un SVG avec `viewBox="0 0 100 40"`, `preserveAspectRatio="none"`, hauteur `60px` :

- Le min/max est calculé sur les **deux séries combinées** pour avoir la même échelle
- **Courbe actuelle** : `<path>` avec `fill: none`, `stroke-width: 2`, `vector-effect: non-scaling-stroke`, `stroke-linejoin: round`, `stroke-linecap: round`, couleur accent
- **Courbe précédente** : `<path>` avec `fill: none`, `stroke-width: 1.5`, `vector-effect: non-scaling-stroke`, couleur muted, `stroke-dasharray: 4 3`, `opacity: 0.7`
- Formule Y identique au sparkline : `38 - (v - min) / (max - min) * 34`

#### Mini-légende

- Flex container, `gap: 14px`, `font-size: 11px`, couleur muted, `margin-top: 6px`
- Chaque entrée : `inline-flex`, `align-items: center`, `gap: 5px`
  - Indicateur visuel : `width: 14px`, `height: 0`, `border-top: 2px solid accent` (actuelle) ou `2px dashed muted` (précédente)
  - Texte du label

---

### 2.11 Entonnoir de conversion (`FunnelIndicatorComponent`)

Barres horizontales décroissantes représentant les étapes d'un processus avec pertes successives.

#### Structure visuelle

```
  ┌══════════════════════════════════════════┐
  │ Visiteurs                      12'400   │  ← 100%
  ├══════════════════════════════┐           │
  │ Inscription             4'960│           │  ← 40%
  ├═══════════════════┐         │           │
  │ Essai gratuit  2'232│         │           │  ← 18%
  ├═══════════┐       │         │           │
  │ Conversion│ 892   │         │           │  ← 7,2%
  └═══════════┘       └─────────┘───────────┘
```

#### Inputs

| Input | Type | Requis | Description |
|-------|------|--------|-------------|
| `steps` | `{ label: string, displayValue: string, widthPercent: number }[]` | oui | Étapes de l'entonnoir. `widthPercent` = largeur relative de la barre (première = 100%) |
| `barColor` | `string` | non | Couleur de base des barres. Par défaut : couleur accent. Chaque barre successive est progressivement plus transparente |

#### Comportement

- Layout : grille CSS, `gap: 5px`
- Chaque ligne (`.f-row`) :
  - Conteneur : `position: relative`, `height: 24px`, `border-radius: 5px`, `background: surface-soft`, `overflow: hidden`
  - Barre colorée : `position: absolute`, `left: 0`, `top: 0`, `bottom: 0`, `border-radius: 5px`, largeur = `widthPercent` (min 8%)
  - La couleur de chaque barre est un `color-mix` progressif : `color-mix(in srgb, accent [40 - index*8]%, transparent)` (de plus en plus transparent)
  - Label : `position: absolute`, `left: 8px`, centré verticalement (`top: 50%; transform: translateY(-50%)`), couleur text-primary, `max-width: 60%`, truncated
  - Valeur : `position: absolute`, `right: 8px`, centré verticalement, `font-weight: 600`, `font-variant-numeric: tabular-nums`
- `font-size: 11px` pour le texte dans les barres

---

### 2.12 Grille de points / Waffle (`WaffleIndicatorComponent`)

Grille 10×10 de points (cercles) colorés représentant une proportion sur 100.

#### Structure visuelle

```
  ● ● ● ● ● ● ● ● ● ●
  ● ● ● ● ● ● ● ● ● ●
  ● ● ● ● ● ● ● ● ● ●
  ● ● ● ● ● ● ● ○ ○ ○    ← 37 remplis sur 100
  ○ ○ ○ ○ ○ ○ ○ ○ ○ ○
  ...
  ● Catégorie A  42%   ● Catégorie B  20%  ...
```

#### Inputs

| Input | Type | Requis | Description |
|-------|------|--------|-------------|
| `segments` | `{ label: string, count: number, color?: string }[]` | oui | Segments à colorier. `count` = nombre de points (total des counts ≤ 100). Les points restants sont inactifs |
| `palette` | `string[]` | non | Palette de couleurs dans l'ordre des segments sans `color` |
| `columns` | `number` | non | Nombre de colonnes. Par défaut : `10` |
| `total` | `number` | non | Nombre total de points. Par défaut : `100` |
| `legend` | `boolean` | non | Affiche la légende sous la grille. Par défaut : `true` |

#### Comportement

- **Grille** : CSS Grid, `grid-template-columns: repeat(columns, minmax(0, 1fr))`, `gap: 3px`, `max-width: 200px`
- **Points** : chaque point est un `<i>`, `aspect-ratio: 1`, `border-radius: 50%` (cercle parfait)
  - Inactifs : `background: surface-soft`
  - Actifs : colorés selon le segment auquel ils appartiennent (remplissage dans l'ordre des segments)
- En format large (container `min-width: 560px`) : `max-width: 180px`, aligné à droite (`margin-left: auto`)
- **Légende** (si activée) : mêmes styles que la légende du donut — pastilles + labels + pourcentages

#### Logique de remplissage

Les points sont remplis de gauche à droite, de haut en bas, dans l'ordre des segments :
1. Les `count` premiers points prennent la couleur du segment 1
2. Les `count` suivants prennent la couleur du segment 2
3. Etc.
4. Les points restants (jusqu'à `total`) restent inactifs

---

## 3. Notes d'implementation

### Theming

Les composants ne doivent **pas** embarquer de couleurs en dur. Utilise le système de design tokens / variables CSS du projet. Voici les rôles sémantiques à mapper :

| Role | Usage |
|------|-------|
| `card-bg` | Fond de la carte |
| `card-border` | Bordure de la carte |
| `text-primary` | Texte principal |
| `text-muted` | Texte secondaire, labels |
| `surface-soft` | Fonds subtils, tracks |
| `accent` | Couleur d'accent principale |
| `success` | Valeurs positives, santé OK |
| `danger` | Valeurs négatives, déficits |
| `warning` | Attention, valeurs limites |

### Container Queries

Les composants indicateurs utilisent les CSS Container Queries pour adapter leur layout selon la taille du conteneur (la carte), et non du viewport. La carte parente déclare `container: card / inline-size`.

### Responsivite

- Les composants doivent fonctionner dans des cartes de toute taille, de ~180px à pleine largeur
- Le donut et la légende passent de côte à côte à empilés selon la largeur
- La heatmap réduit ses gaps et font-sizes dans les petits conteneurs
- Les barres du mini-histogramme prennent chacune `flex: 1` donc s'adaptent naturellement
- Les sparklines et courbes comparées utilisent `preserveAspectRatio="none"` pour s'étirer sur toute la largeur disponible
- La comparaison de périodes a des valeurs en `clamp(18px, 10cqi, 30px)` pour s'adapter
- La grille waffle passe à `max-width: 180px` alignée à droite en format large
- L'entonnoir s'adapte naturellement car les barres sont en pourcentage de largeur
- Le niveau sur échelle utilise `grid-template-columns: repeat(5, 1fr)` donc s'adapte nativement

### Accessibilite

- Chaque barre, segment de donut et cellule de heatmap doit avoir un tooltip accessible
- Les éléments SVG interactifs portent des `<title>` ou `aria-label`
- Les contrastes de couleurs doivent respecter les standards WCAG, particulièrement le texte dans les cellules de heatmap (blanc sur fond coloré)
- Les courbes SVG (sparkline, courbe comparée) portent un `<title>` décrivant la tendance
- Les segments de barre empilée et les points du waffle ont des tooltips natifs
- Les barres de l'entonnoir ont le label et la valeur en texte lisible (pas uniquement en couleur)
- Les segments actifs du niveau sur échelle sont distingués par couleur ET par contraste (actif vs inactif)

### Architecture

```
dashboard/
  components/
    dashboard-card/
      dashboard-card.component.ts
      dashboard-card.component.html
      dashboard-card.component.scss
    bar-chart-indicator/
      bar-chart-indicator.component.ts
      bar-chart-indicator.component.html
      bar-chart-indicator.component.scss
    donut-chart-indicator/
      donut-chart-indicator.component.ts
      donut-chart-indicator.component.html
      donut-chart-indicator.component.scss
    heatmap-indicator/
      heatmap-indicator.component.ts
      heatmap-indicator.component.html
      heatmap-indicator.component.scss
    number-trend-indicator/
      number-trend-indicator.component.ts
      number-trend-indicator.component.html
      number-trend-indicator.component.scss
    progress-indicator/
      progress-indicator.component.ts
      progress-indicator.component.html
      progress-indicator.component.scss
    sparkline-indicator/
      sparkline-indicator.component.ts
      sparkline-indicator.component.html
      sparkline-indicator.component.scss
    comparison-indicator/
      comparison-indicator.component.ts
      comparison-indicator.component.html
      comparison-indicator.component.scss
    stacked-bar-indicator/
      stacked-bar-indicator.component.ts
      stacked-bar-indicator.component.html
      stacked-bar-indicator.component.scss
    level-indicator/
      level-indicator.component.ts
      level-indicator.component.html
      level-indicator.component.scss
    dual-line-indicator/
      dual-line-indicator.component.ts
      dual-line-indicator.component.html
      dual-line-indicator.component.scss
    funnel-indicator/
      funnel-indicator.component.ts
      funnel-indicator.component.html
      funnel-indicator.component.scss
    waffle-indicator/
      waffle-indicator.component.ts
      waffle-indicator.component.html
      waffle-indicator.component.scss
```

### Exemple d'utilisation

```html
<!-- Revenus mensuels avec mini-histogramme -->
<app-dashboard-card
  title="Revenus"
  subtitle="Janvier - Décembre 2026"
  headerColor="var(--color-success-soft)"
  badgeText="#01">

  <app-bar-chart-indicator
    [values]="revenusParMois"
    [labels]="labelsMois"
    [highlightIndex]="moisCourant"
    [tooltipFormatter]="formatCHF">
  </app-bar-chart-indicator>

</app-dashboard-card>

<!-- Allocation budget avec donut -->
<app-dashboard-card
  title="Allocation du budget"
  subtitle="Répartition des revenus"
  headerColor="var(--color-accent-soft)"
  badgeText="#05">

  <app-donut-chart-indicator
    [segments]="allocationSegments"
    centerValue="79k"
    centerLabel="CHF total">
  </app-donut-chart-indicator>

</app-dashboard-card>

<!-- Santé financière avec heatmap -->
<app-dashboard-card
  title="Équilibre revenus / charges"
  subtitle="Ratio charges + signe du solde"
  headerColor="var(--color-emerald-soft)"
  badgeText="#09">

  <app-heatmap-indicator
    [cells]="healthCells"
    [legend]="healthLegend">
  </app-heatmap-indicator>

</app-dashboard-card>

<!-- Chiffre d'affaires avec nombre + tendance -->
<app-dashboard-card
  title="Chiffre d'affaires"
  subtitle="Exercice 2026"
  headerColor="var(--color-success-soft)"
  badgeText="#01">

  <app-number-trend-indicator
    value="14,8"
    unit="M CHF"
    [delta]="6.3"
    comparisonLabel="vs 2025">
  </app-number-trend-indicator>

</app-dashboard-card>

<!-- Budget consommé avec progression -->
<app-dashboard-card
  title="Budget consommé"
  subtitle="Marketing annuel"
  headerColor="var(--color-warning-soft)"
  badgeText="#03">

  <app-progress-indicator
    [current]="680"
    [target]="900"
    unit="k CHF"
    [warningThreshold]="90">
  </app-progress-indicator>

</app-dashboard-card>

<!-- Visiteurs avec sparkline -->
<app-dashboard-card
  title="Visiteurs uniques"
  subtitle="Jan – Déc (par mois)"
  badgeText="#04">

  <app-sparkline-indicator
    [series]="visiteursParMois"
    value="580k"
    [delta]="14.2">
  </app-sparkline-indicator>

</app-dashboard-card>

<!-- Délai de livraison avec comparaison -->
<app-dashboard-card
  title="Délai de livraison"
  subtitle="Moyenne annuelle"
  badgeText="#07">

  <app-comparison-indicator
    currentLabel="2026"
    currentValue="4,0 j"
    previousLabel="2025"
    previousValue="4,8 j"
    [delta]="-16.7"
    [invertDelta]="true">
  </app-comparison-indicator>

</app-dashboard-card>

<!-- Temps de travail avec barre empilée -->
<app-dashboard-card
  title="Temps de travail"
  subtitle="Répartition annuelle"
  badgeText="#12">

  <app-stacked-bar-indicator
    [segments]="tempsSegments">
  </app-stacked-bar-indicator>

</app-dashboard-card>

<!-- Niveau de risque avec échelle -->
<app-dashboard-card
  title="Niveau de risque"
  subtitle="Portefeuille 2026"
  badgeText="#16">

  <app-level-indicator
    [level]="3"
    label="Modéré"
    tone="warn"
    startLabel="Faible"
    endLabel="Critique">
  </app-level-indicator>

</app-dashboard-card>

<!-- CA cumulé avec courbe comparée -->
<app-dashboard-card
  title="CA cumulé"
  subtitle="Par mois"
  badgeText="#18">

  <app-dual-line-indicator
    [currentSeries]="ca2026"
    [previousSeries]="ca2025"
    value="14,8"
    unit="M CHF"
    [delta]="6.3"
    currentLabel="2026"
    previousLabel="2025">
  </app-dual-line-indicator>

</app-dashboard-card>

<!-- Conversion avec entonnoir -->
<app-dashboard-card
  title="Tunnel de vente"
  subtitle="Web – cumul annuel"
  badgeText="#19">

  <app-funnel-indicator
    [steps]="funnelSteps">
  </app-funnel-indicator>

</app-dashboard-card>

<!-- Répartition équipe avec waffle -->
<app-dashboard-card
  title="Répartition par département"
  subtitle="Effectifs en %"
  badgeText="#20">

  <app-waffle-indicator
    [segments]="deptSegments">
  </app-waffle-indicator>

</app-dashboard-card>
```