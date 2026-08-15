# Composant `ComptesHubRecapComponent`

Guide d'implémentation d'une nouvelle vue "Hub & Rayons" pour le récapitulatif mensuel de trésorerie, basée sur `p-organization-chart` de PrimeNG.

---

## 1. Vue d'ensemble

Le composant affiche les comptes du mois sous forme d'arbre :

- **Racine** : le compte "hub" (celui qui redistribue le plus vers les autres — typiquement le compte courant).
- **Enfants** : les autres comptes, chacun affiché comme une card enrichie.

Chaque card affiche :
- Nom du compte + membres associés.
- `Entrées` (uniquement si `> 0`).
- `Sorties` (= `sortiesEchues`, **toujours affiché** même à zéro).
- `Virements sortants` (uniquement si `> 0`).
- `Solde restant` = `(virementsEntrants + entrees) - (sortiesEchues + virementsSortants)`.

En cas de solde négatif : bordure rouge, solde en rouge, message d'avertissement affiché sous le solde.

Les virements entrants ne sont pas affichés dans la card : l'information est portée visuellement par le lien parent → enfant de l'orgchart.

---

## 2. Prérequis backend

### 2.1 Extension du DTO `CompteRecapMensuelDto`

Ajouter le champ `membres` :

```typescript
// src/app/core/models/api.models.ts

export interface CompteRecapMensuelDto {
  compteId: string;
  libelleCompte: string;
  icon?: string;                    // NEW — classe PrimeIcons (ex: "pi-wallet")
  membres: MembreCompteDto[];       // NEW
  entrees: number;
  virementsEntrants: number;
  sortiesPlanifiees: number;
  sortiesEchues: number;
  virementsSortants: number;
  soldeRestant: number;
}

export interface MembreCompteDto {
  membreId: string;
  prenom: string;
  nom?: string;
}
```

### 2.2 Nouveau DTO pour les virements

Pour pouvoir tracer qui envoie à qui (les rayons de l'orgchart), le backend doit exposer les paires `from → to` :

```typescript
// src/app/core/models/api.models.ts

export interface VirementInterneDto {
  from: string;          // compteId source
  to: string | null;     // compteId cible, ou null si vers un compte externe
  montant: number;
}
```

L'endpoint mensuel doit donc retourner :

```typescript
export interface RecapMensuelResponse {
  comptes: CompteRecapMensuelDto[];
  virements: VirementInterneDto[];
}
```

> ⚠️ **Sans les paires `from → to`, la vue Hub ne peut pas fonctionner** : on ne saurait pas quel compte redistribue vers quel autre. C'est la seule dépendance bloquante.

---

## 3. Structure des fichiers

```
src/app/features/dashboard/
├── comptes-membre-recap/                    # existant, conservé
│   └── ...
└── comptes-hub-recap/                       # NEW
    ├── comptes-hub-recap.component.ts
    ├── comptes-hub-recap.component.html
    ├── comptes-hub-recap.component.scss
    └── compte-flow-card/
        ├── compte-flow-card.component.ts
        ├── compte-flow-card.component.html
        └── compte-flow-card.component.scss
```

---

## 4. Sous-composant `CompteFlowCardComponent`

C'est la card qui affiche un compte. Réutilisable ailleurs (liste, détail, etc.).

### 4.1 `compte-flow-card.component.ts`

```typescript
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { CompteRecapMensuelDto } from '../../../../core/models/api.models';
import { MontantPipe } from '../../../../core/pipes/format.pipes';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { inject } from '@angular/core';

export type CompteFlowCardVariant = 'satellite' | 'hub' | 'external';

/**
 * Card enrichie affichant les flux d'un compte pour la vue Hub.
 * Utilisée à l'intérieur d'un `p-organization-chart` mais réutilisable
 * dans d'autres contextes (liste, détail).
 */
@Component({
  selector: 'app-compte-flow-card',
  standalone: true,
  imports: [CommonModule, TagModule, MontantPipe],
  templateUrl: './compte-flow-card.component.html',
  styleUrl: './compte-flow-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompteFlowCardComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly compte = input.required<CompteRecapMensuelDto>();
  readonly devise = input<string>('CHF');
  readonly variant = input<CompteFlowCardVariant>('satellite');

  // État calculé
  protected readonly isHub = computed(() => this.variant() === 'hub');
  protected readonly isNegatif = computed(() => this.compte().soldeRestant < 0);
  protected readonly isZero = computed(() => this.compte().soldeRestant === 0);

  // Affichage conditionnel des lignes
  protected readonly showEntrees = computed(() => this.compte().entrees > 0);
  protected readonly showVirementsSortants = computed(() => this.compte().virementsSortants > 0);

  // Sévérité pour le p-tag du solde
  protected readonly soldeSeverity = computed(() =>
    this.isNegatif() ? 'danger' : this.isZero() ? 'secondary' : 'info'
  );

  // Membres formatés en une chaîne courte
  protected readonly membresLabel = computed(() => {
    const m = this.compte().membres ?? [];
    if (m.length === 0) return '—';
    if (m.length === 1) return m[0].prenom;
    if (m.length === 2) return `${m[0].prenom}, ${m[1].prenom}`;
    return `${m[0].prenom}, ${m[1].prenom} +${m.length - 2}`;
  });

  protected readonly membreIcon = computed(() =>
    (this.compte().membres?.length ?? 0) > 1 ? 'pi-users' : 'pi-user'
  );

  protected readonly icon = computed(() => this.compte().icon ?? 'pi-wallet');
}
```

### 4.2 `compte-flow-card.component.html`

```html
<div class="flow-card"
     [class.hub]="isHub()"
     [class.negatif]="isNegatif()">

  <!-- Header : avatar + nom + membres + badge Hub -->
  <div class="flow-card-header">
    <div class="flow-card-avatar">
      <i class="pi" [ngClass]="icon()"></i>
    </div>
    <div class="flow-card-header-text">
      <div class="flow-card-name">{{ compte().libelleCompte }}</div>
      <div class="flow-card-membres">
        <i class="pi" [ngClass]="membreIcon()"></i>
        <span class="noms">{{ membresLabel() }}</span>
      </div>
    </div>
    @if (isHub()) {
      <span class="flow-card-hub-badge">
        <i class="pi pi-star-fill"></i>{{ t.dashboard.hubBadge }}
      </span>
    }
  </div>

  <!-- Body : lignes de flux -->
  <div class="flow-card-body">
    @if (showEntrees()) {
      <div class="flow-row entree">
        <span class="flow-label">
          <i class="pi pi-arrow-down-left"></i>{{ t.dashboard.comptesEntrees }}
        </span>
        <span class="flow-value">+{{ compte().entrees | montant:devise() }}</span>
      </div>
    }

    <!-- Sorties : TOUJOURS affiché, même à 0 -->
    <div class="flow-row sortie">
      <span class="flow-label">
        <i class="pi pi-arrow-up-right"></i>{{ t.dashboard.comptesSorties }}
      </span>
      <span class="flow-value">
        {{ compte().sortiesEchues > 0 ? '−' : '' }}{{ compte().sortiesEchues | montant:devise() }}
      </span>
    </div>

    @if (showVirementsSortants()) {
      <div class="flow-row virement-out">
        <span class="flow-label">
          <i class="pi pi-sign-out"></i>{{ t.dashboard.comptesVirementsSortants }}
        </span>
        <span class="flow-value">−{{ compte().virementsSortants | montant:devise() }}</span>
      </div>
    }
  </div>

  <!-- Footer : solde + avertissement si négatif -->
  <div class="flow-card-footer" [class.negatif]="isNegatif()">
    <div class="solde-row">
      <span class="solde-label">{{ t.dashboard.comptesSoldeRestant }}</span>
      <span class="solde-value"
            [class.negatif]="isNegatif()"
            [class.zero]="isZero()">
        {{ compte().soldeRestant | montant:devise() }}
      </span>
    </div>

    @if (isNegatif()) {
      <div class="solde-warning" role="alert">
        <i class="pi pi-exclamation-triangle"></i>
        <span class="solde-warning-text">
          {{ t.dashboard.comptesSoldeNegatifMessage }}
        </span>
      </div>
    }
  </div>
</div>
```

### 4.3 `compte-flow-card.component.scss`

```scss
:host {
  display: inline-block;
}

.flow-card {
  display: flex;
  flex-direction: column;
  width: 280px;
  background: var(--p-surface-700);
  border-radius: var(--p-content-border-radius);
  border: 1px solid transparent;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.2),
    0 4px 8px rgba(0, 0, 0, 0.15);
  color: var(--p-text-color);
  text-align: left;
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 0 2px var(--p-primary-color), 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  // Variante Hub
  &.hub {
    width: 320px;
    background: linear-gradient(135deg, var(--p-surface-700), var(--p-surface-600));
    border-color: var(--p-primary-color);

    .flow-card-avatar {
      background: var(--p-primary-color);
      color: var(--p-primary-contrast-color, white);
      width: 40px;
      height: 40px;
      font-size: 18px;
    }
  }

  // Variante solde négatif
  &.negatif {
    border-color: var(--p-red-500);
    box-shadow: 0 0 0 1px var(--p-red-500), 0 4px 8px rgba(239, 68, 68, 0.15);

    &:hover {
      box-shadow: 0 0 0 2px var(--p-red-500), 0 8px 24px rgba(239, 68, 68, 0.25);
    }
  }
}

.flow-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 10px;
}

.flow-card-avatar {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--p-primary-100);
  color: var(--p-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}

.flow-card-header-text {
  flex: 1;
  min-width: 0;
}

.flow-card-name {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 3px;
}

.flow-card-membres {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--p-surface-500);

  i { font-size: 10px; }

  .noms {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.flow-card-hub-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color, white);
  padding: 3px 8px;
  border-radius: 10px;
  flex-shrink: 0;

  i { font-size: 8px; }
}

.flow-card-body {
  padding: 4px 16px 10px;
}

.flow-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 0;
  font-size: 12px;

  & + .flow-row {
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .flow-label {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--p-surface-500);

    i {
      font-size: 11px;
      width: 14px;
      text-align: center;
    }
  }

  .flow-value {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  &.entree {
    .flow-label i, .flow-value { color: var(--p-green-500); }
  }
  &.sortie {
    .flow-label i, .flow-value { color: var(--p-orange-500); }
  }
  &.virement-out {
    .flow-label i, .flow-value { color: var(--p-indigo-500, var(--p-primary-color)); }
  }
}

.flow-card-footer {
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.15);
  border-top: 1px solid rgba(255, 255, 255, 0.05);

  &.negatif {
    background: rgba(239, 68, 68, 0.08);
  }
}

.solde-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.solde-label {
  font-size: 10px;
  color: var(--p-surface-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.solde-value {
  font-size: 18px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--p-primary-color);

  &.negatif { color: var(--p-red-500); }
  &.zero { color: var(--p-surface-500); }
}

.solde-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 10px;
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid var(--p-red-500);
  border-radius: 4px;
  font-size: 11px;
  line-height: 1.4;

  i {
    font-size: 12px;
    margin-top: 1px;
    flex-shrink: 0;
    color: var(--p-red-500);
  }

  .solde-warning-text {
    flex: 1;
    color: var(--p-red-400, #fca5a5);
  }
}
```

> ✅ Toutes les couleurs passent par les tokens PrimeNG (`--p-primary-color`, `--p-red-500`, etc.) — la card suit donc automatiquement ta charte quand tu changes de thème.

---

## 5. Composant principal `ComptesHubRecapComponent`

### 5.1 `comptes-hub-recap.component.ts`

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { SkeletonModule } from 'primeng/skeleton';
import { TreeNode } from 'primeng/api';

import { CompteRecapMensuelDto, VirementInterneDto } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { CompteFlowCardComponent } from './compte-flow-card/compte-flow-card.component';

interface HubNodeData {
  kind: 'compte';
  compte: CompteRecapMensuelDto;
}

interface ExternalNodeData {
  kind: 'external';
  montant: number;
}

type OrgNodeData = HubNodeData | ExternalNodeData;

/**
 * Vue "Hub & Rayons" du récapitulatif mensuel : le compte qui redistribue
 * le plus est placé à la racine, les autres comptes en enfants.
 * Chaque nœud est une `CompteFlowCardComponent`.
 *
 * Reçoit ses données déjà calculées côté serveur via `@Input`.
 */
@Component({
  selector: 'app-comptes-hub-recap',
  standalone: true,
  imports: [
    CommonModule,
    OrganizationChartModule,
    SkeletonModule,
    CompteFlowCardComponent,
  ],
  templateUrl: './comptes-hub-recap.component.html',
  styleUrl: './comptes-hub-recap.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComptesHubRecapComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly recaps = input<CompteRecapMensuelDto[]>([]);
  readonly virements = input<VirementInterneDto[]>([]);
  readonly devise = input<string>('CHF');
  readonly chargement = input<boolean>(false);

  /** Le hub = le compte avec le plus de virements sortants. */
  private readonly hub = computed<CompteRecapMensuelDto | null>(() => {
    const comptes = this.recaps();
    if (comptes.length === 0) return null;
    return [...comptes].sort((a, b) => b.virementsSortants - a.virementsSortants)[0];
  });

  /** Arbre PrimeNG : racine = hub, enfants = un par virement sortant. */
  protected readonly tree = computed<TreeNode<OrgNodeData>[]>(() => {
    const hub = this.hub();
    if (!hub) return [];

    const virementsSortants = this.virements().filter(v => v.from === hub.compteId);

    const children: TreeNode<OrgNodeData>[] = virementsSortants.map(v => {
      // Compte cible connu → nœud "compte"
      const compteCible = this.recaps().find(c => c.compteId === v.to);
      if (compteCible) {
        return {
          type: compteCible.soldeRestant < 0 ? 'critical' : 'default',
          data: { kind: 'compte', compte: compteCible },
        };
      }
      // Sinon → nœud "externe" (virement hors périmètre)
      return {
        type: 'external',
        data: { kind: 'external', montant: v.montant },
      };
    });

    return [{
      type: 'hub',
      data: { kind: 'compte', compte: hub },
      expanded: true,
      children,
    }];
  });

  /** Vrai si l'affichage doit montrer l'état vide. */
  protected readonly aucunCompte = computed(() =>
    !this.chargement() && this.recaps().length === 0
  );

  /** Type-guard pour les templates. */
  protected asCompte(data: OrgNodeData): CompteRecapMensuelDto | null {
    return data.kind === 'compte' ? data.compte : null;
  }

  protected asExternal(data: OrgNodeData): number | null {
    return data.kind === 'external' ? data.montant : null;
  }
}
```

### 5.2 `comptes-hub-recap.component.html`

```html
<div class="hub-recap">
  <p class="hub-recap-description">
    {{ t.dashboard.comptesDescription }}
  </p>

  @if (chargement()) {
    <div class="hub-recap-skeleton">
      <p-skeleton width="320px" height="220px" borderRadius="12px" />
      <div class="hub-recap-skeleton-children">
        @for (i of [1, 2, 3, 4, 5]; track i) {
          <p-skeleton width="280px" height="220px" borderRadius="12px" />
        }
      </div>
    </div>
  } @else if (aucunCompte()) {
    <p class="hub-recap-empty">{{ t.dashboard.comptesAucunCompte }}</p>
  } @else {
    <div class="hub-recap-chart">
      <p-organization-chart [value]="tree()" [collapsible]="false">

        <!-- Nœud hub -->
        <ng-template pTemplate="hub" let-node>
          @if (asCompte(node.data); as compte) {
            <app-compte-flow-card
              [compte]="compte"
              [devise]="devise()"
              variant="hub" />
          }
        </ng-template>

        <!-- Nœud compte satellite -->
        <ng-template pTemplate="default" let-node>
          @if (asCompte(node.data); as compte) {
            <app-compte-flow-card
              [compte]="compte"
              [devise]="devise()"
              variant="satellite" />
          }
        </ng-template>

        <!-- Nœud compte satellite avec solde critique (négatif) -->
        <ng-template pTemplate="critical" let-node>
          @if (asCompte(node.data); as compte) {
            <app-compte-flow-card
              [compte]="compte"
              [devise]="devise()"
              variant="satellite" />
          }
        </ng-template>

        <!-- Nœud compte externe (hors périmètre) -->
        <ng-template pTemplate="external" let-node>
          @if (asExternal(node.data); as montant) {
            <div class="external-node">
              <div class="external-node-avatar">
                <i class="pi pi-external-link"></i>
              </div>
              <div class="external-node-body">
                <div class="external-node-name">
                  {{ t.dashboard.compteExterne }}
                </div>
                <div class="external-node-montant">
                  {{ montant | montant:devise() }}
                </div>
              </div>
            </div>
          }
        </ng-template>

      </p-organization-chart>
    </div>
  }
</div>
```

### 5.3 `comptes-hub-recap.component.scss`

```scss
:host {
  display: block;
}

.hub-recap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hub-recap-description {
  margin: 0;
  font-size: 12px;
  color: var(--p-surface-500);
}

.hub-recap-empty {
  margin: 0;
  color: var(--p-surface-500);
  text-align: center;
  padding: 32px 16px;
}

.hub-recap-skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  padding: 20px;
}

.hub-recap-skeleton-children {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.hub-recap-chart {
  overflow-x: auto;
  padding: 8px 0;

  // Surcharges de p-organization-chart pour laisser la card gérer son propre style
  ::ng-deep {
    .p-organizationchart {
      background: transparent;
    }
    .p-organizationchart-node-content {
      padding: 0;
      background: transparent;
      border: none;
      box-shadow: none;

      // Désactive le hover par défaut du node-content : notre card gère le sien
      &:hover {
        background: transparent;
      }
    }
    // Couleur des lignes accordée à la charte
    .p-organizationchart-lines,
    .p-organizationchart-line-down,
    .p-organizationchart-line-top,
    .p-organizationchart-line-left,
    .p-organizationchart-line-right {
      background-color: var(--p-surface-border);
      border-color: var(--p-surface-border) !important;
    }
  }
}

// Nœud "compte externe"
.external-node {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  width: 200px;
  background: var(--p-surface-800);
  border: 1px dashed var(--p-surface-border);
  border-radius: var(--p-content-border-radius);
  opacity: 0.7;
  text-align: left;

  .external-node-avatar {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(148, 163, 184, 0.15);
    color: var(--p-surface-500);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .external-node-body { flex: 1; }

  .external-node-name {
    font-size: 12px;
    color: var(--p-surface-500);
    font-weight: 600;
    margin-bottom: 2px;
  }

  .external-node-montant {
    font-size: 14px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: var(--p-indigo-500, var(--p-primary-color));
  }
}
```

---

## 6. Ajouts au service i18n

Dans le fichier de traductions (ex: `src/app/core/i18n/translations/fr.ts`), ajouter les clés :

```typescript
export const fr = {
  dashboard: {
    // ... clés existantes
    comptesDescription: '...',
    comptesEntrees: 'Entrées',
    comptesVirementsEntrants: 'Virements entrants',
    comptesVirementsSortants: 'Virements sortants',
    comptesSortiesEchues: 'Sorties échues',
    comptesSortiesPlanifiees: 'Sorties planifiées',
    comptesSoldeRestant: 'Solde restant',
    comptesAucunCompte: 'Aucun compte à afficher pour ce mois.',

    // NOUVELLES clés pour la vue Hub
    comptesSorties: 'Sorties',
    hubBadge: 'Hub',
    compteExterne: 'Compte externe',
    comptesSoldeNegatifMessage:
      'Un solde négatif va diminuer la trésorerie cumulée du compte. ' +
      'Si le compte ne contient plus de trésorerie, veuillez virer ce ' +
      'montant en plus pour éviter d’être à découvert.',
  },
  // ...
};
```

Répéter pour les autres langues supportées.

---

## 7. Intégration dans une page

Dans la page dashboard qui affichait déjà `<app-comptes-membre-recap>` :

```html
<!-- src/app/features/dashboard/dashboard.page.html -->

<p-card>
  <ng-template pTemplate="title">
    {{ t.dashboard.virementsTitre }}
  </ng-template>

  <app-comptes-hub-recap
    [recaps]="recapMensuel()?.comptes ?? []"
    [virements]="recapMensuel()?.virements ?? []"
    [devise]="devise()"
    [chargement]="chargement()" />
</p-card>
```

Où `recapMensuel()` est un signal qui contient le `RecapMensuelResponse` (voir §2.2).

---

## 8. Notes techniques

### 8.1 Responsive

L'orgchart est structurellement large (les enfants sont côte à côte). Le wrapper `.hub-recap-chart` a `overflow-x: auto` : sur mobile, l'utilisateur scrolle horizontalement.

Si tu veux un fallback plus doux sur mobile, tu peux ajouter un breakpoint qui bascule vers `<app-comptes-membre-recap>` (l'ancienne vue en cards empilées) :

```html
<div class="hidden md:block">
  <app-comptes-hub-recap ... />
</div>
<div class="block md:hidden">
  <app-comptes-membre-recap ... />
</div>
```

### 8.2 Détermination du hub

Le composant identifie le hub automatiquement via `Math.max(virementsSortants)`. Si tu veux le forcer explicitement (par exemple si un utilisateur a désigné un compte comme "principal"), ajoute un champ `estHub?: boolean` au DTO et adapte le `computed()` :

```typescript
private readonly hub = computed(() => {
  const comptes = this.recaps();
  const forced = comptes.find(c => c.estHub);
  if (forced) return forced;
  return [...comptes].sort((a, b) => b.virementsSortants - a.virementsSortants)[0] ?? null;
});
```

### 8.3 Sélection / clic sur un nœud

`p-organization-chart` supporte `selectionMode="single"` et `[(selection)]="selected"`. Si tu veux ouvrir un détail du compte au clic, ajoute :

```html
<p-organization-chart
  [value]="tree()"
  selectionMode="single"
  [(selection)]="selection"
  (selectionChange)="onCompteSelected($event)">
```

### 8.4 Accessibilité

- Le message d'avertissement du solde négatif porte `role="alert"` — il sera lu par les lecteurs d'écran.
- Chaque icône `pi` est décorative ; le libellé texte est adjacent, donc pas besoin de `aria-label` supplémentaire.
- Les couleurs (rouge, vert, orange) ne portent jamais seules l'information : elles sont toujours accompagnées d'un signe (`+`, `−`) et d'un libellé (`Entrées`, `Sorties`).

### 8.5 Edge cases à gérer côté backend

- **Comptes sans membres** : la card affiche `—` à la place du libellé de membres. Vérifier que le DTO retourne toujours un tableau (même vide) et non `null`.
- **Aucun hub identifiable** (tous les `virementsSortants` à 0) : le composant utilise quand même le premier compte par défaut. Idéalement, retourner un flag depuis le serveur pour désactiver la vue Hub dans ce cas.
- **Virement vers un `to` inexistant dans `comptes`** : traité comme "Compte externe" (rendu grisé). Vérifier que la somme des virements externes + virements internes = total `virementsSortants` du hub, sinon il y a une incohérence dans les données.

---

## 9. Checklist d'intégration

- [ ] Backend : DTO `CompteRecapMensuelDto` étendu avec `membres` et `icon?`.
- [ ] Backend : nouveau DTO `VirementInterneDto` avec paires `from → to`.
- [ ] Backend : endpoint mensuel retourne `RecapMensuelResponse { comptes, virements }`.
- [ ] Frontend : `npm install primeng@22` déjà fait, `OrganizationChartModule` importable.
- [ ] Frontend : création des 6 fichiers dans `comptes-hub-recap/`.
- [ ] i18n : 4 clés ajoutées dans chaque langue.
- [ ] Intégration dans le dashboard.
- [ ] Test manuel : afficher au moins un compte à solde négatif pour vérifier l'avertissement.
- [ ] Test responsive : vérifier le scroll horizontal sur mobile.