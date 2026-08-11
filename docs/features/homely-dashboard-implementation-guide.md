# Homely — Guide d'implémentation du dashboard

> **Cible** : Agent GitHub Copilot.
> **Contexte** : Angular + PrimeNG. On construit deux dashboards (mensuel et annuel) qui partagent la même grammaire visuelle : sections thématiques → cartes d'indicateurs → drawer latéral au clic.
> **Périmètre** : ce document décrit **la structure** et **l'API des composants**. Aucune donnée métier, aucun libellé final : ce sera le travail des indicateurs concrets qui viendront ensuite.

---

## 1. Vue d'ensemble

Chaque dashboard = une **liste de sections**. Chaque section = un **titre** + une **liste de cartes d'indicateur**. Cliquer sur une carte ouvre le **drawer** qui affiche un titre (repris de la carte) et un contenu spécifique à l'indicateur.

Trois composants réutilisables à construire :

| Composant                         | Rôle                                                    |
| --------------------------------- | ------------------------------------------------------- |
| `IndicatorCardComponent`          | Une ligne d'indicateur (icône · titre · sous-titre · info · sous-info) |
| `DashboardSectionComponent`       | En-tête de section + liste de cartes                     |
| `IndicatorDrawerComponent` + service | Drawer latéral partagé, alimenté par le service         |

Les deux dashboards (mensuel / annuel) sont de simples **assembleurs** : ils déclarent leurs sections et leurs indicateurs, puis passent le tout aux composants réutilisables.

---

## 2. Arborescence cible

```
src/app/dashboard/
├── shared/
│   ├── models/
│   │   ├── indicator.model.ts              # Interfaces Indicator, IndicatorSection
│   │   └── icon-color.type.ts              # Union type des couleurs d'icône
│   │
│   ├── components/
│   │   ├── indicator-card/
│   │   │   ├── indicator-card.component.ts
│   │   │   ├── indicator-card.component.html
│   │   │   └── indicator-card.component.scss
│   │   │
│   │   ├── dashboard-section/
│   │   │   ├── dashboard-section.component.ts
│   │   │   ├── dashboard-section.component.html
│   │   │   └── dashboard-section.component.scss
│   │   │
│   │   └── indicator-drawer/
│   │       ├── indicator-drawer.component.ts
│   │       ├── indicator-drawer.component.html
│   │       └── indicator-drawer.component.scss
│   │
│   ├── services/
│   │   └── indicator-drawer.service.ts     # Pilote l'ouverture / fermeture du drawer
│   │
│   └── tokens/
│       └── _dashboard-tokens.scss          # CSS variables partagées (couleurs, radius, etc.)
│
├── monthly/
│   ├── monthly-dashboard.component.ts      # Assembleur du mensuel
│   ├── monthly-dashboard.component.html
│   └── indicators/                          # Un dossier par indicateur (drawer content + config)
│       ├── alertes/
│       ├── composition-solde/
│       └── ...
│
└── annual/
    ├── annual-dashboard.component.ts        # Assembleur de l'annuel
    ├── annual-dashboard.component.html
    └── indicators/
        └── ...
```

**Convention** : chaque indicateur concret vit dans son propre dossier sous `indicators/`, avec son composant `*-drawer-content.component.ts` et sa fonction de configuration `*.indicator.ts` qui retourne un `Indicator`.

---

## 3. Design tokens

Créer `shared/tokens/_dashboard-tokens.scss` avec les variables CSS suivantes. Les composants les consomment via `var(--…)` — jamais de couleur en dur.

```scss
:root {
  // Fonds
  --dash-bg: #F4F5F7;
  --dash-card: #FFFFFF;
  --dash-line: #E8EAEF;
  --dash-line-2: #F1F3F6;

  // Encre
  --dash-ink: #1A1D24;
  --dash-ink-2: #4A5060;
  --dash-ink-3: #8A90A0;

  // Sémantique
  --dash-pos: #2E8B57;      --dash-pos-bg: #E4F2EA;
  --dash-warn: #C48A0A;     --dash-warn-bg: #FBF1DA;
  --dash-alert: #C25A1F;    --dash-alert-bg: #FCE8DB;
  --dash-neg: #B23A3A;      --dash-neg-bg: #FADEDE;

  // Membres (à adapter selon le foyer courant, exposés via un service ou input)
  --dash-member-primary: #4F6BED;
  --dash-member-secondary: #E86FA0;

  // Radius / espacement
  --dash-radius-card: 12px;
  --dash-radius-item: 6px;
  --dash-radius-pill: 999px;
}
```

Importer ce fichier dans `styles.scss` global.

---

## 4. Composant `IndicatorCardComponent`

### Rôle
Afficher une ligne d'indicateur composée de 5 éléments :

```
[icône] [titre]                    [info]          [›]
        [sous-titre]               [sous-info]
```

### API (inputs)

```typescript
// src/app/dashboard/shared/components/indicator-card/indicator-card.component.ts
import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { IconColor } from '../../models/icon-color.type';

@Component({
  selector: 'app-indicator-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './indicator-card.component.html',
  styleUrl: './indicator-card.component.scss',
})
export class IndicatorCardComponent {
  /** Nom de l'icône (ex: PrimeIcons ou nom lucide-angular) */
  icon = input.required<string>();

  /** Palette de teinte pour le pastille d'icône */
  iconColor = input<IconColor>('gray');

  /** Titre principal de l'indicateur */
  title = input.required<string>();

  /** Sous-titre / contexte court */
  subtitle = input<string>('');

  /** Info principale (valeur, badge, ratio…) — texte simple */
  info = input<string>('');

  /** Sous-info sous l'info principale */
  infoSubtitle = input<string>('');

  /** Émis quand l'utilisateur clique la carte */
  cardClick = output<void>();
}
```

### Cas complexes : projection de contenu

Certains indicateurs ont besoin d'une **info riche** (mini-barres, badge coloré, double valeur avec pastille…). Prévoir deux slots de projection :

```html
<!-- indicator-card.component.html -->
<div class="indicator-card" (click)="cardClick.emit()">
  <div class="indicator-card__icon" [attr.data-color]="iconColor()">
    <i [class]="icon()"></i>
  </div>

  <div class="indicator-card__body">
    <div class="indicator-card__title">{{ title() }}</div>
    @if (subtitle()) {
      <div class="indicator-card__subtitle">{{ subtitle() }}</div>
    }
  </div>

  <div class="indicator-card__right">
    <!-- Contenu par défaut : info + infoSubtitle -->
    <ng-content select="[card-info]">
      <div class="indicator-card__info">{{ info() }}</div>
    </ng-content>

    @if (infoSubtitle()) {
      <div class="indicator-card__info-subtitle">{{ infoSubtitle() }}</div>
    }
  </div>

  <span class="indicator-card__chevron">›</span>
</div>
```

Ainsi, un indicateur simple utilise juste les inputs. Un indicateur avec info riche projette un template :

```html
<!-- Simple -->
<app-indicator-card
  icon="pi pi-shield"
  iconColor="pos"
  title="Marge budgétaire"
  subtitle="Sous-titre libre"
  info="49%"
  infoSubtitle="solde / revenus"
  (cardClick)="open('marge-budgetaire')" />

<!-- Avec info riche projetée -->
<app-indicator-card
  icon="pi pi-users"
  iconColor="gray"
  title="Taux d'effort par membre"
  subtitle="Sous-titre libre"
  infoSubtitle="par membre"
  (cardClick)="open('taux-effort')">
  <div card-info class="duo-effort">
    <!-- 2 mini-badges Dylan/Mélanie -->
  </div>
</app-indicator-card>
```

### Structure SCSS

Suivre une convention BEM. Les classes doivent utiliser les tokens :

```scss
// indicator-card.component.scss
.indicator-card {
  display: grid;
  grid-template-columns: 26px 1fr auto 10px;
  gap: 10px;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--dash-line);
  transition: background 0.15s;

  &:hover { background: #FAFBFC; }

  &__icon {
    width: 26px; height: 26px;
    border-radius: var(--dash-radius-item);
    display: flex; align-items: center; justify-content: center;

    // Palette pilotée par [data-color]
    &[data-color="pos"]    { background: var(--dash-pos-bg);   color: var(--dash-pos); }
    &[data-color="neg"]    { background: var(--dash-alert-bg); color: var(--dash-alert); }
    &[data-color="red"]    { background: var(--dash-neg-bg);   color: var(--dash-neg); }
    &[data-color="blue"]   { background: #E8ECFD;              color: var(--dash-member-primary); }
    &[data-color="pink"]   { background: #FBE7EF;              color: var(--dash-member-secondary); }
    &[data-color="yellow"] { background: var(--dash-warn-bg);  color: var(--dash-warn); }
    &[data-color="gray"]   { background: var(--dash-line-2);   color: var(--dash-ink-2); }
    &[data-color="violet"] { background: #EEE8FB;              color: #7B4FE0; }
    &[data-color="teal"]   { background: #E0F2EF;              color: #0F766E; }
  }

  &__body { min-width: 0; }
  &__title { font-size: 12.5px; font-weight: 600; }
  &__subtitle { font-size: 10.5px; color: var(--dash-ink-3); margin-top: 1px; }

  &__right {
    text-align: right;
    display: flex; flex-direction: column; align-items: flex-end;
  }
  &__info { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
  &__info-subtitle { font-size: 10px; color: var(--dash-ink-3); margin-top: 2px; }

  &__chevron { color: var(--dash-ink-3); font-size: 15px; opacity: 0.4; }
}
```

### Type `IconColor`

```typescript
// src/app/dashboard/shared/models/icon-color.type.ts
export type IconColor =
  | 'pos' | 'neg' | 'red'
  | 'blue' | 'pink' | 'yellow'
  | 'gray' | 'violet' | 'teal';
```

---

## 5. Composant `DashboardSectionComponent`

### Rôle
Afficher un en-tête de section (titre + trait horizontal + compteur en pill) puis une liste de cartes d'indicateurs. Le composant est un **conteneur pur** : il ne connaît pas le contenu, juste la mise en page.

### API

```typescript
// src/app/dashboard/shared/components/dashboard-section/dashboard-section.component.ts
import { Component, input, ChangeDetectionStrategy } from '@angular/core';

export type SectionCountColor = 'default' | 'warn' | 'pos' | 'info';

@Component({
  selector: 'app-dashboard-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-section.component.html',
  styleUrl: './dashboard-section.component.scss',
})
export class DashboardSectionComponent {
  /** Titre affiché en majuscule dans l'en-tête */
  title = input.required<string>();

  /** Compteur affiché à droite du titre (nombre d'items par exemple) */
  count = input<number | null>(null);

  /** Teinte du pill compteur */
  countColor = input<SectionCountColor>('default');
}
```

### Template

```html
<!-- dashboard-section.component.html -->
<div class="dashboard-section">
  <div class="dashboard-section__head">
    <span class="dashboard-section__title">{{ title() }}</span>
    <span class="dashboard-section__rule"></span>
    @if (count() !== null) {
      <span class="dashboard-section__count" [attr.data-color]="countColor()">
        {{ count() }}
      </span>
    }
  </div>
  <div class="dashboard-section__list">
    <ng-content />
  </div>
</div>
```

Le contenu de la section (les cartes) est projeté via `<ng-content />`. Le dashboard parent y place ses `<app-indicator-card>`.

### SCSS

```scss
// dashboard-section.component.scss
.dashboard-section {
  &__head {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 4px 6px;
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--dash-ink-3); font-weight: 700;
  }
  &__title { flex-shrink: 0; }
  &__rule { flex: 1; height: 1px; background: var(--dash-line); }
  &__count {
    padding: 2px 6px; border-radius: var(--dash-radius-pill);
    font-size: 9px; font-weight: 700;
    background: var(--dash-line-2); color: var(--dash-ink-2);

    &[data-color="warn"] { background: var(--dash-alert-bg); color: var(--dash-alert); }
    &[data-color="pos"]  { background: var(--dash-pos-bg);   color: var(--dash-pos); }
    &[data-color="info"] { background: #E8ECFD;              color: var(--dash-member-primary); }
  }

  &__list {
    background: var(--dash-card);
    border: 1px solid var(--dash-line);
    border-radius: var(--dash-radius-card);
    overflow: hidden;
  }
}
```

---

## 6. Composant `IndicatorDrawerComponent` + service

### Principe

Un **seul drawer** est monté au niveau du dashboard. Le service `IndicatorDrawerService` détient l'état :

- `isOpen: signal<boolean>`
- `title: signal<string>`
- `sectionLabel: signal<string>`
- `contentComponent: signal<Type<unknown> | null>`

Cliquer une carte appelle `drawerService.open({ title, sectionLabel, content })`. Le drawer instancie dynamiquement le composant de contenu via `NgComponentOutlet`.

### Service

```typescript
// src/app/dashboard/shared/services/indicator-drawer.service.ts
import { Injectable, signal, Type } from '@angular/core';

export interface DrawerOpenOptions {
  /** Libellé de la section (badge au-dessus du titre du drawer) */
  sectionLabel: string;
  /** Titre du drawer (identique au titre de la carte) */
  title: string;
  /** Composant à rendre dans le body du drawer */
  content: Type<unknown>;
}

@Injectable({ providedIn: 'root' })
export class IndicatorDrawerService {
  readonly isOpen = signal(false);
  readonly sectionLabel = signal('');
  readonly title = signal('');
  readonly content = signal<Type<unknown> | null>(null);

  open(options: DrawerOpenOptions): void {
    this.sectionLabel.set(options.sectionLabel);
    this.title.set(options.title);
    this.content.set(options.content);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    // On peut différer la remise à null du content pour éviter le flash de fermeture
    setTimeout(() => this.content.set(null), 300);
  }
}
```

### Composant

Le drawer réutilise **PrimeNG** (`p-drawer` ≥ v18, sinon `p-sidebar`) pour la mécanique d'ouverture, la position, l'accessibilité et l'animation. On habille son intérieur avec notre propre en-tête et notre pied.

```typescript
// src/app/dashboard/shared/components/indicator-drawer/indicator-drawer.component.ts
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { DrawerModule } from 'primeng/drawer'; // ou SidebarModule si version < 18
import { ButtonModule } from 'primeng/button';
import { IndicatorDrawerService } from '../../services/indicator-drawer.service';

@Component({
  selector: 'app-indicator-drawer',
  standalone: true,
  imports: [DrawerModule, ButtonModule, NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './indicator-drawer.component.html',
  styleUrl: './indicator-drawer.component.scss',
})
export class IndicatorDrawerComponent {
  protected readonly drawer = inject(IndicatorDrawerService);

  onVisibleChange(visible: boolean): void {
    if (!visible) this.drawer.close();
  }
}
```

### Template

```html
<!-- indicator-drawer.component.html -->
<p-drawer
  [visible]="drawer.isOpen()"
  (visibleChange)="onVisibleChange($event)"
  position="right"
  [modal]="true"
  [showCloseIcon]="false"
  styleClass="indicator-drawer">

  <div class="indicator-drawer__head">
    <div class="indicator-drawer__heading">
      <div class="indicator-drawer__label">{{ drawer.sectionLabel() }}</div>
      <h2 class="indicator-drawer__title">{{ drawer.title() }}</h2>
    </div>
    <button
      type="button"
      class="indicator-drawer__close"
      (click)="drawer.close()"
      aria-label="Fermer">
      <i class="pi pi-times"></i>
    </button>
  </div>

  <div class="indicator-drawer__body">
    @if (drawer.content(); as ContentCmp) {
      <ng-container *ngComponentOutlet="ContentCmp" />
    }
  </div>

  <div class="indicator-drawer__foot">
    <button pButton severity="secondary" (click)="drawer.close()">Fermer</button>
    <button pButton>Voir dans le dashboard</button>
  </div>
</p-drawer>
```

Points-clés :
- Le **titre** du drawer vient du service — donc identique au titre de la carte cliquée : le service est piloté depuis la carte via son `cardClick`.
- Le **contenu** est un composant dynamique injecté via `NgComponentOutlet`. Chaque indicateur fournit son propre composant de contenu.
- Le drawer est **monté une seule fois** dans le layout du dashboard (voir plus bas).

---

## 7. Modèle de données

Une déclaration d'indicateur ne contient **que sa structure d'affichage sur la carte + une référence au composant à rendre dans le drawer**. Aucune donnée métier n'est portée par ces interfaces.

```typescript
// src/app/dashboard/shared/models/indicator.model.ts
import { Type } from '@angular/core';
import { IconColor } from './icon-color.type';

export interface Indicator {
  /** Identifiant technique de l'indicateur (utile pour analytics ou deep-link) */
  key: string;

  // ─── Ce qui va sur la carte ───
  icon: string;
  iconColor: IconColor;
  title: string;
  subtitle?: string;
  info?: string;
  infoSubtitle?: string;

  // ─── Ce qui va dans le drawer ───
  /** Composant Angular monté dans le body du drawer */
  drawerContent: Type<unknown>;
}

export type SectionCountColor = 'default' | 'warn' | 'pos' | 'info';

export interface IndicatorSection {
  /** Titre de la section (question utilisateur) */
  title: string;
  /** Teinte du compteur */
  countColor?: SectionCountColor;
  /** Indicateurs listés dans cette section */
  indicators: Indicator[];
}

/** Une structure de dashboard = liste ordonnée de sections */
export type DashboardLayout = IndicatorSection[];
```

---

## 8. Assemblage : dashboard mensuel et annuel

Chaque dashboard est un composant qui :

1. Déclare son `DashboardLayout` (liste de sections + indicateurs).
2. Itère et rend un `<app-dashboard-section>` par section, contenant des `<app-indicator-card>`.
3. Monte le `<app-indicator-drawer>` une seule fois.
4. Cliquer une carte appelle `drawerService.open(...)`.

### Exemple : squelette du dashboard mensuel

```typescript
// src/app/dashboard/monthly/monthly-dashboard.component.ts
import { Component, inject, computed } from '@angular/core';
import { DashboardSectionComponent } from '../shared/components/dashboard-section/dashboard-section.component';
import { IndicatorCardComponent } from '../shared/components/indicator-card/indicator-card.component';
import { IndicatorDrawerComponent } from '../shared/components/indicator-drawer/indicator-drawer.component';
import { IndicatorDrawerService } from '../shared/services/indicator-drawer.service';
import { DashboardLayout, Indicator } from '../shared/models/indicator.model';

// Chaque indicateur exporte sa fonction de configuration
import { alertesIndicator } from './indicators/alertes/alertes.indicator';
import { compositionSoldeIndicator } from './indicators/composition-solde/composition-solde.indicator';
// ...

@Component({
  selector: 'app-monthly-dashboard',
  standalone: true,
  imports: [DashboardSectionComponent, IndicatorCardComponent, IndicatorDrawerComponent],
  templateUrl: './monthly-dashboard.component.html',
})
export class MonthlyDashboardComponent {
  private readonly drawer = inject(IndicatorDrawerService);

  readonly layout: DashboardLayout = [
    {
      title: 'Que dois-je faire ?',
      countColor: 'warn',
      indicators: [
        alertesIndicator(),
        // ...autres
      ],
    },
    {
      title: 'Comment se passe ce mois',
      countColor: 'pos',
      indicators: [
        compositionSoldeIndicator(),
        // ...
      ],
    },
    {
      title: 'Par rapport à d\'habitude',
      countColor: 'info',
      indicators: [
        // ...
      ],
    },
  ];

  openIndicator(section: string, indicator: Indicator): void {
    this.drawer.open({
      sectionLabel: section,
      title: indicator.title,
      content: indicator.drawerContent,
    });
  }
}
```

```html
<!-- monthly-dashboard.component.html -->
<div class="dashboard-page">

  <!-- [Hero + topbar ici, hors périmètre de ce guide] -->

  @for (section of layout; track section.title) {
    <app-dashboard-section
      [title]="section.title"
      [count]="section.indicators.length"
      [countColor]="section.countColor ?? 'default'">
      @for (indicator of section.indicators; track indicator.key) {
        <app-indicator-card
          [icon]="indicator.icon"
          [iconColor]="indicator.iconColor"
          [title]="indicator.title"
          [subtitle]="indicator.subtitle ?? ''"
          [info]="indicator.info ?? ''"
          [infoSubtitle]="indicator.infoSubtitle ?? ''"
          (cardClick)="openIndicator(section.title, indicator)" />
      }
    </app-dashboard-section>
  }

  <!-- Drawer monté une seule fois, écoute le service -->
  <app-indicator-drawer />

</div>
```

Le dashboard **annuel** suit exactement la même structure — seuls les sections et indicateurs déclarés changent. Aucun code du dashboard mensuel n'a besoin d'être dupliqué : les composants réutilisables font le travail.

---

## 9. Recette : ajouter un nouvel indicateur

Pour ajouter un indicateur (mensuel ou annuel) :

**Étape 1 — Créer le dossier**
```
src/app/dashboard/monthly/indicators/mon-nouvel-indicateur/
├── mon-nouvel-indicateur-drawer-content.component.ts
├── mon-nouvel-indicateur-drawer-content.component.html
├── mon-nouvel-indicateur-drawer-content.component.scss
└── mon-nouvel-indicateur.indicator.ts
```

**Étape 2 — Écrire le composant de contenu du drawer**
```typescript
// mon-nouvel-indicateur-drawer-content.component.ts
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-mon-nouvel-indicateur-drawer-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mon-nouvel-indicateur-drawer-content.component.html',
  styleUrl: './mon-nouvel-indicateur-drawer-content.component.scss',
})
export class MonNouvelIndicateurDrawerContentComponent {
  // Injection des services métier ici (moteur de calcul, foyer courant, etc.)
}
```

Le template décrit **uniquement le contenu du drawer** (KPIs, graphes, listes…) — il ne contient ni en-tête ni bouton fermer, qui sont gérés par `IndicatorDrawerComponent`.

**Étape 3 — Écrire la fonction de configuration**
```typescript
// mon-nouvel-indicateur.indicator.ts
import { Indicator } from '../../../shared/models/indicator.model';
import { MonNouvelIndicateurDrawerContentComponent } from './mon-nouvel-indicateur-drawer-content.component';

export function monNouvelIndicateur(): Indicator {
  return {
    key: 'mon-nouvel-indicateur',
    icon: 'pi pi-chart-line',
    iconColor: 'blue',
    title: 'Titre affiché sur la carte',
    subtitle: 'Sous-titre',
    info: '…', // rempli à la donnée côté service ou déjà résolu
    infoSubtitle: '…',
    drawerContent: MonNouvelIndicateurDrawerContentComponent,
  };
}
```

**Étape 4 — Enregistrer dans le layout du dashboard**
Importer et ajouter l'appel dans la section voulue de `monthly-dashboard.component.ts` (ou `annual-dashboard.component.ts`).

**C'est tout.** Aucun besoin de toucher aux composants réutilisables.

---

## 10. Contenu dynamique de la carte : passer à des données réelles

Le modèle `Indicator` ci-dessus expose `info` et `infoSubtitle` comme des `string`. Quand les valeurs viennent d'un service asynchrone (moteur de calcul, store), deux options :

**Option A — Résoudre les valeurs avant d'assembler le layout**
Le dashboard récupère les données au démarrage, puis construit ses `Indicator` avec les valeurs textualisées. Le layout devient un `Signal<DashboardLayout>` ou une propriété calculée.

**Option B — Passer un composant "info riche"**
Étendre `Indicator` avec un champ optionnel `infoComponent?: Type<unknown>` que la carte projette dans son slot `[card-info]`. Chaque indicateur peut alors avoir sa propre logique d'affichage de l'info (mini-barres animées, badges dynamiques, etc.).

L'option B est recommandée dès qu'un indicateur a une info riche ou réactive.

---

## 11. Résumé de l'API pour Copilot

| Composant / service      | Rôle                                       | API-clé                                                    |
| ------------------------ | ------------------------------------------ | ---------------------------------------------------------- |
| `IndicatorCardComponent` | Une ligne d'indicateur cliquable           | inputs : `icon`, `iconColor`, `title`, `subtitle`, `info`, `infoSubtitle` · output : `cardClick` · projection : `[card-info]` |
| `DashboardSectionComponent` | En-tête + liste de cartes                | inputs : `title`, `count`, `countColor` · projection : cartes |
| `IndicatorDrawerComponent`  | Drawer partagé, monté 1× par dashboard   | consomme `IndicatorDrawerService`                          |
| `IndicatorDrawerService`    | État du drawer (title, section, content) | méthodes : `open(options)`, `close()`                     |
| `Indicator`              | Modèle d'un indicateur                     | `key`, `icon`, `iconColor`, `title`, `subtitle?`, `info?`, `infoSubtitle?`, `drawerContent` |
| `IndicatorSection`       | Groupement de plusieurs indicateurs        | `title`, `countColor?`, `indicators[]`                     |
| `DashboardLayout`        | Structure complète d'un dashboard          | `IndicatorSection[]`                                       |

Une fois ces briques en place, construire les deux dashboards (mensuel et annuel) revient à écrire **un seul fichier `*-dashboard.component.ts` par vue**, qui déclare son layout et rend les composants réutilisables. Aucun code n'est dupliqué entre les deux vues.
