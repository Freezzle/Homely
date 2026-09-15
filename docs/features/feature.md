# Contrat — `hom-echeancier-annuel`

Représente **une année d'un poste** sur une bande allongée qui tient dans une ligne de tableau :
une réglette de douze chiffres pour les mois, des capsules pour les cycles de périodicité,
des perles pour les échéances datées, des embouts colorés pour les bornes de validité.

Le composant ne connaît **aucun montant**. Il ne dit pas *combien*, il dit *quand* : quels mois
sont imputés au budget, quels mois portent une échéance, où le poste commence et s'arrête.
Toute question de montant relève d'une autre colonne.

Ce document est le contrat : il fixe l'API, les règles de calcul et la signification de chaque
signe visuel. L'implémentation de référence suit, mais c'est la section « Règles normatives »
qui fait foi — c'est elle que les tests vérifient.

> Convention : les mois sont numérotés de 1 à 12. Les index de tableau restent en base 0,
> les champs publics exposent des **numéros de mois**, jamais des index.

---

## 1. Périmètre

Le composant est **purement présentationnel** : il ne charge rien, n'émet rien, ne stocke rien.
Il reçoit un poste et une année, il dessine. Toute la logique vient de `echeancier.util.ts`,
qui ne dépend pas d'Angular.

Hors périmètre : les montants, la ligne de tableau qui l'entoure, le tiroir de détail,
la sélection, l'affichage multi-années.

---

## 2. Contrat public

### Entrées

| Input | Type | Défaut | Rôle |
|---|---|---|---|
| `poste` | `PosteEcheancier` | **requis** | Le poste à représenter |
| `annee` | `number` | **requis** | L'année civile affichée |
| `largeur` | `number` (px) | `168` | Largeur du dessin |
| `hauteur` | `number` (px) | `26` | Hauteur du dessin |
| `groupe` | `2 \| 3 \| 4 \| 6 \| null` | `3` | Met en gras un chiffre tous les N mois. `null` désactive |
| `intensiteBulle` | `'discrete' \| 'accentuee' \| 'forte'` | `'accentuee'` | Densité de remplissage des capsules |
| `marqueurs` | `boolean` | `true` | Affiche les embouts de validité et le cerclage du ponctuel |

### Sorties

Aucune. Si la ligne parente doit réagir au clic, elle pose son propre gestionnaire autour du composant.

### Contraintes d'usage

- `hauteur` **doit** valoir au moins 22 px : en dessous, les chiffres passent sous 5 px et deviennent illisibles.
- `largeur` **doit** valoir au moins 132 px, soit 11 px par mois.
- Le composant ne se redimensionne pas tout seul ; il rend un SVG à taille fixe. Le parent décide.

```html
<hom-echeancier-annuel [poste]="poste" [annee]="2026" />
<hom-echeancier-annuel [poste]="poste" [annee]="annee()" [largeur]="204" [groupe]="4" />
```

---

## 3. Types

```ts
// echeancier.model.ts

export type ModeImputation = 'MENSUALISE' | 'PERIODIQUE';
export type MomentImputation = 'DEBUT_PERIODE' | 'FIN_PERIODE' | 'INCONNU';

/**
 * Sous-ensemble de Poste strictement nécessaire au dessin.
 * Aucun montant : le composant décrit un rythme, pas une somme.
 */
export interface PosteEcheancier {
  /** Périodicité en mois. 0 = ponctuel, 1 = mensuel, 12 = annuel. */
  readonly periodicite: number;
  readonly mode: ModeImputation;
  readonly moment: MomentImputation;
  /** ISO `yyyy-MM-dd`. Pour un ponctuel, c'est la date de référence. */
  readonly debut: string;
  /** ISO `yyyy-MM-dd`. Ignorée quand `periodicite === 0` (voir R4). */
  readonly fin: string | null;
}

export type Groupe = 2 | 3 | 4 | 6 | null;
export type IntensiteBulle = 'discrete' | 'accentuee' | 'forte';

/** Ce que dit la couleur du chiffre. */
export type EtatMois =
  | 'impute'         // ambre — le budget impute quelque chose ce mois-là
  | 'actif'          // gris moyen — dans la fenêtre de validité, mais rien d'imputé
  | 'hors-validite'; // gris pâle — avant le début, après la fin, ou hors du point de référence

/** Un seul repère par mois, jamais cumulé. */
export type Repere = 'debut' | 'fin' | 'ponctuel' | null;

export interface MoisVue {
  readonly mois: number;        // 1..12
  readonly etat: EtatMois;
  readonly repere: Repere;
  readonly gras: boolean;       // purement typographique
  /** Le budget impute-t-il quelque chose ce mois ? */
  readonly impute: boolean;
  /** Une échéance datée tombe-t-elle ce mois ? Toujours faux si le moment est inconnu. */
  readonly echeance: boolean;
}

/** Pourquoi un bord de capsule est coupé. `null` = le cycle commence ou finit vraiment là. */
export type Coupe = null | 'annee' | 'validite';

/**
 * Une capsule couvre un cycle de périodicité, ou le fragment d'un cycle
 * visible dans l'année affichée.
 */
export interface CapsuleVue {
  readonly du: number;          // premier mois visible, 1..12
  readonly au: number;          // dernier mois visible, 1..12
  /** Bord gauche : arrondi si le cycle démarre là, droit s'il est coupé. */
  readonly capDu: 'arrondi' | 'droit';
  readonly capAu: 'arrondi' | 'droit';
  readonly coupeDu: Coupe;
  readonly coupeAu: Coupe;
  readonly style: 'pleine' | 'pointillee';
  readonly raison: 'provision' | 'imputation-pleine' | 'moment-inconnu';
}

export interface PerleVue {
  readonly mois: number;
  readonly forme: 'perle' | 'losange';
}

export interface EcheancierVue {
  readonly mois: readonly MoisVue[];      // toujours 12 éléments
  readonly capsules: readonly CapsuleVue[];
  readonly perles: readonly PerleVue[];
  readonly debutMois: number | null;      // mois du début si dans l'année
  readonly finMois: number | null;        // mois de la fin si dans l'année
}
```

---

## 4. Règles normatives

Chaque règle porte un identifiant repris par les tests.

### R1 — Douze mois, toujours

`vue.mois.length === 12` quel que soit le poste, y compris s'il est inactif toute l'année.
La réglette est un repère de lecture : la quatrième position est avril sur toutes les lignes,
sinon la comparaison entre lignes devient impossible.

### R2 — Trois états de chiffre, et trois seulement

- `impute` si le budget impute quelque chose ce mois-là
- `hors-validite` si le mois est hors de la fenêtre de validité
- `actif` sinon

L'état `actif` n'est pas décoratif : c'est le seul moyen de distinguer *« mois couvert par le
poste mais sans imputation »* de *« mois hors du poste »*. Sans montant, cet état devient
d'autant plus important : c'est la seule chose qui signale un mois vide **à l'intérieur** de la
fenêtre. Il est produit par l'imputation pleine, où seuls les mois d'échéance sont imputés.

### R3 — Fenêtre de validité

Un mois est actif s'il est compris entre `debut` et `fin` inclus, `fin` nulle valant « ouvert ».
Hors de cette fenêtre : `impute === false && echeance === false`, aucune capsule, aucune perle.

### R4 — Le ponctuel : une date de référence, pas une fenêtre

Quand `periodicite === 0` :

- seule `debut` est prise en compte ; `fin` est **ignorée**, quelle que soit sa valeur
- la fenêtre de validité se réduit au **seul mois de référence** : les onze autres mois de
  l'année sont `hors-validite`
- ce mois porte `impute === true` et `echeance === true`
- aucune capsule n'est produite : un one-shot n'a pas de cycle
- `debutMois` et `finMois` valent `null` — un ponctuel n'ouvre ni ne ferme de période, son
  unique repère est `repere === 'ponctuel'`, rendu par le cerclage anthracite du losange

Si l'année affichée n'est pas celle de la référence, le poste est entièrement `hors-validite`.

### R5 — Imputation et échéance

Pour chaque mois de la fenêtre de validité :

| Configuration | `impute` | `echeance` |
|---|---|---|
| `periodicite = 0`, mois de référence | oui | oui |
| `periodicite = 1` | oui | oui |
| `periodicite > 1`, `MENSUALISE`, moment daté | **tous** les mois | sur les occurrences |
| `periodicite > 1`, `PERIODIQUE`, moment daté | sur les occurrences | sur les occurrences |
| `moment = INCONNU` | tous les mois | **jamais** |

Les occurrences se calculent depuis le mois d'ancrage, celui de `debut` :
`DEBUT_PERIODE` → `(mois - ancre) mod D === 0`, `FIN_PERIODE` → `(mois - ancre + 1) mod D === 0`.

Le moment inconnu ne produit jamais d'échéance : le montant est réparti par convention, il
n'existe aucune date à pointer. C'est ce qui garantit R6.

### R6 — Perles

Une perle par mois où `echeance === true`, et rien d'autre.

- forme `losange` si `periodicite === 0`, forme `perle` sinon
- `moment === 'INCONNU'` → aucune perle, par application directe de R5

### R7 — Cycles, énumérés en mois absolus

Un cycle couvre l'intervalle `[debut + k·D, debut + (k+1)·D − 1]` en mois absolus, pour tout
entier `k ≥ 0`. **Cet intervalle ne dépend pas du moment** : `DEBUT_PERIODE` et `FIN_PERIODE`
découpent les mêmes cycles, seule la position de la perle change — au premier mois du cycle
dans un cas, au dernier dans l'autre.

Le composant émet une capsule pour **chaque cycle qui intersecte l'année affichée**, et non
seulement pour ceux dont l'échéance y tombe. Un trimestriel ancré en février produit donc cinq
capsules en 2026 : le fragment de janvier, queue du cycle ouvert en novembre précédent, puis les
quatre cycles de l'année dont le dernier déborde sur 2027.

Chaque capsule est ensuite écrêtée par l'année civile **et** par la fenêtre de validité.
Corollaire vérifiable : tout mois `impute` est couvert par au moins une capsule.

`moment = INCONNU` fait exception : une capsule unique couvre la fenêtre de validité intersectée
avec l'année, puisqu'il n'y a pas de cycle daté à découper.

### R8 — Bords : arrondi si réel, droit si coupé

Pour chaque extrémité de capsule :

- **arrondi** quand le cycle commence ou finit vraiment là
- **droit** quand le dessin est coupé — que la coupe vienne du 1ᵉʳ janvier, du 31 décembre,
  ou d'une borne de validité

`coupeDu` et `coupeAu` précisent la cause : `'annee'`, `'validite'`, ou `null` si le bord est réel.

Propriété du modèle : `coupeDu` ne peut jamais valoir `'validite'`. Les cycles étant ancrés sur
`debut`, aucun cycle ne commence avant le début du poste ; seule l'année civile peut couper à
gauche. La borne de validité, elle, coupe à droite dès qu'une clôture tombe en cours de cycle.

Le bord droit répond à une ambiguïté réelle : sans lui, un cycle interrompu et un cycle complet
se ressemblaient. Il reste une ambiguïté résiduelle entre une coupe par décembre et une coupe
par la fin de validité — les deux produisent un bord droit, et c'est l'embout rouge qui tranche.

### R9 — Style de capsule

| Configuration | style | raison |
|---|---|---|
| `MENSUALISE`, moment daté | `pleine` | `provision` |
| `PERIODIQUE` | `pointillee` | `imputation-pleine` |
| `moment = INCONNU` | `pointillee` | `moment-inconnu` |

Le pointillé dit dans les deux cas « il n'y a pas de provision étalée à représenter », mais pour
des raisons différentes : le champ `raison` permet de les distinguer plus tard sans casser le contrat.

### R10 — Gras typographique

`gras === true` quand `groupe !== null && (mois - 1) % groupe === 0`.
C'est une aide de lecture, sans aucune signification métier : régler `groupe` à `null` ne doit
rien changer à l'information transmise.

---

## 5. Sémantique visuelle

| Signe | Signification |
|---|---|
| Chiffre ambre | Mois où le budget impute |
| Chiffre gris moyen | Mois dans la fenêtre de validité, sans imputation |
| Chiffre gris pâle | Mois hors de la fenêtre de validité |
| Chiffre en gras | Premier mois d'un groupe — aide de lecture uniquement |
| Capsule pleine | Cycle de périodicité, avec provision étalée |
| Capsule pointillée | Cycle sans provision, ou imputation répartie sans date connue |
| Bord de capsule arrondi | Le cycle commence ou finit vraiment ici |
| Bord de capsule droit | Le cycle est coupé : il continue au-delà, ou il a été interrompu |
| Perle ronde | Échéance datée |
| Losange cerclé d'anthracite | Point de référence d'un poste ponctuel |
| Embout vert | Début de validité |
| Embout rouge | Fin de validité |

Aucun signe n'est redondant : retirer l'un d'eux supprime une information que les autres ne portent pas.

---

## 6. Implémentation de référence

### 6.1 Calcul

```ts
// echeancier.util.ts
import {
  CapsuleVue, Coupe, EcheancierVue, EtatMois, Groupe, MoisVue,
  PerleVue, PosteEcheancier, Repere,
} from './echeancier.model';

interface Ym { readonly annee: number; readonly mois: number; }

const ym = (iso: string): Ym => ({ annee: +iso.slice(0, 4), mois: +iso.slice(5, 7) });
/** Mois absolu : douze par an, base 0 sur janvier. */
const abs = (v: Ym): number => v.annee * 12 + (v.mois - 1);
const modulo = (a: number, n: number): number => ((a % n) + n) % n;

/** R3 + R4 — fenêtre de validité. Un ponctuel se réduit à son mois de référence. */
export function estActif(p: PosteEcheancier, annee: number, mois: number): boolean {
  const d = ym(p.debut);
  if (p.periodicite === 0) return annee === d.annee && mois === d.mois;

  const f = p.fin ? ym(p.fin) : null;
  const apres = annee > d.annee || (annee === d.annee && mois >= d.mois);
  const avant = !f || annee < f.annee || (annee === f.annee && mois <= f.mois);
  return apres && avant;
}

function estOccurrence(p: PosteEcheancier, mois: number): boolean {
  const ancre = ym(p.debut).mois;
  return p.moment === 'FIN_PERIODE'
    ? modulo(mois - ancre + 1, p.periodicite) === 0
    : modulo(mois - ancre, p.periodicite) === 0;
}

/** R5 — le budget impute-t-il, une échéance tombe-t-elle, mois par mois. */
export function imputations(
  p: PosteEcheancier, annee: number,
): { impute: boolean[]; echeance: boolean[] } {
  const impute: boolean[] = [];
  const echeance: boolean[] = [];

  for (let mois = 1; mois <= 12; mois++) {
    if (!estActif(p, annee, mois)) { impute.push(false); echeance.push(false); continue; }
    if (p.periodicite === 0 || p.periodicite === 1) { impute.push(true); echeance.push(true); continue; }
    if (p.moment === 'INCONNU') { impute.push(true); echeance.push(false); continue; }

    const occurrence = estOccurrence(p, mois);
    impute.push(p.mode === 'PERIODIQUE' ? occurrence : true);
    echeance.push(occurrence);
  }
  return { impute, echeance };
}

function etat(impute: boolean, actif: boolean): EtatMois {
  if (!actif) return 'hors-validite';
  return impute ? 'impute' : 'actif';
}

/** R4 + R8 — un seul repère par mois, jamais cumulé. */
function repere(p: PosteEcheancier, annee: number, mois: number): Repere {
  const d = ym(p.debut);
  const surDebut = annee === d.annee && mois === d.mois;
  if (p.periodicite === 0) return surDebut ? 'ponctuel' : null;
  if (surDebut) return 'debut';
  const f = p.fin ? ym(p.fin) : null;
  if (f && annee === f.annee && mois === f.mois) return 'fin';
  return null;
}

function styleCapsule(p: PosteEcheancier): Pick<CapsuleVue, 'style' | 'raison'> {
  if (p.moment === 'INCONNU') return { style: 'pointillee', raison: 'moment-inconnu' };
  if (p.mode === 'PERIODIQUE') return { style: 'pointillee', raison: 'imputation-pleine' };
  return { style: 'pleine', raison: 'provision' };
}

/**
 * R7 + R8 — les cycles qui traversent l'année, écrêtés, avec leurs bords.
 * Travailler en mois absolus permet de dessiner le fragment d'un cycle ouvert
 * l'année précédente : sans lui, ses mois seraient imputés sans capsule.
 */
export function cycles(p: PosteEcheancier, annee: number): CapsuleVue[] {
  if (p.periodicite === 0) return [];

  const debutAbs = abs(ym(p.debut));
  const finAbs = p.fin ? abs(ym(p.fin)) : Number.POSITIVE_INFINITY;
  const anneeDu = annee * 12;
  const anneeAu = annee * 12 + 11;

  const bas = Math.max(debutAbs, anneeDu);
  const haut = Math.min(finAbs, anneeAu);
  if (haut < bas) return [];

  const style = styleCapsule(p);
  const fabrique = (naturelDu: number, naturelAu: number): CapsuleVue | null => {
    const du = Math.max(naturelDu, anneeDu, debutAbs);
    const au = Math.min(naturelAu, anneeAu, finAbs);
    if (au < du) return null;
    const coupeDu: Coupe = du === naturelDu ? null : 'annee';
    const coupeAu: Coupe = au === naturelAu ? null : (au === finAbs ? 'validite' : 'annee');
    return {
      du: du - anneeDu + 1,
      au: au - anneeDu + 1,
      capDu: coupeDu === null ? 'arrondi' : 'droit',
      capAu: coupeAu === null ? 'arrondi' : 'droit',
      coupeDu, coupeAu, ...style,
    };
  };

  // Moment inconnu : pas de cycle daté, une seule capsule sur la fenêtre.
  if (p.moment === 'INCONNU') {
    const c = fabrique(debutAbs, finAbs);
    return c ? [c] : [];
  }

  const out: CapsuleVue[] = [];
  const premier = Math.floor((bas - debutAbs) / p.periodicite);
  const dernier = Math.floor((haut - debutAbs) / p.periodicite);
  for (let k = premier; k <= dernier; k++) {
    const c = fabrique(debutAbs + k * p.periodicite, debutAbs + (k + 1) * p.periodicite - 1);
    if (c) out.push(c);
  }
  return out;
}

/** R6 — perles réellement dessinées. */
function perles(p: PosteEcheancier, echeance: boolean[]): PerleVue[] {
  const forme = p.periodicite === 0 ? 'losange' : 'perle';
  return echeance
    .map((e, i) => (e ? { mois: i + 1, forme } as PerleVue : null))
    .filter((x): x is PerleVue => x !== null);
}

/** Point d'entrée unique : tout le dessin dérive de cette structure. */
export function vueEcheancier(
  p: PosteEcheancier, annee: number, groupe: Groupe = 3,
): EcheancierVue {
  const { impute, echeance } = imputations(p, annee);

  const mois: MoisVue[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      mois: m,
      etat: etat(impute[i], estActif(p, annee, m)),
      repere: repere(p, annee, m),
      gras: groupe !== null && (m - 1) % groupe === 0,
      impute: impute[i],
      echeance: echeance[i],
    };
  });

  const d = ym(p.debut);
  const f = p.fin ? ym(p.fin) : null;
  const ponctuel = p.periodicite === 0;

  return {
    mois,
    capsules: cycles(p, annee),
    perles: perles(p, echeance),
    debutMois: !ponctuel && d.annee === annee ? d.mois : null,
    finMois: !ponctuel && f && f.annee === annee ? f.mois : null,
  };
}
```

### 6.2 Composant

Les capsules deviennent des `<path>` plutôt que des `<rect>` : un `rx` s'applique aux quatre
coins, alors qu'il faut ici arrondir chaque extrémité indépendamment.

```ts
// echeancier-annuel.component.ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CapsuleVue, Groupe, IntensiteBulle, MoisVue, PosteEcheancier } from './echeancier.model';
import { vueEcheancier } from './echeancier.util';

const REMPLISSAGE: Record<IntensiteBulle, number> = {
  discrete: 0.22, accentuee: 0.32, forte: 0.44,
};
const NOMS_MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
] as const;

@Component({
  selector: 'hom-echeancier-annuel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'hom-echeancier-annuel' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + largeur() + ' ' + hauteur()"
         [attr.width]="largeur()" [attr.height]="hauteur()"
         role="img" [attr.aria-label]="ariaLabel()">

      @for (c of vue().capsules; track $index) {
        <path class="capsule" [class.pointillee]="c.style === 'pointillee'"
              [attr.d]="chemin(c)"
              [attr.fill-opacity]="c.style === 'pleine' ? remplissage() : remplissage() * 0.55" />
      }

      @for (p of vue().perles; track p.mois) {
        @if (p.forme === 'perle') {
          <circle class="perle" [attr.cx]="centre(p.mois)" [attr.cy]="g().milieu" [attr.r]="g().rayon" />
        } @else {
          <polygon class="losange" [class.cerclee]="marqueurs()" [attr.points]="losange(p.mois)" />
        }
      }

      @for (m of vue().mois; track m.mois) {
        <text class="mois" [class]="'etat-' + m.etat" [class.gras]="m.gras"
              [attr.x]="centre(m.mois)" [attr.y]="g().baseline"
              [attr.font-size]="g().taillePolice" text-anchor="middle">{{ m.mois }}
          <title>{{ infobulle(m) }}</title>
        </text>
      }

      @if (marqueurs() && vue().debutMois !== null) {
        <line class="embout debut"
              [attr.x1]="bordGauche(vue().debutMois!)" [attr.x2]="bordGauche(vue().debutMois!)"
              [attr.y1]="g().hautEmbout" [attr.y2]="g().basEmbout" />
      }
      @if (marqueurs() && vue().finMois !== null) {
        <line class="embout fin"
              [attr.x1]="bordDroit(vue().finMois!)" [attr.x2]="bordDroit(vue().finMois!)"
              [attr.y1]="g().hautEmbout" [attr.y2]="g().basEmbout" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
      --hom-echeance: var(--p-amber-500, #f59e0b);
      --hom-inactif: var(--p-surface-300, #cbd5e1);
      --hom-debut: var(--p-green-500, #22c55e);
      --hom-fin: var(--p-red-500, #ef4444);
      --hom-ponctuel: var(--p-surface-700, #3f3f46);
    }
    svg { display: block; overflow: visible; }

    .capsule { fill: var(--hom-echeance); stroke: var(--hom-echeance); stroke-width: .9; stroke-opacity: .5; }
    .capsule.pointillee { stroke-dasharray: 2.5 2; stroke-opacity: .6; }

    .perle { fill: var(--hom-echeance); }
    .losange { fill: var(--hom-echeance); }
    .losange.cerclee { stroke: var(--hom-ponctuel); stroke-width: 1.4; }

    .mois {
      font-family: inherit;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
      fill: var(--p-text-muted-color, #64748b);
    }
    .mois.gras { font-weight: 700; }
    .etat-impute { fill: var(--hom-echeance); font-weight: 600; }
    .etat-impute.gras { font-weight: 700; }
    .etat-hors-validite { fill: var(--hom-inactif); opacity: .6; }

    .embout { stroke-width: 2.2; stroke-linecap: round; }
    .embout.debut { stroke: var(--hom-debut); }
    .embout.fin { stroke: var(--hom-fin); }
  `,
})
export class EcheancierAnnuelComponent {
  readonly poste = input.required<PosteEcheancier>();
  readonly annee = input.required<number>();
  readonly largeur = input<number>(168);
  readonly hauteur = input<number>(26);
  readonly groupe = input<Groupe>(3);
  readonly intensiteBulle = input<IntensiteBulle>('accentuee');
  readonly marqueurs = input<boolean>(true);

  protected readonly vue = computed(() => vueEcheancier(this.poste(), this.annee(), this.groupe()));
  protected readonly remplissage = computed(() => REMPLISSAGE[this.intensiteBulle()]);

  /** Géométrie dérivée : la réglette occupe le tiers bas, les capsules le reste. */
  protected readonly g = computed(() => {
    const w = this.largeur(), h = this.hauteur(), bord = 3;
    const pas = (w - 2 * bord) / 12;
    const hauteurReglette = Math.min(7.6, h * 0.34);
    const hautReglette = h - hauteurReglette - 0.6;
    const milieu = (hautReglette - 1) / 2 + 0.5;
    const hauteurCapsule = Math.min(hautReglette - 5, 9.5);
    const taillePolice = Math.min(hauteurReglette * 0.98, pas * 0.86);
    return {
      bord, pas, milieu, hauteurCapsule, taillePolice,
      baseline: hautReglette + taillePolice * 0.86,
      rayon: Math.min(3.4, pas * 0.44),
      hautEmbout: milieu - hauteurCapsule / 2 - 2,
      basEmbout: hautReglette + hauteurReglette,
    };
  });

  protected centre = (mois: number): number => this.g().bord + (mois - 1) * this.g().pas + this.g().pas / 2;
  protected bordGauche = (mois: number): number => this.g().bord + (mois - 1) * this.g().pas;
  protected bordDroit = (mois: number): number => this.g().bord + mois * this.g().pas;

  /** R8 — chaque extrémité est arrondie ou droite indépendamment de l'autre. */
  protected chemin(c: CapsuleVue): string {
    const { milieu, hauteurCapsule: hc } = this.g();
    const x1 = this.bordGauche(c.du), x2 = this.bordDroit(c.au);
    const y = milieu - hc / 2, r = hc / 2;
    const gl = c.capDu === 'arrondi' ? r : 0;
    const dr = c.capAu === 'arrondi' ? r : 0;
    return [
      `M${x1 + gl},${y}`,
      `H${x2 - dr}`,
      dr ? `A${r},${r} 0 0 1 ${x2 - dr},${y + hc}` : `V${y + hc}`,
      `H${x1 + gl}`,
      gl ? `A${r},${r} 0 0 1 ${x1 + gl},${y}` : `V${y}`,
      'Z',
    ].join(' ');
  }

  protected losange(mois: number): string {
    const cx = this.centre(mois), cy = this.g().milieu, z = this.g().hauteurCapsule / 2 + 0.8;
    return `${cx},${cy - z} ${cx + z},${cy} ${cx},${cy + z} ${cx - z},${cy}`;
  }

  /** Sans montant, l'infobulle décrit un statut, pas une somme. */
  protected infobulle(m: MoisVue): string {
    const lignes: string[] = [`${NOMS_MOIS[m.mois - 1]} ${this.annee()}`];
    if (m.repere === 'ponctuel') { lignes.push('Échéance unique — date de référence'); return lignes.join('\n'); }
    if (m.etat === 'hors-validite') { lignes.push('Hors fenêtre de validité'); return lignes.join('\n'); }
    lignes.push(m.echeance ? 'Échéance datée' : m.impute ? 'Imputé au budget, sans échéance' : 'Aucune imputation');
    if (m.repere === 'debut') lignes.push('Début de validité');
    if (m.repere === 'fin') lignes.push('Fin de validité');
    return lignes.join('\n');
  }

  protected readonly ariaLabel = computed(() => {
    const v = this.vue();
    const actifs = v.mois.filter((m) => m.etat !== 'hors-validite').length;
    if (actifs === 0) return `Poste inactif en ${this.annee()}.`;
    const n = v.perles.length;
    return n === 0
      ? `${this.annee()} : imputé sur ${actifs} mois, aucune échéance datée.`
      : `${this.annee()} : ${n} échéance${n > 1 ? 's' : ''}, mois ${v.perles.map((p) => p.mois).join(', ')}.`;
  });
}
```

---

## 7. Accessibilité

- Le `<svg>` porte `role="img"` et un `aria-label` qui résume l'année en une phrase : nombre
  d'échéances et mois concernés, ou l'absence d'échéance datée. Un lecteur d'écran n'a jamais
  à parcourir douze chiffres.
- Chaque chiffre porte un `<title>` natif, donc une infobulle au survol sans JavaScript.
- Aucune information n'est portée par la couleur seule : la position dans la réglette, la forme
  de la perle, la forme des bords de capsule et la présence des embouts restent lisibles en
  niveaux de gris. Le seul point faible connu est la distinction ambre / gris moyen, qui repose
  sur la teinte ; l'infobulle la lève.

---

## 8. Tests de conformité

```ts
// echeancier.util.spec.ts
import { cycles, imputations, vueEcheancier } from './echeancier.util';
import { PosteEcheancier } from './echeancier.model';

const poste = (o: Partial<PosteEcheancier>): PosteEcheancier => ({
  periodicite: 1, mode: 'MENSUALISE', moment: 'DEBUT_PERIODE',
  debut: '2022-01-01', fin: null, ...o,
});
const etats = (p: PosteEcheancier, a = 2026) => vueEcheancier(p, a).mois.map((m) => m.etat);
const bornes = (p: PosteEcheancier, a = 2026) =>
  cycles(p, a).map((c) => [c.du, c.au, c.capDu[0], c.capAu[0]].join(''));

describe('R1 — douze mois toujours', () => {
  it('même pour un poste inactif toute l’année', () => {
    const v = vueEcheancier(poste({ fin: '2025-11-30' }), 2026);
    expect(v.mois).toHaveLength(12);
    expect(v.mois.every((m) => m.etat === 'hors-validite')).toBe(true);
  });
});

describe('R2 — trois états, et le gris moyen n’est pas décoratif', () => {
  it('imputation pleine : onze mois actifs sans imputation', () => {
    const p = poste({ periodicite: 12, mode: 'PERIODIQUE', debut: '2021-11-01' });
    const e = etats(p);
    expect(e.filter((x) => x === 'impute')).toHaveLength(1);
    expect(e.filter((x) => x === 'actif')).toHaveLength(11);
  });
});

describe('R3 — rien hors de la fenêtre', () => {
  it('après la date de fin, ni imputation ni échéance', () => {
    const v = vueEcheancier(poste({ fin: '2026-07-31' }), 2026);
    expect(v.mois.slice(7).every((m) => !m.impute && !m.echeance)).toBe(true);
  });
});

describe('R4 — le ponctuel est un point de référence', () => {
  const ponctuel = poste({ periodicite: 0, debut: '2026-04-01' });

  it('un seul mois actif, aucune capsule, un losange', () => {
    const v = vueEcheancier(ponctuel, 2026);
    expect(etats(ponctuel).filter((x) => x === 'hors-validite')).toHaveLength(11);
    expect(v.capsules).toHaveLength(0);
    expect(v.perles).toEqual([{ mois: 4, forme: 'losange' }]);
    expect([v.debutMois, v.finMois]).toEqual([null, null]);
  });

  it('la date de fin est ignorée', () => {
    expect(etats(poste({ periodicite: 0, debut: '2026-04-01', fin: '2026-01-31' })))
      .toEqual(etats(ponctuel));
  });
});

describe('R5 — imputation et échéance', () => {
  it('mensualisé : imputé partout, échéance sur les occurrences', () => {
    const { impute, echeance } = imputations(poste({ periodicite: 3, debut: '2023-02-01' }), 2026);
    expect(impute.every(Boolean)).toBe(true);
    expect(echeance.map((e, i) => (e ? i + 1 : 0)).filter(Boolean)).toEqual([2, 5, 8, 11]);
  });

  it('moment inconnu : imputé partout, jamais d’échéance', () => {
    const { impute, echeance } = imputations(poste({ periodicite: 12, moment: 'INCONNU' }), 2026);
    expect(impute.every(Boolean)).toBe(true);
    expect(echeance.some(Boolean)).toBe(false);
  });
});

describe('R6 — perles', () => {
  it('aucune perle quand le moment est inconnu', () => {
    expect(vueEcheancier(poste({ periodicite: 12, moment: 'INCONNU' }), 2026).perles).toHaveLength(0);
  });

  it('fin de période : l’ancrage décale les occurrences', () => {
    const p = poste({ periodicite: 3, moment: 'FIN_PERIODE', debut: '2023-02-01' });
    expect(vueEcheancier(p, 2026).perles.map((x) => x.mois)).toEqual([1, 4, 7, 10]);
  });
});

describe('R7 — cycles énumérés en mois absolus', () => {
  it('le fragment du cycle ouvert l’année précédente est dessiné', () => {
    // Trimestriel ancré en février : janvier 2026 appartient au cycle nov-jan.
    const p = poste({ periodicite: 3, debut: '2023-02-01' });
    expect(cycles(p, 2026).map((c) => [c.du, c.au]))
      .toEqual([[1, 1], [2, 4], [5, 7], [8, 10], [11, 12]]);
  });

  it('le découpage ne dépend pas du moment', () => {
    const base = { periodicite: 3, debut: '2023-02-01' } as const;
    const debut = cycles(poste({ ...base }), 2026).map((c) => [c.du, c.au]);
    const fin = cycles(poste({ ...base, moment: 'FIN_PERIODE' }), 2026).map((c) => [c.du, c.au]);
    expect(fin).toEqual(debut);
  });

  it('tout mois imputé est couvert par une capsule', () => {
    const cas: PosteEcheancier[] = [
      poste({ periodicite: 3, debut: '2023-02-01' }),
      poste({ periodicite: 12, debut: '2022-03-01' }),
      poste({ periodicite: 6, debut: '2020-05-01' }),
      poste({ periodicite: 6, debut: '2026-03-01', fin: '2026-10-31' }),
      poste({ periodicite: 12, moment: 'INCONNU' }),
      poste({ periodicite: 12, mode: 'PERIODIQUE', debut: '2021-11-01' }),
    ];
    for (const p of cas) {
      const couverts = new Set<number>();
      for (const c of cycles(p, 2026)) for (let m = c.du; m <= c.au; m++) couverts.add(m);
      const imputes = vueEcheancier(p, 2026).mois.filter((m) => m.impute).map((m) => m.mois);
      expect(imputes.filter((m) => !couverts.has(m))).toEqual([]);
    }
  });
});

describe('R8 — bords arrondis ou droits', () => {
  it('coupe par janvier et par décembre', () => {
    // Annuel ancré en mars : queue du cycle 2025 en jan-fév, tête du cycle 2026 dès mars.
    expect(bornes(poste({ periodicite: 12, debut: '2022-03-01' }))).toEqual(['12da', '312ad']);
  });

  it('un cycle calé sur l’année n’est coupé nulle part', () => {
    expect(bornes(poste({ periodicite: 6, debut: '2024-01-01' }))).toEqual(['16aa', '712aa']);
  });

  it('les deux bords peuvent être coupés dans la même année', () => {
    expect(bornes(poste({ periodicite: 6, debut: '2020-05-01' })))
      .toEqual(['14da', '510aa', '1112ad']);
  });

  it('la fin de validité coupe à droite, et la cause est tracée', () => {
    const c = cycles(poste({ periodicite: 6, debut: '2026-03-01', fin: '2026-10-31' }), 2026);
    expect(c.map((x) => [x.du, x.au])).toEqual([[3, 8], [9, 10]]);
    expect(c[0]).toMatchObject({ capDu: 'arrondi', capAu: 'arrondi', coupeAu: null });
    expect(c[1]).toMatchObject({ capAu: 'droit', coupeAu: 'validite' });
  });

  it('le début de validité n’est jamais une cause de coupe à gauche', () => {
    const cas: PosteEcheancier[] = [
      poste({ periodicite: 6, debut: '2026-04-01' }),
      poste({ periodicite: 3, debut: '2023-02-01' }),
      poste({ periodicite: 12, debut: '2021-11-01' }),
      poste({ periodicite: 12, moment: 'INCONNU', debut: '2026-05-01' }),
    ];
    for (const p of cas) {
      expect(cycles(p, 2026).every((c) => c.coupeDu !== 'validite')).toBe(true);
    }
    // Un poste qui démarre en cours d'année ouvre son premier cycle sur un bord arrondi.
    expect(cycles(poste({ periodicite: 6, debut: '2026-04-01' }), 2026)[0])
      .toMatchObject({ du: 4, capDu: 'arrondi' });
  });
});

describe('R9 — style et raison de la capsule', () => {
  it('distingue imputation pleine et moment inconnu', () => {
    const pleine = vueEcheancier(poste({ periodicite: 12, mode: 'PERIODIQUE', debut: '2021-11-01' }), 2026);
    const inconnu = vueEcheancier(poste({ periodicite: 12, moment: 'INCONNU' }), 2026);
    expect(pleine.capsules[0]).toMatchObject({ style: 'pointillee', raison: 'imputation-pleine' });
    expect(inconnu.capsules[0]).toMatchObject({ style: 'pointillee', raison: 'moment-inconnu' });
  });
});

describe('R10 — le gras ne porte aucune information', () => {
  it('changer le groupe ne change que le gras', () => {
    const p = poste({ periodicite: 3, debut: '2023-02-01' });
    const a = vueEcheancier(p, 2026, 3);
    const b = vueEcheancier(p, 2026, null);
    const sansGras = (v: typeof a) => v.mois.map(({ gras, ...reste }) => reste);
    expect(sansGras(a)).toEqual(sansGras(b));
    expect(b.mois.every((m) => !m.gras)).toBe(true);
  });
});
```

---

## 9. Points ouverts

**Imputation sans échéance.** Un poste mensualisé clôturé au milieu de sa période impute des mois
pour une échéance qui ne tombera jamais — un semestriel ancré en mars et clos fin octobre impute
cinq mois pour rien. Le composant l'affiche fidèlement, en ambre, et la capsule à bord droit rend
l'interruption visible. Reste à décider si le moteur doit produire ça.

**Coupe par décembre ou par la fin.** R8 lève l'ambiguïté entre un cycle complet et un cycle
coupé, mais pas entre les deux causes de coupe à droite : le bord est droit dans les deux cas.
Le champ `coupeAu` porte la distinction dans le modèle, l'embout rouge la porte à l'écran. Si
cela ne suffit pas à l'usage, un second signe visuel serait à inventer plutôt qu'un composant
multi-années, qui coûterait la compacité qui fait tout l'intérêt de ce format.

> Le point ouvert des versions précédentes — un ponctuel restant actif jusqu'en décembre —
> est résolu par R4 : la fenêtre se réduit au mois de référence.