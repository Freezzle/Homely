# Écran — Comparaison de deux scénarios

> **Statut** : spec détaillée d'une fonctionnalité (pas un document d'architecture). Elle
> vient en complément de `docs/01-principes-et-moteur.md`, `docs/02-domaine-et-donnees.md`,
> `docs/03-architecture.md`, `docs/04-api-et-frontend.md` et des « Règles d'or » du
> [`docs/README.md`](../README.md) — à lire avant de coder. En cas de conflit entre ce
> document et l'un des quatre docs de référence, **les docs de référence gagnent** (par
> exemple pour le nom exact des DTO ou des routes API).
>
> **Objectif de ce document** : contrairement à une spec purement fonctionnelle, celui-ci
> décrit **précisément** la structure, les couleurs, les formules et les comportements du
> prototype joint (`homely-comparaison-scenarios.html`), pour permettre une reproduction
> fidèle en Angular + PrimeNG 22 — pas juste « un écran qui fait à peu près ça ». Les noms
> de composants PrimeNG cités (`p-card`, `p-table`, `p-select-button`, etc.) correspondent
> à PrimeNG 22 ; si la version installée dans le projet diffère, vérifier les noms de
> sélecteurs et de props exacts dans la doc PrimeNG du projet plutôt que de les recopier
> aveuglément d'ici — c'est la seule chose que ce document ne peut pas garantir à 100 %.
> Tout le reste (couleurs, espacements, formules, structure, textes) est à reproduire tel
> quel, sauf mention contraire explicite.

## 0. Palette et tokens

Le prototype reproduit les tokens Aura de PrimeNG 22 sous forme de variables CSS `--p-*`.
**Si le thème Aura est déjà configuré dans le projet Angular, ces variables existent déjà**
et il ne faut rien redéfinir — juste les utiliser. Sinon, voici les valeurs de référence
(preset *emerald* + *slate*, tel qu'utilisé par le prototype) :

| Rôle | Token clair | Valeur | Token sombre | Valeur |
| --- | --- | --- | --- | --- |
| Couleur primaire | `--p-primary-500` | `#10b981` | `--p-primary-400` | `#34d399` |
| Texte | `--p-surface-700` | `#334155` | `--p-surface-0` | `#ffffff` |
| Texte atténué | `--p-surface-500` | `#64748b` | `--p-surface-400` | `#94a3b8` |
| Fond de carte | `--p-surface-0` | `#ffffff` | `--p-surface-900` | `#1e293b`→`#0f172a` |
| Fond de page | `--p-surface-50` | `#f8fafc` | `--p-surface-950` | `#020617` |
| Bordure | `--p-surface-200` | `#e2e8f0` | `--p-surface-700` | `#334155` |
| Rouge (charges/négatif) | `--p-red-500` | `#ef4444` | `--p-red-400` | `#f87171` |
| Ambre (argent de poche) | `--p-amber-500` | `#f59e0b` | `--p-amber-400` | `#fbbf24` |
| Bleu (réserves) | `--p-blue-500` | `#3b82f6` | `--p-blue-400` | `#60a5fa` |
| Violet (scénario B) | `--p-violet-500` | `#8b5cf6` | `--p-violet-400` | `#a78bfa` |

**Rôles sémantiques dérivés** : cet écran réutilise la charte graphique globale
(`frontend/src/styles/_app-tokens.css`), sans tokens dédiés :

```css
--app-positif   /* écart favorable — voir docs/README.md */
--app-negatif   /* écart défavorable */
--app-success   /* scénario A */
--app-info      /* scénario B */
```

**Convention de couleur, appliquée partout sur l'écran, sans exception :**

| Élément | Couleur |
| --- | --- |
| Scénario A (gauche) | `--app-success` (vert) |
| Scénario B (droite) | `--app-info` (couleur primaire du thème) |
| Revenus | `--p-primary-500` (vert) |
| Charges | `--p-red-500` |
| Réserves | `--p-blue-500` |
| Argent de poche | `--p-amber-500` |
| Étapes calculées (Reste à vivre, Solde disponible) | `--p-surface-400` (neutre) + séparateur en tiretés |
| Écart favorable | `--app-positif` (texte) |
| Écart défavorable | `--app-negatif` (texte) |
| Écart nul / négligeable (`< 0.01`) | texte atténué (`--p-text-muted-color`), affiché `—` |

Typographie : `Inter` (Google Fonts, poids 400/500/600/700), taille de base `14px`,
`line-height: 1.5`. Les montants utilisent une police à chiffres tabulaires
(`font-variant-numeric: tabular-nums`) partout où des nombres sont alignés en colonne.

Layout général : conteneur centré `max-width: 1440px`, padding `1.25rem`, cartes empilées
verticalement avec un espacement de `1.25rem` entre elles. En-tête (`topbar`) collé en haut
de page (`position: sticky; top: 0`).

## 1. Correspondance prototype → composants PrimeNG

Les classes CSS du prototype (`p-card`, `p-toolbar`, etc.) reproduisent **volontairement**
les classes générées par les vrais composants PrimeNG, pour que le passage à la vraie
librairie soit direct :

| Classe / élément du prototype | Composant PrimeNG 22 | Notes |
| --- | --- | --- |
| `.p-toolbar` | `<p-toolbar>` | slots `pTemplate="start"` / `"end"` pour les groupes de filtres |
| `.p-card` | `<p-card>` | `header`/`subheader` (ou template) pour titre + sous-titre |
| `.p-select` | `<p-select>` | remplace l'ancien `p-dropdown` en PrimeNG 22 |
| `.p-selectbutton` / `.p-togglebutton` | `<p-selectbutton>` | `[options]`, `[(ngModel)]`, `multiple=false` |
| `.p-tag` (+ `-success/-danger/-warn/-info/-secondary`) | `<p-tag severity="success\|danger\|warn\|info\|secondary">` | |
| `.p-button` (+ `-outlined/-text/-icon-only/-sm`) | `<p-button [outlined]="true" [text]="true" size="small">` | |
| `.p-datatable` / `.p-datatable-table` | `<p-table>` | génère lui-même la classe DOM `.p-datatable` |
| `p-sortable-column` (sur un `<th>`) | `pSortableColumn="champ"` sur la colonne `<p-table>` | tri natif PrimeNG, voir §7 pour la logique exacte |
| `.p-message` | `<p-message severity="info">` | état vide de la liste de diff |
| icônes `<svg><use href="#i-...">` | `<i class="pi pi-...">` (PrimeIcons) | voir table de correspondance ci-dessous |

**Icônes** (le prototype utilise des SVG inline pour rester autonome ; en PrimeNG, utiliser
PrimeIcons) :

| Icône prototype | Usage | Équivalent PrimeIcons |
| --- | --- | --- |
| `i-up` / `i-down` / `i-eq` | tendance d'un indicateur | `pi-arrow-up` / `pi-arrow-down` / `pi-minus` |
| `i-left` / `i-right` | navigation mois précédent/suivant | `pi-chevron-left` / `pi-chevron-right` |
| `i-sun` / `i-moon` | bascule thème clair/sombre | `pi-sun` / `pi-moon` |
| `i-plus` / `i-minus` / `i-pencil` | statut d'un poste (ajouté/supprimé/modifié) | `pi-plus` / `pi-minus` / `pi-pencil` |

Les éléments qui **n'ont pas d'équivalent PrimeNG direct** (barre divergente « poids de
l'écart », table transposée « cascade budgétaire », grille de la carte de chaleur, ligne de
diff) sont des **composants métier custom**, décrits en détail section par section
ci-dessous — ils doivent réutiliser les tokens de couleur `--p-*` du thème, jamais de
couleurs codées en dur.

## 2. Arborescence de composants proposée

```
ComparaisonScenariosPageComponent          (smart — route /scenarios/comparaison)
├── FiltresComparaisonComponent            (dumb — panneau du haut, §3)
├── SoldeMensuelChartComponent             (dumb — graphique, §5)
├── TotauxCategorieTableComponent          (dumb — tableau, §6)
├── CascadeBudgetaireComponent             (dumb — table transposée, §7)
│     └── CascadeBarreComponent            (dumb, réutilisé par cellule — optionnel si le
│                                             gabarit HTML seul suffit)
├── EcartHeatmapComponent                  (dumb — grille mois × catégorie, §8)
└── DiffPostesComponent                    (dumb — liste de changements, §9)
      └── DiffPosteItemComponent           (dumb, une ligne)

IndicateurEcartComponent                   (dumb, réutilisable — §4 ; n'est PAS instancié
                                              sur cet écran mais son contrat doit exister)
```

`ComparaisonScenariosPageComponent` est le seul composant qui appelle le backend et détient
l'état (§10) ; il le distribue en `@Input()` aux composants dumb, qui n'ont aucune logique
de calcul — toute la logique métier (formules ci-dessous) doit vivre soit dans le service qui
appelle le back, soit dans des fonctions pures partagées (`*.utils.ts`), jamais dupliquée
dans plusieurs composants.

## 3. Panneau de filtres

Un `<p-toolbar>` unique, toujours visible en haut de la page (pas sticky dans le prototype,
mais peut le devenir si le projet le fait déjà ailleurs). Contenu, dans l'ordre :

**Groupe de gauche (`start`)** — trois champs, chacun avec un petit libellé au-dessus
(`font-size: .75rem; font-weight: 500; color: var(--p-text-muted-color)`) :

1. **Scénario de gauche** — `<p-select>`, options = tous les scénarios du foyer courant,
   libellé d'option = `nom` du scénario, suffixé de `(référence)` si `estReference: true`.
   Valeur par défaut : le scénario `estReference = true`.
2. **Scénario de droite** — même composant, même liste d'options. Valeur par défaut : un
   autre scénario que celui de gauche.
3. **Année** — `<p-select>`, options = toutes les années de `anneeDepart` à
   `anneeDepart + horizonAnnees - 1` du scénario de référence. Valeur par défaut :
   `anneeDepart`.

**Groupe de droite (`end`)**, poussé à droite (`margin-inline-start: auto`) :

4. **Périmètre** — `<p-selectbutton>` à sélection unique, options = `Foyer` (valeur `null`)
   puis un bouton par membre actif du foyer (libellé = `nom` du membre). Valeur par défaut :
   `Foyer`.

**Comportement** : changer n'importe lequel de ces quatre champs déclenche un recalcul
complet de l'écran (toutes les sections, §5 à §9). Aucun état n'est persisté entre deux
visites de l'écran.

## 4. Indicateurs — composant réutilisable (non affiché sur cet écran)

Le bandeau d'indicateurs (Revenus / Charges / Réserves / Argent de poche / Solde
disponible) a été retiré de la disposition de cet écran pour désencombrer la page. Le
composant doit néanmoins être créé, avec exactement le contrat et le rendu suivants, pour
être réutilisable ailleurs dans l'application (tableau de bord d'un scénario seul, futur
bandeau de synthèse, etc.) :

**Contrat (`@Input()`)** :

```ts
@Input() label!: string;               // ex. "Revenus"
@Input() valeurA!: number;             // total du scénario A
@Input() valeurB!: number;             // total du scénario B
@Input() sens!: 1 | -1;                // 1 = "plus haut est mieux", -1 = l'inverse
@Input() note?: string;                // ex. "mouvement interne", "réduit le disponible"
```

**Rendu**, une `<p-card>` contenant, de haut en bas :

1. Le `label` en petit texte atténué (`.75rem`, `font-weight: 600`, couleur muted).
2. La **valeur d'écart** en gros (`1.5rem`, `font-weight: 700`) : `valeurB - valeurA`,
   formaté avec le signe (`+`/`−`) et sans décimale (voir §11 pour le format exact), précédée
   d'une icône de tendance et suivie du pourcentage d'évolution :
    - icône `pi-arrow-up` si l'écart est positif, `pi-arrow-down` si négatif,
      `pi-minus` si `Math.abs(écart) < 0.01` (traiter comme nul) ;
    - couleur du bloc entier : `--app-positif` si `écart * sens > 0` (favorable), `--app-negatif` sinon,
      `muted` si l'écart est nul ;
    - pourcentage affiché seulement si `valeurA !== 0`, calculé
      `(écart / Math.abs(valeurA)) * 100`, une décimale, précédé de son propre signe.
3. Un séparateur horizontal fin (`1px`, couleur de bordure).
4. Deux lignes de comparaison, une par scénario, chacune avec un petit point coloré
   (`--app-success` / `--app-info`, cercle de `0.5rem`) suivi du nom du scénario à gauche et de sa
   valeur brute (non arrondie différemment, même format que §11) à droite.
5. Si `note` est fourni, une ligne de texte très atténuée (`.6875rem`) en bas de carte.

Les cinq instances à prévoir si/quand ce composant est affiché en bandeau :

| `label` | `valeurA`/`valeurB` | `sens` | `note` |
| --- | --- | --- | --- |
| Revenus | total revenus du scénario | `1` | — |
| Charges | total charges du scénario | `-1` | — |
| Réserves | total réserves du scénario | `-1` | `mouvement interne` |
| Argent de poche | total argent de poche cumulé | `-1` | `réduit le disponible` |
| Solde disponible | solde disponible net (après argent de poche) | `1` | `après argent de poche` |

## 5. Solde disponible mois par mois

Un graphique en barres groupées, dans une `<p-card>` (titre : « Solde disponible mois par
mois », sous-titre : « Revenus − charges − réserves − argent de poche, sur les 12 mois de
l'année »), hauteur fixe `300px`.

**Données**, pour l'année et le périmètre sélectionnés, 12 points (un par mois) :

- **Série 1** (barres, couleur `--app-success`, opacité `.85`) : solde disponible mensuel du
  scénario A.
- **Série 2** (barres, couleur `--app-info`, opacité `.85`) : solde disponible mensuel du
  scénario B.
- **Série 3** (ligne, axe Y secondaire à droite, couleur ambre `--p-amber-500`) : écart
  mensuel = `soldeB[mois] - soldeA[mois]`.

Barres avec coins arrondis (`4px`), épaisseur maximale `22px`. Légende en bas, avec puces
rondes. Infobulle au survol affichant, pour chaque série au mois survolé, le libellé de la
série suivi du montant formaté (§11) et de « CHF ». Axe Y principal et axe Y secondaire tous
deux sans grille verticale, uniquement une grille horizontale légère
(`rgba(surface-400, .18)`).

Le prototype utilise Chart.js ; réutiliser la librairie de graphiques déjà en place dans le
projet Angular si elle existe, sinon en introduire une — le comportement décrit ci-dessus
(3 séries, axe secondaire, infobulle par mois) doit être conservé quelle que soit la
librairie choisie.

## 6. Totaux par catégorie

Un `<p-table>` dans une `<p-card>` (titre : « Totaux par catégorie », sous-titre : « Écart
annuel entre les deux scénarios, par catégorie »).

**En-tête de table** (`p-datatable-header` dans le prototype, au-dessus du tableau) :

- `<p-selectbutton>` **Type de poste** : `Tous` (défaut) / `Revenus` / `Charges` /
  `Réserves`.
- Case à cocher **« Écarts uniquement »**, alignée à droite (`margin-inline-start: auto`) :
  masque les lignes dont l'écart est nul.

**Colonnes, exactement dans cet ordre — pas d'autres colonnes, pas d'accordéon, pas de
détail poste par poste sous une ligne :**

| Colonne | Contenu | Triable |
| --- | --- | --- |
| Catégorie | libellé de la catégorie, en gras | oui (alphabétique) |
| Type | `<p-tag>` — `success` si Revenu, `danger` si Charge, `info` si Réserve | non |
| Écart | `totalCatégorieB - totalCatégorieA`, signé, formaté §11, en gras, coloré `pos`/`neg`/`muted` | oui |
| Poids de l'écart | barre divergente (voir formule ci-dessous) | non |

**Calcul par ligne** :

```ts
type = catégorie.typePoste; // 'REVENU' | 'CHARGE' | 'RESERVE'
delta = totalCatégorieB - totalCatégorieA;
impact = type === 'REVENU' ? 1 : -1;   // sens de l'effet sur le solde disponible
effet = impact * delta;
```

**Tri par défaut** : par `Math.abs(effet)` décroissant (les plus gros écarts en premier).
Cliquer sur l'en-tête « Catégorie » trie par ordre alphabétique (croissant, puis inverse au
second clic) ; cliquer sur l'en-tête « Écart » trie par `Math.abs(effet)` (décroissant, puis
inverse au second clic).

**Barre « Poids de l'écart »** — une barre **divergente** (part du centre, pas de la
gauche), largeur du conteneur `min-width: 80px`, hauteur `.5rem`, fond neutre, avec un trait
vertical fin au centre (`50%`) marquant le zéro :

```ts
maxAbs = Math.max(1, ...lignesAffichées.map(r => Math.abs(r.effet)));
largeurPourcent = (Math.abs(effet) / maxAbs) * 50;   // jamais plus de 50% de la barre
// si effet >= 0 : segment coloré --app-positif, ancré à gauche du centre (left: 50%)
// si effet <  0 : segment coloré --app-negatif, ancré à droite du centre (right: 50%)
```

Le `maxAbs` se recalcule à chaque changement de filtre (sur les lignes **affichées**
seulement, pas sur toutes les catégories du foyer).

**État vide** : si le filtre ne retourne aucune ligne, afficher une ligne unique fusionnée
sur toutes les colonnes : « Aucune catégorie ne correspond à ce filtre. Élargissez la
sélection pour voir des lignes. », texte atténué, centré, padding généreux (`2rem`).

## 7. Cascade budgétaire

C'est la section la plus spécifique de l'écran — à reproduire avec le plus grand soin. Dans
une `<p-card>` (titre : « Cascade budgétaire », sous-titre : « Une ligne par scénario :
comparez la longueur des barres, colonne par colonne, pour repérer où naît l'écart — sur un
mois ou sur l'année complète. »).

**Sélecteur de granularité**, en haut de la carte : `<p-selectbutton>` à deux options,
`Mois` / `Année` (coché par défaut).

**Navigation mensuelle**, juste à côté, **visible uniquement en mode « Mois »** (masquée —
`display: none`, pas juste désactivée — dès que « Année » est sélectionné) :

- bouton icône `pi-chevron-left` (mois précédent, boucle de janvier à décembre),
- `<p-selectbutton>` scrollable horizontalement avec un bouton par mois (« Jan », « Fév »,
  … libellés courts sur 3 lettres), mois par défaut : celui correspondant à l'index `5`
  (mai) au premier chargement,
- bouton icône `pi-chevron-right` (mois suivant, boucle de décembre à janvier).

**Table transposée** — **une ligne par scénario, une colonne par étape du calcul** (c'est
l'inverse d'une cascade classique qui aurait une ligne par étape) :

En-têtes de colonnes, dans cet ordre exact, chacune préfixée d'un opérateur visuel (sauf la
première) :

| # | Libellé colonne | Opérateur affiché | Couleur de barre | Colonne « résultat » |
| --- | --- | --- | --- | --- |
| 1 | Revenus | *(aucun)* | `--p-primary-500` | non |
| 2 | Charges | `−` | `--p-red-500` | non |
| 3 | Réserves | `−` | `--p-blue-500` | non |
| 4 | Reste à vivre | `=` | `--p-surface-400` | **oui** |
| 5 | Argent de poche | `−` | `--p-amber-500` | non |
| 6 | Solde disponible | `=` | `--p-surface-400` | **oui** |

La première cellule de l'en-tête (coin haut-gauche) affiche le libellé de la période en
cours : `"<Mois> <Année>"` en mode Mois (ex. « Mai 2026 »), ou `"Année <Année>"` en mode
Année (ex. « Année 2026 »).

Les colonnes « résultat » (Reste à vivre, Solde disponible) ont une **bordure gauche en
tirets** (`1px dashed`, couleur de bordure) et un padding-gauche légèrement augmenté, pour
les détacher visuellement des colonnes d'entrée brutes.

**Lignes du corps de table**, dans cet ordre :

1. Ligne scénario A — première cellule : point coloré `--app-success` + nom du scénario, en gras.
2. Ligne scénario B — première cellule : point coloré `--app-info` + nom du scénario, en gras.
3. Ligne « Écart » — première cellule : texte « Écart », atténué. Chaque colonne affiche
   `signe(B[colonne] - A[colonne])` (voir §11), coloré `pos`/`neg`/`muted` selon le sens
   favorable de la colonne (`1` pour Revenus/RàV/Solde, `-1` pour Charges/Réserves/Poche),
   `—` si l'écart est `< 0.01` en valeur absolue.

**Contenu de chaque cellule de donnée (lignes A et B)** : une barre horizontale (hauteur
`1.6rem`, coins arrondis `4px`, fond neutre) + le montant formaté (§11) affiché en
surimpression, aligné à droite de la barre.

**Formule de mise à l'échelle — point le plus important de cette section** : la largeur de
chaque barre est calculée **par colonne**, jamais sur une échelle globale à toute la table
(sinon l'argent de poche, toujours petit comparé aux revenus, deviendrait illisible) :

```ts
// pour chaque colonne (étape) indépendamment :
maxColonne = Math.max(1, Math.abs(valeurA_colonne), Math.abs(valeurB_colonne));
largeurPourcent = Math.min(100, (Math.abs(valeur) / maxColonne) * 100);
// si valeur < 0 : barre en rouge (--p-red-500) quelle que soit la colonne
// sinon : couleur de la colonne (table ci-dessus)
```

C'est cette mise à l'échelle par colonne, combinée à l'empilement vertical direct de la
ligne A au-dessus de la ligne B (mêmes colonnes, alignées), qui permet de comparer la
longueur des barres d'un coup d'œil pour repérer sur quelle étape porte l'écart — c'est
l'intention explicite de cette disposition, à ne pas perdre en la réimplémentant.

**Le Reste à vivre et le Solde disponible peuvent être négatifs** (doc 01 §1) : ne jamais
clamper à 0. Une valeur négative se traduit uniquement par la couleur rouge de la barre, pas
par un masquage ou une valeur plancher.

**Changement de mode** : basculer vers « Année » doit recalculer immédiatement la table avec
les totaux annuels (mêmes agrégats que le total de la projection annuelle, doc 01 §4) et
masquer la navigation mensuelle ; rebasculer vers « Mois » doit réafficher la navigation et
revenir au dernier mois actif sélectionné (ne pas réinitialiser à mai à chaque bascule).

Le tableau doit défiler horizontalement dans son propre conteneur (`overflow-x: auto`) sans
faire défiler toute la page, avec une largeur minimale de contenu (`760px` dans le
prototype) pour ne jamais tasser les 6 colonnes.

## 8. Où se situe l'écart

Une carte de chaleur **mois × catégorie**, dans une `<p-card>` (titre : « Où se situe
l'écart », sous-titre : « Écart mensuel sur le solde, par catégorie. Vert : le scénario de
droite fait mieux. Rouge : il coûte plus. »).

**Grille** : `display: grid`, colonnes = `minmax(150px, auto)` pour les libellés de ligne
puis `repeat(12, minmax(48px, 1fr))` pour les 12 mois. Première cellule de la première ligne
vide, suivie des 12 abréviations de mois en en-tête.

**Une ligne par catégorie** ayant un effet non négligeable sur au moins un mois de l'année
(somme des valeurs absolues sur les 12 mois `>= 1`, sinon la catégorie est omise pour ne pas
surcharger la grille) — **plus une ligne « Argent de poche »** ajoutée à part (ce n'est pas
une catégorie au sens du doc 02, mais son écart doit être visible ici), avec le même seuil
d'inclusion.

**Valeur d'une cellule** (catégorie, mois) :

```ts
impact = type === 'REVENU' ? 1 : -1;
valeur = impact * (totalCatégorieMois(B) - totalCatégorieMois(A));
// pour la ligne "Argent de poche" (cas particulier, impact toujours -1) :
valeur = -(argentDePocheMois(B) - argentDePocheMois(A));
```

**Couleur de cellule**, échelle commune à **toute la grille** (contrairement à la cascade
budgétaire qui est mise à l'échelle par colonne) :

```ts
max = Math.max(1, ...toutesLesValeursAbsoluesDeLaGrille);
if (Math.abs(valeur) < 0.5) couleur = surfaceNeutre;  // pas d'écart significatif
else {
  opacite = 0.12 + Math.min(1, Math.abs(valeur) / max) * 0.68;  // entre 12% et 80%
  couleur = valeur > 0
    ? colorMix(primary-500, opacite)   // vert : B fait mieux
    : colorMix(red-500, opacite);      // rouge : B coûte plus
}
```

**Contenu texte de la cellule** : le montant signé (§11), ou vide si `Math.abs(valeur) <
0.5`. **Infobulle** (`title` HTML ou équivalent PrimeNG) sur chaque cellule : `"<Catégorie>
· <Mois> : <montant signé> CHF sur le solde"`.

Cellules de hauteur fixe `2rem`, coins arrondis (`4px`), taille de texte `.6875rem`, chiffres
tabulaires. Le libellé de ligne (nom de catégorie) reste visible au défilement horizontal
(`position: sticky; left: 0`).

## 9. Ce qui change dans les postes

Une liste façon revue de changements (diff), dans une `<p-card>` (titre : « Ce qui change
dans les postes », sous-titre : « Comparaison poste à poste entre les deux scénarios, en
montant annuel »).

**Filtre en en-tête** : `<p-selectbutton>` — `Changements` (défaut), `Ajoutés`, `Supprimés`,
`Modifiés`, `Tout`. À côté, un compteur textuel atténué au format :
`"N ajouté(s) · N supprimé(s) · N modifié(s) · N inchangé(s)"` (accord au pluriel dès que
`N > 1`), calculé sur l'ensemble des postes **avant filtrage**, pas sur la liste affichée.

**Construction de la liste** — comparer les postes des deux scénarios par leur identifiant
stable (`cle` / identifiant technique du poste, **pas** son libellé) :

```ts
pour chaque identifiant présent dans A ou dans B :
  postA = poste correspondant dans A (ou undefined)
  postB = poste correspondant dans B (ou undefined)
  totalA = totalAnnuel(postA)  // 0 si absent
  totalB = totalAnnuel(postB)  // 0 si absent

  statut =
    !postA ? 'AJOUTE' :
    !postB ? 'SUPPRIME' :
    (postA.montant, .periodiciteMois, .mode, .moment, .debut, .fin, .devise diffèrent) ? 'MODIFIE' :
    'INCHANGE';

  effet = impact(type du poste) * (totalB - totalA);
```

**Tri** : d'abord par statut (Ajouté, puis Supprimé, puis Modifié, puis Inchangé), puis à
l'intérieur d'un même statut par `Math.abs(totalB - totalA)` décroissant.

**Rendu d'une ligne**, disposition en 3 colonnes (`1.75rem / 1fr / auto`), bordure gauche
épaisse (`3px`) colorée selon le statut, fond légèrement transparent (`opacity: .72`) pour le
statut Inchangé :

| Statut | Couleur bordure gauche | Icône (badge à gauche) | `<p-tag severity>` |
| --- | --- | --- | --- |
| Ajouté | `--p-primary-500` | `pi-plus` | `success` |
| Supprimé | `--p-red-500` | `pi-minus` | `danger` |
| Modifié | `--p-amber-500` | `pi-pencil` | `warn` |
| Inchangé | bordure neutre | `pi-minus` (égal) | `secondary` |

Colonne centrale :
- description du poste (gras),
- si le poste est chaîné par révision (`posteOrigineId` renseigné sur A ou B, doc 01 §9 /
  doc 02) : un `<p-tag severity="info">révision</p-tag>` juste après la description — un
  poste révisé n'est **pas** un simple ajout/suppression indépendant, il doit être
  identifiable comme continuité du même poste dans le temps,
- ligne de métadonnées atténuée : `"<Catégorie> · <périodicité>[ · dès JJ.MM.AAAA][
  jusqu'au JJ.MM.AAAA][ · estimation]"`, où la périodicité s'exprime : « ponctuel » si
  `periodiciteMois === 0`, « mensuel » si `=== 1`, sinon `"<N> mois · échéance début/fin de
  période"` (mode `PERIODIQUE`) ou `"<N> mois · mensualisé"` (sinon),
- si Modifié et que le montant a changé : suffixe `" · montant <ancien> → <nouveau> CHF"`.

Colonne de droite (montants, alignés à droite) :
- l'ancien montant (`totalA`) barré et atténué, sauf si le statut est Ajouté (rien à barrer),
- le nouveau montant (`totalB`) en gras, ou `—` si Supprimé,
- en dessous, l'effet net sur le solde disponible : `signe(totalB - totalA) + " / an"`,
  coloré `pos`/`neg`, ou `"sans effet"` en atténué si l'écart est `< 0.01`.

**État vide** : `<p-message severity="info">` — « Aucun poste ne correspond à ce filtre.
Choisissez « Tout » pour afficher l'ensemble des postes. »

## 10. État de l'écran (variables à porter dans le composant conteneur)

```ts
interface EtatComparaison {
  scenarioAId: string;
  scenarioBId: string;
  annee: number;
  perimetreMembreId: string | null;      // null = foyer entier
  filtreTypePoste: 'TOUS' | 'REVENU' | 'CHARGE' | 'RESERVE';   // §6
  ecartsUniquement: boolean;                                    // §6
  triCategories: { colonne: 'libelle' | 'delta'; direction: 1 | -1 };  // §6
  modeCascade: 'mois' | 'annee';         // §7
  moisActif: number;                     // 1..12, §7
  filtreDiff: 'CHANGES' | 'AJOUT' | 'SUPPR' | 'MODIF' | 'TOUS'; // §9
}
```

Toutes les sections (§5 à §9) se recalculent à partir de cet état + des données renvoyées
par le back pour `(scenarioAId, scenarioBId, annee, perimetreMembreId)`. Aucun champ de cet
état n'est persisté entre deux visites.

## 11. Formatage des nombres

Toute la page utilise le même formatage, sans exception :

- Locale `fr-CH`, zéro décimale, arrondi à l'entier le plus proche
  (`Intl.NumberFormat('fr-CH', { maximumFractionDigits: 0 })`, appliqué à `Math.round(valeur)`).
- Un montant **signé** (utilisé pour tous les écarts) : préfixe `+` si strictement positif,
  `−` (moins typographique, U+2212, pas un trait d'union) si strictement négatif, rien si
  nul — jamais de parenthèses ni d'autre convention.
- Un écart dont la valeur absolue est `< 0.01` est traité comme **nul** partout (affiché
  `—`, couleur atténuée), pas comme une infime valeur positive ou négative.
- Devise : « CHF » toujours en suffixe explicite dans les infobulles et libellés qui n'ont
  pas déjà une colonne/contexte l'indiquant.

## 12. Contrat de données attendu du back

Cet écran a besoin, pour un couple `(scénarioA, scénarioB, année, périmètre)`, des données
suivantes — à exposer via l'API existante ou un nouvel endpoint de comparaison, selon ce qui
est le plus cohérent avec les contrats déjà définis dans `docs/04-api-et-frontend.md` (à
consulter pour le format exact des DTO et des routes) :

- La **projection annuelle** de chaque scénario pour le périmètre donné : 12 points
  mensuels + un total annuel, chacun avec `revenus`, `charges`, `reserves`,
  `soldeDisponibleBrut` (Reste à vivre), `argentDePoche`, `soldeDisponible` — ce sont
  exactement les champs consommés par §5 et §7.
- Les **totaux par catégorie** de chaque scénario pour l'année et le périmètre donnés (§6),
  et si possible **par mois** pour la même catégorie (§8 en a besoin mois par mois, pas
  seulement en total annuel).
- La **liste des postes** de chaque scénario, avec leur identifiant stable, description,
  catégorie, montant, périodicité, mode, moment, dates de validité, devise, et
  `posteOrigineId` pour détecter les révisions (§9).
- L'**argent de poche** cumulé par mois pour le périmètre donné, distinct du Reste à vivre
  (nécessaire pour la colonne dédiée de la cascade budgétaire, §7).

Le moteur de calcul (doc 01) **ne doit pas être dupliqué côté front** : ces données arrivent
déjà agrégées depuis le back. Le multi-tenant s'applique normalement : les deux scénarios
comparés doivent appartenir au même foyer que celui de l'utilisateur courant (test d'accès
croisé à prévoir si un nouvel endpoint est créé, doc README « Règles d'or »).

## 13. Rôles et accès

Écran strictement en lecture (aucune action d'écriture depuis cet écran). Visible sans
restriction pour les trois rôles (`OWNER`, `EDITOR`, `VIEWER`) — pas de masquage à prévoir
pour ce cas précis.

## 14. Accessibilité et responsive

- Focus clavier visible sur tous les contrôles interactifs (filtres, boutons de tri, cases à
  cocher, navigation mensuelle).
- Respecter `prefers-reduced-motion` (désactiver transitions/animations si demandé).
- Tous les tableaux larges (cascade budgétaire notamment) défilent horizontalement dans leur
  propre conteneur, jamais toute la page.
- Aucun texte en dur : tout passe par les clés i18n existantes du projet (doc README,
  Definition of Done).
- Le prototype applique un thème clair/sombre basé sur `prefers-color-scheme`, avec bouton
  de bascule manuelle en en-tête — à adapter au mécanisme de thème déjà en place dans le
  projet Angular s'il existe, sinon reproduire ce comportement (icône soleil/lune, bascule
  manuelle qui prime sur la préférence système).

## 15. Definition of Done (spécifique à cet écran)

En complément de la Definition of Done générale du projet (doc README) :

- [ ] Le composant `IndicateurEcart` (§4) existe, testé unitairement, même s'il n'est
  instancié nulle part sur cet écran.
- [ ] Aucune logique de calcul métier dans les composants d'affichage : tout vient de
  données déjà agrégées par le back (doc 03 — moteur isolé côté serveur).
- [ ] Le Reste à vivre et le solde disponible s'affichent correctement quand ils sont
  négatifs, sur les trois visualisations concernées (graphique §5, cascade §7, carte de
  chaleur §8) — vérifié par un cas de test avec un scénario dont un mois est négatif.
- [ ] La bascule Mois/Année de la cascade budgétaire (§7) fonctionne dans les deux sens sans
  recharger la page, sans perdre les autres filtres, et sans réinitialiser le mois actif
  à chaque bascule.
- [ ] La mise à l'échelle des barres de la cascade budgétaire est bien **par colonne**, pas
  globale (vérifiable visuellement : la colonne « Argent de poche » ne doit jamais être
  écrasée à une largeur illisible par la colonne « Revenus »).
- [ ] Le filtrage et le tri du tableau de catégories (§6), le filtrage du diff de postes
  (§9), et la navigation mensuelle (§7) sont couverts par des tests unitaires de
  composants.
- [ ] Les trois rôles (`OWNER`, `EDITOR`, `VIEWER`) accèdent à l'écran sans différence de
  comportement.
- [ ] Aucun texte en dur ; toutes les chaînes passent par i18n.

## 16. Annexes

- Prototype de référence : `homely-comparaison-scenarios.html` (autonome, moteur JS de
  démonstration inclus uniquement pour fonctionner hors ligne — à ouvrir dans un navigateur
  pour valider visuellement chaque section avant de considérer l'implémentation terminée).
- Vocabulaire à respecter : voir le glossaire du `docs/README.md` (Foyer, Scénario, Poste,
  Membre, Contribution, Reste à vivre, etc.) — les noms de composants, variables et DTO
  doivent rester cohérents avec ce langage ubiquitaire plutôt que d'introduire une
  terminologie anglaise ou divergente (ex. `CascadeBudgetaireComponent`, pas
  `BudgetWaterfallComponent`).