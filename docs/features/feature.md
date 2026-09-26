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

### Accessibilite

- Chaque barre, segment de donut et cellule de heatmap doit avoir un tooltip accessible
- Les éléments SVG interactifs portent des `<title>` ou `aria-label`
- Les contrastes de couleurs doivent respecter les standards WCAG, particulièrement le texte dans les cellules de heatmap (blanc sur fond coloré)

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
```