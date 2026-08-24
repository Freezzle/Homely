# Spec — Sélecteur de période, vues du dashboard, flux mensuel & liste de montants

> Document de cadrage pour l'équipe Angular / PrimeNG 21 de Homely.
> Décrit 4 briques indépendantes mais interconnectées : le rail de période, la
> barre de vues, le widget de flux mensuel, et un composant réutilisable de
> liste de montants avec barres de progression.

---

## Sommaire

1. [Sélecteur de période — rail mois + année](#1-sélecteur-de-période--rail-mois--année)
2. [Barre de vues — Aperçu / Comptes / Postes / Membres](#2-barre-de-vues--aperçu--comptes--postes--membres)
3. [Flux mensuel avec mois actif visible](#3-flux-mensuel-avec-mois-actif-visible)
4. [Composant réutilisable — liste de montants à barres](#4-composant-réutilisable--liste-de-montants-à-barres)
5. [Annexe — checklist de migration](#5-annexe--checklist-de-migration)

---

## 1. Sélecteur de période — rail mois + année

### 1.1 Problème résolu

L'ancien sélecteur (toggle Mois/Année + deux chevrons) demandait plusieurs
clics pour atteindre un mois éloigné, et ne donnait aucune information sur
les autres mois avant de les avoir ouverts un par un.

Le rail remplace ça par **une seule rangée toujours visible** : les 12 mois
de l'année sélectionnée, cliquables individuellement, plus un bouton pour
voir l'année entière en cumul.

### 1.2 Anatomie

```
┌──────────────────────────────────────────────────────────────────────┐
│  ‹  2026  ›   │ Jan Fév Mar Avr Mai Jui Jul Aoû Sep Oct Nov Déc │ Année │
│               │  ▂   ▂   ▃   ▂   ▃   ▂   ▁   ▃   ▃   ▃   ▃   ▁  │       │
└──────────────────────────────────────────────────────────────────────┘
   Août 2026 · vue mensuelle
```

- **Bloc année** (gauche) : chevrons précédent/suivant + année courante.
  N'affecte que l'année, jamais le mois sélectionné.
- **Rail des mois** (centre) : 12 boutons, un par mois. Chaque bouton porte
  une **pastille de santé** (barre de 3px sous le libellé) colorée selon le
  solde disponible de ce mois — c'est ce qui rend le rail "intuitif" : on
  repère les mois tendus sans les ouvrir.
- **Bouton "Année"** (droite) : bascule en vue cumulée sur les 12 mois. Le
  rail reste visible mais s'estompe (opacité ~45 %) pour signaler qu'il
  n'est plus le filtre actif.
- **Ligne de titre** sous la barre : rappelle la période retenue en toutes
  lettres ("Août 2026 · vue mensuelle" / "Année 2026 · 12 mois cumulés").

### 1.3 Composants PrimeNG à utiliser

| Élément | Composant PrimeNG | Remarque |
|---|---|---|
| Chevrons année | `p-button` (`[text]="true"`, `icon="pi pi-chevron-left/right"`) | Standard, rien à custom. |
| Bouton "Année" | `p-button` (`[outlined]="true"` quand inactif, rempli quand actif) ou `p-toggleButton` | `p-toggleButton` correspond exactement à un état on/off — c'est le choix le plus propre ici. |
| Tooltip par mois | directive `pTooltip` | Affiche le solde exact et le libellé qualitatif au survol. |
| Le rail lui-même | **Custom** | PrimeNG n'a pas de composant "rail scrollable de boutons avec indicateur". `p-selectbutton` s'en approche visuellement mais **ne supporte pas le scroll horizontal avec snap** ni les pastilles custom sous chaque item sans détourner fortement son template — préférer un `<div>` flex natif avec des `<button>` (ripple PrimeNG optionnel via `pRipple`), c'est plus simple à maintenir que de forcer l'API de SelectButton. |

> **Verdict** : mix components PrimeNG (boutons, toggle, tooltip) + un
> conteneur custom pour le rail. Ne pas chercher à tout faire rentrer dans
> un seul composant PrimeNG existant, ça coûterait plus cher en detours que
> le custom direct.

### 1.4 Comportement

- **Clic sur un mois** → sélectionne ce mois, force le mode `mois` (même si
  on était en mode `annee`).
- **Clic sur "Année"** → bascule `mois` ↔ `annee`. Ne change pas l'année en
  cours ni le mois mémorisé (si on repasse en mode mois, on retrouve le
  dernier mois sélectionné).
- **Chevrons année** → change l'année ; si un mois était sélectionné, on
  reste sur le même index de mois dans la nouvelle année.
- **Le mois actif se recentre automatiquement** dans le rail après tout
  changement (`scrollIntoView` / calcul de `scrollLeft`), pour qu'il reste
  visible même sur mobile où le rail défile.
- **Bornes** : chevrons désactivés (`disabled`) aux extrémités de la plage
  d'années disponible (ex. 2024–2028, à définir selon la profondeur
  d'historique réelle de Homely).

### 1.5 Contrat de composant

```ts
// period-rail.component.ts
export type PeriodMode = 'mois' | 'annee';

export interface PeriodValue {
  mode: PeriodMode;
  monthIndex: number; // 0-11, ignoré si mode === 'annee'
  year: number;
}

export interface MonthHealth {
  monthIndex: number;
  /** Valeur affichée dans le tooltip, ex. solde disponible du mois. */
  amount: number;
  /** Sévérité pilotant la couleur de la pastille. */
  level: 'low' | 'mid' | 'high';
}

@Component({
  selector: 'hly-period-rail',
  standalone: true,
  ...
})
export class PeriodRailComponent {
  @Input({ required: true }) value!: PeriodValue;
  @Input({ required: true }) monthsHealth: MonthHealth[] = []; // longueur 12
  @Input() minYear = 2024;
  @Input() maxYear = 2028;

  @Output() valueChange = new EventEmitter<PeriodValue>();
}
```

Le parent (page dashboard) reste seul responsable de calculer `monthsHealth`
à partir des vraies données (le composant ne fait aucun calcul métier, il
affiche ce qu'on lui donne).

### 1.6 Accessibilité & clavier

- Chaque bouton mois : `aria-pressed` reflétant l'état actif, `aria-label`
  explicite ("Août 2026, solde 1 246 euros, confortable").
- Raccourcis clavier recommandés (à activer seulement quand le dashboard a
  le focus, pas globalement dans l'app) :
    - `←` / `→` : mois précédent / suivant
    - `↑` / `↓` : année précédente / suivante
    - `A` : bascule vue Année

### 1.7 Responsive

- **Desktop** : tout tient sur une ligne (bloc année · rail · bouton Année).
- **Mobile (< 768px)** : le rail passe sur sa propre ligne, sous le bloc
  année et le bouton Année qui restent groupés en haut. Chaque bouton mois
  passe à une largeur tactile minimale de **44px** (recommandation Apple
  HIG / WCAG target size). Le rail défile horizontalement avec
  `scroll-snap-type: x proximity`.

---

## 2. Barre de vues — Aperçu / Comptes / Postes / Membres

### 2.1 Principe

Le dashboard actuel affiche tout sur une seule page, ce qui devient long à
faire défiler. **L'objectif n'est pas de dupliquer le contenu existant dans
4 nouvelles pages, mais de le répartir** : chaque widget déménage dans la
vue à laquelle il appartient logiquement, une seule fois.

> ⚠️ **Instruction pour l'implémentation** : lors du découpage, les
> composants/widgets déjà développés pour le dashboard actuel doivent être
> **déplacés** (changement de parent, pas de copie de code) vers la vue
> cible listée ci-dessous. Si un widget a un sens dans deux vues, on décide
> d'un seul emplacement "maître" plutôt que de le dupliquer.

### 2.2 Répartition proposée

| Vue | Contenu | Justification |
|---|---|---|
| **Aperçu** | Rail de période · widget flux mensuel + liste de montants (section 3 et 4) · score de santé · décomposition waterfall du mois · heatmap 12 mois · alertes | Ce qu'on doit voir en arrivant, sans creuser : la situation globale et les signaux qui demandent attention. |
| **Comptes** | Table des comptes (solde, type, mouvements du mois) · trésorerie cumulée / projection · objectifs d'épargne · calendrier de flux quotidien | Tout ce qui concerne l'état et l'évolution des comptes bancaires/livrets — remplace l'ancienne vue "Patrimoine", en y ajoutant le détail par compte qui manquait. |
| **Postes** | Réel vs budget (bullets) · tuiles proportionnelles · classement des dépenses · table détaillée des postes (nature, usage, écart) · répartition polaire | Analyse fine de "où part l'argent", poste par poste. |
| **Membres** | Barres empilées par membre (charges/réserves/poche/reste) · taux d'effort · radar comparatif | Tout ce qui compare Sophie et Marc entre eux. |

### 2.3 Composant PrimeNG pour la barre

PrimeNG propose un composant **`Dock`** (`primeng/dock`) qui ressemble
visuellement à ce qu'on veut (rangée d'icônes en bas), mais :

- son modèle attend des **icônes image** (`item.icon` = URL), pas des SVG
  inline ni des classes d'icônes ;
- son comportement signature est le **zoom au survol façon macOS**, pas un
  état actif/sélectionné persistant — il n'y a pas de notion native de "vue
  actuellement affichée" dans son API ;
- il n'est pas pensé pour rester **fixé en bas en permanence** comme
  barre de navigation principale (c'est un lanceur, pas un système d'onglets).

**Verdict : ne pas utiliser `p-dock` pour cet usage.** Construire un
composant custom léger (boutons natifs stylés aux tokens PrimeNG
`--p-primary-color`, `--p-content-*`) donne un résultat plus fiable et plus
simple à maintenir que de détourner `p-dock` de son usage prévu.

### 2.4 Contrat de composant

```ts
// view-switcher.component.ts
export interface DashboardView {
  key: 'apercu' | 'comptes' | 'postes' | 'membres';
  label: string;
  /** Nom du sprite d'icône bichrome (voir gabarit SVG plus bas). */
  icon: string;
  /** Badge optionnel, ex. nombre de postes ou d'alertes actives. */
  badge?: number;
}

@Component({
  selector: 'hly-view-switcher',
  standalone: true,
  ...
})
export class ViewSwitcherComponent {
  @Input({ required: true }) views: DashboardView[] = [];
  @Input({ required: true }) active!: DashboardView['key'];
  @Output() activeChange = new EventEmitter<DashboardView['key']>();
}
```

Gabarit d'icône bichrome (calque secondaire atténué + calque principal
plein, tous deux en `currentColor` pour hériter automatiquement de la
couleur active) :

```html
<svg class="ic2" viewBox="0 0 24 24">
  <path class="s" d="…" />  <!-- opacity: .32, forme secondaire -->
  <path class="p" d="…" />  <!-- opacity: 1, forme principale -->
</svg>
```

```scss
.ic2 { width: 19px; height: 19px; }
.ic2 .s { fill: currentColor; opacity: .32; }
.ic2 .p { fill: currentColor; }
```

### 2.5 Comportement & responsive

- **Fixée en bas, identique desktop et mobile** — ce n'est pas un
  bottom-nav "mode mobile uniquement" qui redeviendrait des tabs en haut
  sur desktop : la position ne change jamais.
- Icône seule + libellé en `pTooltip` au survol (pas de texte visible sous
  l'icône), pour rester la plus basse possible en hauteur (~30–42px total).
- État actif : fond teinté à la couleur primaire (`color-mix` à ~13 %) +
  icône en couleur primaire pleine — pas de fond plein PrimeNG "primary"
  classique, qui serait trop appuyé pour une barre permanente.
- Badge (nombre de postes, d'alertes...) optionnel, petit point ou chiffre
  en coin du bouton.

---

## 3. Flux mensuel avec mois actif visible

### 3.1 Objectif

Le graphique de flux (barres charges/réserves empilées + ligne revenus sur
12 mois) doit **visuellement répondre** au mois sélectionné dans le rail de
période, pour que le graphique et le sélecteur racontent la même histoire
sans que l'utilisateur ait à faire le lien mentalement.

### 3.2 Comportement visuel du mois actif

| Élément du graphique | État normal | État "mois actif" |
|---|---|---|
| Barres (charges, réserves) | Couleur à ~50 % d'opacité | Couleur pleine (~95 % d'opacité) |
| Point de la ligne (revenus) | Rayon 1.5–2px | Rayon 4–5px, éventuellement contour blanc |
| Mode Année | — | Aucun mois surligné (tout à l'état normal, puisqu'aucun mois précis n'est "actif") |

### 3.3 Synchronisation bidirectionnelle

- **Rail → graphique** : changer de mois dans le rail redessine le
  graphique avec le nouveau mois surligné.
- **Graphique → rail** : cliquer une barre/point du graphique change la
  période sélectionnée (et donc met à jour le rail, qui se recentre sur le
  nouveau mois actif). Avec Chart.js, ça passe par l'option `onClick` du
  graphique, en récupérant l'index de l'élément cliqué :

```ts
new Chart(ctx, {
  data: { /* ... */ },
  options: {
    onClick: (event, elements) => {
      if (!elements.length) return;
      const monthIndex = elements[0].index;
      this.period.update(p => ({ ...p, mode: 'mois', monthIndex }));
    },
  },
});
```

- Dans une implémentation `p-chart` (wrapper Angular de Chart.js), cette
  option se passe telle quelle dans l'`[options]` du composant — pas de
  différence par rapport à Chart.js natif sur ce point précis.

### 3.4 Détail technique

- Recalculer `pointRadius` et `backgroundColor` **par élément** (tableau,
  pas valeur scalaire) à chaque changement de période, en fonction de
  l'index du mois actif :

```ts
function radiusPerMonth(activeIndex: number | null): number[] {
  return MONTHS.map((_, i) => (i === activeIndex ? 5 : 2));
}
```

- Le recalcul doit se faire côté composant du graphique (pas dans un
  service partagé) pour rester performant : seul le dataset change, pas la
  structure du graphique.

---

## 4. Composant réutilisable — liste de montants à barres

### 4.1 Objectif

Remplacer la liste "Revenus / Charges / Réserves / Argent de poche /
Disponible" par un **composant indépendant et réutilisable**, utilisable
partout où on affiche une décomposition de montants avec proportion visuelle
(pas seulement dans l'aperçu — aussi pertinent pour le détail d'un compte,
d'un poste, d'un membre).

Demande spécifique : **le libellé s'affiche à l'intérieur de la barre, côté
gauche ; le montant s'affiche à l'intérieur de la barre, côté droit** — ce
n'est donc pas un libellé au-dessus d'une barre en dessous, mais un texte
superposé directement sur la barre elle-même.

### 4.2 Anatomie visuelle

```
┌──────────────────────────────────────────────────────────────┐
│ ● Revenus                                          5 200 €   │  ← barre pleine (référence)
├──────────────────────────────────────────────────────────────┤
│ ● Charges  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░   2 890 €   │  ← remplissage 55 %
├──────────────────────────────────────────────────────────────┤
│ ● Réserves ▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   1 065 €   │  ← remplissage 20 %
├──────────────────────────────────────────────────────────────┤
│ ● Argent de poche ▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░     240 €   │  ← remplissage 5 %
├──────────────────────────────────────────────────────────────┤
│ ● Disponible ▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░   1 005 €   │  ← ligne "total", mise en avant
└──────────────────────────────────────────────────────────────┘
```

- Chaque ligne est une **barre pleine largeur** (le "track"), pas juste une
  barre fine sous le texte.
- Le **remplissage coloré** représente la proportion (montant / référence,
  généralement le total des revenus).
- **Libellé** ancré à gauche, **montant** ancré à droite, tous deux
  **superposés sur la barre**, quelle que soit la largeur du remplissage.
- La ligne "Disponible" (ou toute ligne "total") a un traitement visuel
  distinct : texte en gras, éventuellement bordure ou poids de couleur plus
  fort.

### 4.3 Contrat de composant

```ts
// amount-bar-list.component.ts
export interface AmountBarItem {
  key: string;
  label: string;
  amount: number;
  /** Couleur du remplissage (token CSS ou valeur hex). */
  color: string;
  /** Icône PrimeIcons optionnelle affichée avant le libellé. */
  icon?: string;
  /** Texte affiché dans un pTooltip via une icône "?" à côté du libellé. */
  helpText?: string;
  /** Met la ligne en avant visuellement (ex. le "Disponible" en bas de liste). */
  emphasis?: boolean;
}

@Component({
  selector: 'hly-amount-bar-list',
  standalone: true,
  imports: [TooltipModule],
  templateUrl: './amount-bar-list.component.html',
  styleUrl: './amount-bar-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmountBarListComponent {
  @Input({ required: true }) items: AmountBarItem[] = [];
  /**
   * Valeur servant de référence à 100 % du remplissage.
   * Si omise, on prend automatiquement le montant le plus élevé de `items`.
   * Typiquement : le total des revenus de la période.
   */
  @Input() reference?: number;
  @Input() currency = '€';
  @Input() locale = 'fr-FR';

  protected percent(item: AmountBarItem): number {
    const ref = this.reference ?? Math.max(...this.items.map(i => i.amount));
    return ref > 0 ? Math.min(100, (item.amount / ref) * 100) : 0;
  }
}
```

Utilisation :

```html
<hly-amount-bar-list
  [items]="[
    { key: 'rev', label: 'Revenus', amount: 5200, color: 'var(--c-rev)' },
    { key: 'chg', label: 'Charges', amount: 2890, color: 'var(--c-chg)', helpText: aides.chargesFixes },
    { key: 'res', label: 'Réserves', amount: 1065, color: 'var(--c-res)', helpText: aides.reserves },
    { key: 'arg', label: 'Argent de poche', amount: 240, color: 'var(--c-arg)' },
    { key: 'dis', label: 'Disponible', amount: 1005, color: 'var(--c-sol)', emphasis: true }
  ]"
  [reference]="5200" />
```

### 4.4 Technique de rendu

Le point délicat d'un texte superposé sur une barre partiellement remplie
est le **contraste** : le libellé passe-t-il sur fond coloré (à gauche) ou
sur fond neutre (à droite), selon la largeur du remplissage — la même
couleur de texte ne peut pas garantir un bon contraste des deux côtés à la
fois.

**Approche recommandée (par défaut) — remplissage en aplat clair** :
le remplissage reste à opacité réduite (16–22 %) au lieu d'un aplat plein.
Le texte garde une seule couleur (`--p-text-color`) dans toute la barre :
le contraste reste bon sur toute la largeur car le fond ne devient jamais
assez sombre pour poser problème, y compris en thème sombre.

```html
<div class="bar" [style.--fill]="percent(item) + '%'" [style.--color]="item.color">
  <span class="bar__fill"></span>
  <span class="bar__label">
    <i class="dot" [style.background]="item.color"></i>
    {{ item.label }}
    @if (item.helpText) {
      <i class="pi pi-question-circle help" [pTooltip]="item.helpText"></i>
    }
  </span>
  <span class="bar__amount">{{ item.amount | number:'1.0-0':locale }} {{ currency }}</span>
</div>
```

```scss
.bar {
  position: relative;
  min-height: 34px;
  border-radius: 6px;
  background: var(--p-content-hover-background);
  display: flex;
  align-items: center;
  overflow: hidden;

  &__fill {
    position: absolute;
    inset: 0;
    width: var(--fill);
    background: var(--color);
    opacity: .18;               // clé du contraste : jamais un aplat plein
    border-radius: 6px 0 0 6px;
    transition: width .35s ease;
  }

  &__label,
  &__amount {
    position: relative;         // au-dessus du fill
    z-index: 1;
    font-size: 12.5px;
  }

  &__label  { margin-right: auto; padding-left: 10px; display: inline-flex; align-items: center; gap: 6px; }
  &__amount { padding-right: 10px; font-weight: 600; font-variant-numeric: tabular-nums; }
}
```

**Alternative avancée (optionnelle)** — si le design veut un remplissage en
aplat plein (couleur saturée, texte blanc dessus) plutôt qu'un ton clair :
il faut alors dupliquer le texte en deux couches superposées — une couche
"neutre" en `--p-text-color` visible sur toute la barre, une couche
"inversée" en blanc, contenue dans un conteneur `width: var(--fill);
overflow: hidden` calé exactement sur le remplissage, pour que le texte
blanc n'apparaisse que là où le fond est effectivement coloré. C'est plus
correct visuellement mais plus coûteux à maintenir (deux fois le markup de
texte, synchronisation stricte des polices/tailles entre les deux couches).
**À réserver à une itération ultérieure si le rendu "aplat clair" ne
convient pas visuellement.**

### 4.5 Où le réutiliser

Puisque c'est un composant indépendant, il a vocation à réapparaître :

- dans **Comptes**, pour détailler entrées/sorties d'un compte précis ;
- dans **Postes**, pour comparer charges fixes vs variables ;
- dans **Membres**, pour la décomposition individuelle de chaque personne
  (actuellement une barre empilée unique — `AmountBarList` peut en être une
  vue alternative plus lisible pour de longues listes).

---

## 5. Annexe — checklist de migration

- [ ] Extraire le sélecteur de période actuel (toggle + chevrons) et le
  remplacer par `hly-period-rail`.
- [ ] Calculer `MonthHealth[]` depuis le service de données réel (actuellement
  simulé par des seuils sur `SOLDES` dans les maquettes).
- [ ] Créer les 4 routes/vues (`apercu`, `comptes`, `postes`, `membres`) et
  **déplacer** (pas copier) chaque widget existant selon le tableau de
  la section 2.2.
- [ ] Construire `hly-view-switcher` et le brancher sur le router (ou un
  signal d'état si les vues restent dans un seul composant parent).
- [ ] Ajouter la logique de surlignage du mois actif dans le widget de flux
  mensuel + l'option `onClick` pour la synchronisation inverse.
- [ ] Créer `hly-amount-bar-list`, migrer la liste actuelle "Revenus /
  Charges / Réserves / Argent de poche / Disponible" dessus, puis
  identifier les 2-3 autres endroits du dashboard qui bénéficieraient
  du même composant plutôt que de markup dupliqué.
- [ ] Revalider le responsive mobile de chaque brique indépendamment (rail,
  barre de vues, flux mensuel, liste de montants) — elles doivent
  fonctionner aussi bien isolées que combinées.