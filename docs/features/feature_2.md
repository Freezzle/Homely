# Composant `TableVirementsComptes` · spec d'implémentation

> Spec technique à fournir à une IA de code (Cursor, Claude Code, GitHub Copilot Chat) pour implémenter un nouveau composant Angular / PrimeNG dans le projet Homely, en remplacement du composant actuel de **flux des comptes**.

## 1. Contexte et objectif

Le projet Homely comporte actuellement un composant qui affiche les virements à faire entre comptes du foyer sous forme de **matrice comptes × comptes** (ou de flux graphique — selon l'itération en cours). Ce composant doit être remplacé par une **table à sous-en-têtes (subheader)** groupée par compte source, qui répond mieux aux besoins UX suivants :

- **Chaque ligne se lit comme une phrase directionnelle** (source → destination → montant), sans reconstruction mentale de la matrice.
- **Un compte source envoie naturellement vers plusieurs destinations** — c'est le cas normal, pas une exception. La structure doit refléter ça : `1 source → N destinations`.
- **Pas de notion d'urgence, pas de barre de progression de financement**. Le statut d'un virement est purement binaire : fait ou pas fait, matérialisé par un drapeau cliquable.
- La structure reste **une seule `<p-table>` continue** (pas de conteneurs séparés) pour bénéficier des fonctionnalités natives PrimeNG (tri, filtre, virtualisation si besoin plus tard).

## 2. Emplacement dans l'architecture existante

L'arborescence actuelle du projet est :

```
src/app/dashboard/
├── shared/
│   ├── models/
│   ├── components/
│   ├── services/
│   └── tokens/
├── monthly/
└── annual/
```

Le composant est **réutilisable** (utilisable à la fois dans le dashboard mensuel et dans le drawer d'un indicateur) donc il va dans `shared/components/`. Créer :

```
src/app/dashboard/shared/components/table-virements-comptes/
├── table-virements-comptes.component.ts
├── table-virements-comptes.component.html
├── table-virements-comptes.component.scss
└── index.ts
```

Et étendre les modèles existants dans `shared/models/` avec les interfaces Virement et Compte enrichies (section 4).

## 3. Objectifs UX à préserver dans l'implémentation

Traduire ces intentions dans le code — chaque décision technique doit servir au moins un de ces objectifs :

| Intention                                  | Traduction technique                                                                     |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Reconnaissance, pas rappel                 | Ligne = phrase autonome (source → dest → montant), pas de croisement ligne/colonne.      |
| 1 source → N destinations est normal       | Groupement par source via `rowGroupMode="subheader"`, l'utilisateur voit d'emblée cette structure. |
| Statut binaire fait / pas fait             | Bouton drapeau circulaire cliquable, deux états seulement (checkbox stylée).             |
| Identifier les virements inter-membres     | Badge violet 🔁 sur les virements dont source et destination n'ont aucun propriétaire commun. |
| Rester dans le langage PrimeNG v22 Aura    | Utiliser les tokens surface, primary, avatar, tag ; pas de composants custom "from scratch".  |
| Réutilisable dashboard / drawer            | Composant standalone, inputs signaux, aucune dépendance vers un contexte de page précis.  |

## 4. Modèle de données

Ces types étendent le modèle métier existant. Ajouter à `shared/models/virement.model.ts` (créer le fichier si nécessaire) :

```typescript
import { Membre } from './membre.model';

/**
 * Compte du foyer, avec son ou ses propriétaires.
 * Un compte peut appartenir à un seul membre (compte perso)
 * ou à plusieurs (compte commun / compte joint).
 */
export interface Compte {
  readonly id: string;
  readonly nom: string;          // "Compte courant", "Compte freelance", "Épargne obj."
  readonly proprietaires: readonly Membre[];  // ≥ 1 membre
}

/**
 * Virement à effectuer d'un compte source vers un compte destination.
 * Le contexte est une chaîne libre décrivant l'origine budgétaire du virement
 * (ex. "Loyer + charges", "Vacances Japon", "Remboursement resto"). Il est
 * calculé côté service en amont — le composant ne fait que l'afficher.
 */
export interface Virement {
  readonly id: string;
  readonly source: Compte;
  readonly destination: Compte;
  readonly montant: number;        // en centimes ou en unité, cohérent avec le reste du projet
  readonly devise?: string;        // défaut : 'CHF'
  readonly contexte?: string;      // ex. "Loyer + charges"
  readonly fait: boolean;          // état du drapeau, source de vérité côté state
}
```

Note : `Compte` et `Virement` doivent être **immuables** (`readonly`) et n'utiliser que des types du domaine. Si un modèle `Membre` existe déjà avec des propriétés supplémentaires (couleur, initiale), le réutiliser tel quel — sinon en préciser un minimal :

```typescript
export interface Membre {
  readonly id: string;
  readonly prenom: string;
  readonly initiale: string;   // ex. "D", "M" — dérivée du prénom
  readonly couleur: string;    // CSS var name ou valeur hex, cohérente avec les tokens
}
```

## 5. API du composant

Composant **standalone**, réactif via signaux, aucune dépendance à un router ou à un service global.

```typescript
@Component({
  selector: 'app-table-virements-comptes',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    AvatarModule,
    AvatarGroupModule,
    TagModule,
    ButtonModule,
  ],
  templateUrl: './table-virements-comptes.component.html',
  styleUrl: './table-virements-comptes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableVirementsComptesComponent {
  /** Liste des virements à afficher, non triée — le composant s'occupe du groupement. */
  readonly virements = input.required<readonly Virement[]>();

  /** Devise à afficher dans les montants. Défaut : 'CHF'. */
  readonly devise = input<string>('CHF');

  /** Émis quand l'utilisateur clique sur le drapeau d'un virement. */
  readonly virementBascule = output<{ virementId: string; fait: boolean }>();

  // Groupes calculés (source → liste de virements sortants + total).
  protected readonly groupes = computed(() => this.grouperParSource(this.virements()));

  // Aplatit les groupes en une seule liste ordonnée exploitable par p-table.
  protected readonly lignes = computed(() => this.aplatirEnLignes(this.groupes()));

  protected estInterMembres(v: Virement): boolean {
    const ownersSource = new Set(v.source.proprietaires.map(m => m.id));
    return v.destination.proprietaires.every(m => !ownersSource.has(m.id));
  }

  protected onBasculerStatut(v: Virement): void {
    this.virementBascule.emit({ virementId: v.id, fait: !v.fait });
  }

  private grouperParSource(virements: readonly Virement[]): SourceGroup[] { /* ... */ }
  private aplatirEnLignes(groupes: SourceGroup[]): LigneTable[] { /* ... */ }
}

interface SourceGroup {
  compteSource: Compte;
  virements: readonly Virement[];
  total: number;
}

/**
 * Union des lignes qui peuvent apparaître dans la p-table :
 * soit un sous-en-tête de groupe (une bannière), soit une ligne de virement.
 */
type LigneTable =
  | { type: 'subheader'; groupe: SourceGroup }
  | { type: 'data'; virement: Virement; interMembres: boolean };
```

Le parent est **responsable de la source de vérité** — le composant ne mute rien. Il émet un événement et attend que le parent lui repasse un nouveau tableau `virements` avec l'état mis à jour. C'est la logique attendue en Angular signal / OnPush.

## 6. Template HTML

Le template s'appuie sur `p-table` de PrimeNG v22 avec un seul `pTemplate="body"` qui alterne entre lignes de subheader et lignes de données via le champ discriminant `ligne.type`. C'est le pattern documenté du showcase PrimeNG "Row Group" en mode `subheader`.

```html
<p-table
  [value]="lignes()"
  styleClass="virements-table"
  [tableStyle]="{ 'min-width': '100%' }"
>
  <ng-template pTemplate="header">
    <tr>
      <th>Destination</th>
      <th class="virements-table__col-amount">Montant</th>
      <th class="virements-table__col-status"></th>
    </tr>
  </ng-template>

  <ng-template pTemplate="body" let-ligne>
    <!-- SUBHEADER : bannière groupe -->
    <tr *ngIf="ligne.type === 'subheader'" class="virements-table__subheader">
      <td colspan="3">
        <div class="virements-table__subheader-inner">
          <p-avatar
            [label]="ligne.groupe.compteSource.proprietaires[0].initiale"
            shape="circle"
            [style]="{
              'background-color': ligne.groupe.compteSource.proprietaires[0].couleur,
              'color': '#fff'
            }"
            size="normal"
          />
          <div class="virements-table__subheader-text">
            <div class="virements-table__subheader-name">
              {{ ligne.groupe.compteSource.nom }}
              {{ ligne.groupe.compteSource.proprietaires[0].prenom }}
            </div>
            <div class="virements-table__subheader-count">
              {{ ligne.groupe.virements.length }}
              virement{{ ligne.groupe.virements.length > 1 ? 's' : '' }} sortant{{ ligne.groupe.virements.length > 1 ? 's' : '' }}
            </div>
          </div>
          <div class="virements-table__subheader-total">
            <div
              class="virements-table__subheader-total-value"
              [style.color]="ligne.groupe.compteSource.proprietaires[0].couleur"
            >
              {{ ligne.groupe.total | number:'1.0-0' }}
            </div>
            <div class="virements-table__subheader-total-label">à envoyer</div>
          </div>
        </div>
      </td>
    </tr>

    <!-- DATA : ligne de virement -->
    <tr *ngIf="ligne.type === 'data'" class="virements-table__row">
      <td class="virements-table__cell-dest">
        <div class="virements-table__dest">
          <p-avatarGroup>
            <p-avatar
              *ngFor="let m of ligne.virement.destination.proprietaires"
              [label]="m.initiale"
              shape="circle"
              size="normal"
              [style]="{ 'background-color': m.couleur, 'color': '#fff' }"
            />
          </p-avatarGroup>
          <div class="virements-table__dest-text">
            <div class="virements-table__dest-name">
              Vers {{ ligne.virement.destination.nom }}
            </div>
            <div class="virements-table__dest-context">
              <ng-container *ngIf="ligne.interMembres; else contexteNormal">
                <p-tag severity="secondary" styleClass="virements-table__tag-reimburse">
                  🔁 Remboursement
                </p-tag>
              </ng-container>
              <ng-template #contexteNormal>
                {{ ligne.virement.contexte }}
              </ng-template>
            </div>
          </div>
        </div>
      </td>
      <td
        class="virements-table__cell-amount"
        [style.color]="ligne.virement.source.proprietaires[0].couleur"
      >
        {{ ligne.virement.montant | number:'1.0-0' }}
      </td>
      <td class="virements-table__cell-status">
        <button
          type="button"
          class="virements-table__status-btn"
          [class.virements-table__status-btn--done]="ligne.virement.fait"
          [attr.aria-label]="ligne.virement.fait ? 'Marquer comme non fait' : 'Marquer comme fait'"
          [attr.aria-pressed]="ligne.virement.fait"
          (click)="onBasculerStatut(ligne.virement)"
        >
          <i class="pi pi-check" *ngIf="ligne.virement.fait"></i>
        </button>
      </td>
    </tr>
  </ng-template>
</p-table>
```

**À adapter selon les conventions du projet** :
- Si le projet utilise déjà `@if` / `@for` (control flow Angular 17+), remplacer `*ngIf` / `*ngFor` par la nouvelle syntaxe.
- Si un composant `Avatar` custom existe déjà pour représenter un membre, l'utiliser à la place de `p-avatar`.
- Le pipe `number:'1.0-0'` peut être remplacé par un pipe monétaire projet si présent.

## 7. Styles SCSS

Convention **BEM stricte**. Utiliser les CSS variables définies dans `src/app/dashboard/shared/tokens/` — ne rien redéfinir en dur.

```scss
:host {
  display: block;
}

.virements-table {
  border: 1px solid var(--p-surface-200);
  border-radius: var(--p-content-border-radius, 10px);
  overflow: hidden;

  // ─── Header de colonnes (thead) ───
  ::ng-deep .p-datatable-thead > tr > th {
    background: var(--p-surface-50);
    color: var(--p-surface-600);
    font-size: 0.625rem;         // 10px
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--p-surface-200);
  }

  &__col-amount { text-align: right; width: 5.625rem; }
  &__col-status { width: 2.5rem; }

  // ─── Ligne de subheader ───
  &__subheader td {
    padding: 0.625rem 0.75rem;
    background: var(--p-surface-100);
    border-top: 1px solid var(--p-surface-200);
    border-bottom: 1px solid var(--p-surface-200);
  }
  // La toute première subheader ne prend pas de border-top (elle touche le thead)
  &__subheader:first-of-type td { border-top: none; }

  &__subheader-inner {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  &__subheader-text {
    flex: 1;
    min-width: 0;
  }
  &__subheader-name {
    font-weight: 700;
    font-size: 0.78125rem;       // 12.5px
    line-height: 1.2;
  }
  &__subheader-count {
    font-size: 0.625rem;
    color: var(--p-surface-500);
    margin-top: 0.0625rem;
  }

  &__subheader-total { text-align: right; }
  &__subheader-total-value {
    font-size: 0.875rem;         // 14px
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  &__subheader-total-label {
    font-size: 0.5625rem;        // 9px
    color: var(--p-surface-500);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  // ─── Ligne de données ───
  &__row td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--p-surface-100);
    vertical-align: middle;
  }
  &__row:hover td { background: var(--p-surface-50); }

  // Indentation légère des lignes de données par rapport aux subheaders
  &__cell-dest { padding-left: 2.625rem !important; }

  &__dest { display: flex; align-items: center; gap: 0.5rem; }
  &__dest-name { font-weight: 700; font-size: 0.75rem; line-height: 1.2; }
  &__dest-context {
    font-size: 0.59375rem;       // 9.5px
    color: var(--p-surface-500);
    margin-top: 0.0625rem;
  }

  &__cell-amount {
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    font-size: 0.84375rem;       // 13.5px
    white-space: nowrap;
  }

  // ─── Bouton drapeau statut ───
  &__status-btn {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    border: 2px solid var(--p-surface-200);
    background: var(--p-surface-0);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: transparent;
    cursor: pointer;
    transition: all 0.15s;

    &:hover { border-color: var(--p-surface-400); }
    &:focus-visible { outline: 2px solid var(--p-primary-color); outline-offset: 2px; }

    &--done {
      background: var(--p-success);
      border-color: var(--p-success);
      color: #fff;
    }
    i { font-size: 0.75rem; }
  }

  // ─── Badge remboursement ───
  &__tag-reimburse {
    background: var(--violet-tint, #ECE7FB) !important;
    color: var(--violet, #7B4FE0) !important;
    font-size: 0.59375rem;
    font-weight: 700;
    padding: 0.125rem 0.4375rem;
    border-radius: 999px;
  }
}
```

Si `--violet-tint` et `--violet` ne sont pas définis dans les tokens actuels, les ajouter à `shared/tokens/_colors.scss` (ou équivalent) :

```scss
:root {
  --violet: #7B4FE0;
  --violet-tint: #ECE7FB;
}
```

## 8. Modules PrimeNG à importer

Dans le composant standalone :

```typescript
import { TableModule } from 'primeng/table';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
```

Vérifier dans `package.json` que la version installée est bien `primeng@^22`. Si le projet est encore sur une version antérieure, les imports restent identiques mais certains attributs de style peuvent différer légèrement — signaler à l'IA de vérifier la doc de la version installée.

## 9. Intégration : remplacer l'ancien composant flux des comptes

1. **Localiser l'ancien composant** — probablement quelque chose comme `flux-comptes.component.ts` ou `matrice-comptes.component.ts` dans `src/app/dashboard/shared/components/` ou `src/app/dashboard/monthly/`.

2. **Repérer tous les usages** de son sélecteur dans les templates : recherche globale sur `<app-flux-comptes` ou l'équivalent.

3. **Adapter le service qui fournit les données** — si l'ancien composant recevait une matrice `Compte[][]`, il faudra maintenant un `Virement[]` plat. Le service doit exposer :

   ```typescript
   readonly virementsDuMois = signal<readonly Virement[]>([]);

   basculerVirement(virementId: string, fait: boolean): void {
     this.virementsDuMois.update(list =>
       list.map(v => v.id === virementId ? { ...v, fait } : v)
     );
     // + persistance si nécessaire (localStorage, backend, etc.)
   }
   ```

4. **Remplacer dans le template parent** :

   ```html
   <!-- Avant -->
   <app-flux-comptes [matrice]="matrice()" />

   <!-- Après -->
   <app-table-virements-comptes
     [virements]="service.virementsDuMois()"
     (virementBascule)="service.basculerVirement($event.virementId, $event.fait)"
   />
   ```

5. **Supprimer l'ancien composant** (fichiers, tests, exports du barrel `index.ts`) une fois que plus aucune référence ne subsiste.

## 10. Points d'attention pendant l'implémentation

- **Ne pas dupliquer les données dans le composant.** Le tableau `virements()` reçu en input est la seule source. Les computed `groupes` et `lignes` en dérivent.
- **La détection de virement inter-membres** utilise l'intersection des propriétaires — implémenter `estInterMembres` exactement comme dans la spec pour couvrir le cas où un compte a plusieurs propriétaires côté source ET côté destination (ex. deux comptes partagés).
- **Ordre stable des groupes.** L'ordre naturel des `virements()` détermine l'ordre des groupes — le service doit trier en amont (par exemple : compte perso avant compte joint, ou ordre de création). Ne pas trier dans le composant.
- **Accessibilité** — le bouton drapeau porte `aria-label` et `aria-pressed`. Un lecteur d'écran doit annoncer "Marquer comme fait" ou "Marquer comme non fait".
- **Nombre singulier / pluriel** — "1 virement sortant" vs "3 virements sortants". Ne pas oublier le pluriel.
- **Séparateur de milliers cohérent avec le reste du projet** — si le projet utilise un locale `fr-CH` global, les nombres s'afficheront naturellement avec un espace (`1 300`). Sinon, adapter le pipe.

## 11. Critères d'acceptation

Le composant est considéré comme terminé quand :

- [ ] Aucun `console.error` / `console.warn` au chargement.
- [ ] Les subheaders regroupent bien tous les virements du même compte source, sans en oublier ni en dupliquer.
- [ ] Le total affiché dans un subheader égale la somme des montants des virements sous ce subheader.
- [ ] Cliquer sur le drapeau d'une ligne bascule son état visuel et émet l'événement `virementBascule` avec l'id et le nouvel état correct.
- [ ] Un virement où la source et la destination n'ont **aucun** propriétaire commun affiche le badge violet 🔁 Remboursement, et **seulement** dans ce cas.
- [ ] Les avatars des propriétaires apparaissent en groupe superposé pour les comptes joints, seul pour les comptes personnels.
- [ ] Le composant est utilisable **sans modification** dans le dashboard mensuel et dans un drawer d'indicateur — vérifier au moins un cas de chaque.
- [ ] Le rendu reste lisible entre 360px et 768px de largeur (mobile → tablette portrait).
- [ ] Aucune ligne n'a de style en dur qui contredit les tokens de design system.

## 12. Extensions possibles (hors périmètre initial)

Ne pas implémenter tout de suite, mais garder ces extensions en tête pour ne pas peindre le composant dans un coin :

- **Tri natif p-table** — activer `[sortMode]="'single'"` sur les colonnes numériques pour trier par montant décroissant si l'utilisateur veut prioriser.
- **Bouton "Tout marquer comme fait" par subheader** — pertinent quand la banque de l'utilisateur permet un virement multiple depuis un seul compte.
- **Édition inline du montant** — utile si les virements ne sont pas calculés mais saisis par l'utilisateur.
- **Compteur global "N/M virements faits"** en pied de composant.

Ces extensions sont additives : la structure des subheaders + lignes de données reste valable telle quelle.

---

## Résumé pour l'IA de code

> Créer un composant Angular standalone `TableVirementsComptesComponent` dans `src/app/dashboard/shared/components/table-virements-comptes/`, qui prend en entrée un `readonly Virement[]` et affiche une **`p-table` PrimeNG v22 groupée par compte source** via un pattern `subheader inline` (une bannière par source avec avatar, nom, nombre de virements et total, puis les lignes de destination dessous). Chaque ligne se lit comme une phrase directionnelle, chaque virement porte un bouton drapeau binaire (fait / pas fait) qui émet un événement, et les virements inter-membres (aucun propriétaire commun entre source et destination) sont marqués d'un badge violet 🔁. Le composant remplace l'ancien flux des comptes et est utilisable tel quel dans le dashboard mensuel et dans un drawer d'indicateur.