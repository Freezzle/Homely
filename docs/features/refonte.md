# Refonte de la popin « Poste » (création et édition)

> **Pour l'agent** : ce document décrit la nouvelle popin qui **remplace** le contenu de
> `features/postes/poste-form-dialog/` (création **et** édition d'un revenu, d'une charge
> ou d'une réserve). Lire aussi `docs/README.md`, `docs/04-api-et-frontend.md` §3.2 et §4,
> et `.github/copilot-instructions.md` avant de coder. En cas de conflit, ces docs
> priment sur ce fichier pour tout ce qui touche au métier.

---

## 1. Objectif

Remplacer le stepper actuel en 5 étapes (Le poste · Le rythme · Le montant · Répartition ·
Récapitulatif) par un parcours **« une question par écran »** :

- **5 ou 6 étapes courtes**, l'étape « Paiement » n'existant que si la périodicité est > 1 mois ;
- une **fiche** à droite (desktop) qui se remplit en direct, une ligne par étape, et sert de
  récapitulatif permanent : **plus d'étape « Récapitulatif »** ;
- sur mobile, la fiche devient un **tiroir** ouvert depuis une barre en bas qui affiche
  l'impact mensuel ;
- moins de champs visibles : les choix se font surtout par **cartes cliquables** et
  **puces**, les champs date n'apparaissent que sur « Autre date ».

Le contrat externe du composant, le payload envoyé à l'API et les règles de validation
**ne changent pas** (voir §9).

---

## 2. Contraintes impératives

1. **Styles** : utiliser exclusivement le système existant.
    - Tokens de `src/styles/_app-tokens.css` (`--app-ink`, `--app-ink-muted`, `--app-line`,
      `--app-card`, `--app-bg`, `--app-revenu|charge|reserve(-bg)`, `--app-info(-bg)`,
      `--app-danger(-bg)`, `--app-radius-card|item|pill`…).
    - Variables du thème PrimeNG (`--p-primary-color`, `--p-surface-*`, …).
    - Utilitaires Tailwind v4 (`flex`, `gap-*`, `p-*`, `text-sm`, `font-semibold`, `md:`…),
      déjà configurés dans `src/styles.css` avec l'ordre de layers `theme, base, primeng,
     components, utilities`.
    - **Aucune couleur, police ou rayon en dur** dans les composants. Si un token manque
      (ex. fond « sélectionné »), l'**ajouter dans `_app-tokens.css`** en le dérivant d'un
      token existant (`color-mix(in srgb, var(--p-primary-color) 12%, var(--app-card))`),
      puis l'utiliser.
    - Le dark mode passe par la classe `.dark` sur `<html>` : rien à faire si l'on ne
      consomme que des tokens.
    - Couleurs des membres : `MembreDto.couleur` via `normaliserCouleur()` (seule exception
      autorisée en style inline, comme ailleurs dans l'app).
2. **Pas de logique de pré-sélection de catégorie** : la catégorie n'est jamais déduite du
   nom, n'est jamais réordonnée, et n'est pas pré-remplie en création. Pas de « raccourcis »
   ni de suggestions à partir du nom.
3. **Aucun texte en dur** : toutes les chaînes passent par l'i18n (`I18nService`,
   `readonly t = this.i18n.translations()`), clés à ajouter dans `fr.json` et `en.json` (§10).
4. **Réutiliser les briques existantes** : `shared/components/form-fields/*`
   (`app-input-text`, `app-input-number`, `app-select`, `app-date-picker`, `app-checkbox`),
   `app-button`, `MontantPipe`, `creerDevisesDisponibles`, `toIsoDateLocal` /
   `parseIsoDateLocal`, `arrondirSommeRepartition` / `sommeRepartitionValide`,
   `notifierSucces` / `notifierErreur`, `PosteService`, `CompteService`.
5. **Nouveaux composants légers** pour : l'indicateur d'étapes, la fiche, l'aperçu des
   périodicités, la répartition, l'échelle 1 à 5, plus un groupe de « cartes de choix »
   réutilisé partout (§6). Chacun : standalone, `ChangeDetectionStrategy.OnPush`,
   `input()` / `output()` / `model()`, signals, **sans appel HTTP ni logique métier**
   (le conteneur leur passe des valeurs déjà calculées).
6. Accessibilité : vrais `<button>` / `<input>` / `<label>`, `aria-pressed` sur les choix,
   `aria-current="step"`, `role="progressbar"`, zones cliquables ≥ 44 px de haut, focus
   visible (déjà global dans `styles.css`).

---

## 3. Arborescence cible

```
features/postes/poste-form-dialog/
├── poste-form-dialog.component.ts|html        ← conteneur (remplace l'actuel)
├── poste-form-etapes.ts                       ← définition des étapes + fonctions de résumé
├── etapes/
│   ├── etape-quoi.component.ts|html
│   ├── etape-combien.component.ts|html
│   ├── etape-validite.component.ts|html
│   ├── etape-paiement.component.ts|html
│   ├── etape-repartition.component.ts|html
│   └── etape-analyse.component.ts|html
└── components/
    ├── poste-fiche/                           ← fiche récap (desktop + tiroir mobile)
    ├── poste-apercu-periodicite/              ← barre des 12 mois
    └── poste-repartition/                     ← curseur + préréglages + comptes

shared/components/
├── step-progress/                             ← barre d'étapes + retour + « n / N »
├── choix-cartes/                              ← groupe de cartes (titre + sous-titre)
└── echelle-notation/                          ← échelle 1 à 5
```

Les composants `etapes/*` reçoivent le `FormGroup` (ou ses sous-contrôles) du conteneur
et les données déjà calculées ; ils n'ont **pas** d'état propre persistant. Si l'agent
préfère garder les étapes dans le template du conteneur avec des `@switch`, c'est
acceptable tant que le conteneur reste lisible (< ~300 lignes de template).

---

## 4. Contrat du conteneur (inchangé)

```ts
selector: 'app-poste-form-dialog'
readonly type       = input<TypePoste>('REVENU');
readonly categories = input<CategorieDto[]>([]);
readonly poste      = input<PosteDto | null>(null);   // null = création
readonly visible    = input<boolean>(false);
readonly visibleChange = output<boolean>();
readonly enregistre    = output<void>();
```

`postes-liste.component.html` ne doit pas changer.

---

## 5. Mise en page

```
┌──────────────────────────────── p-dialog ─────────────────────────────────┐
│ [Badge type] Nouveau poste / Modifier           Foyer · Scénario      [×] │
├───────────────────────────────────────────────┬───────────────────────────┤
│ [‹]  ■■■■■□□  3 / 6        ← step-progress     │  TA FICHE                 │
│                                                │  Poste                    │
│ Titre de la question (h3)                      │  Loyer appartement        │
│ Sous-titre court (optionnel)                   │  Logement                 │
│                                                │  ─ Montant ─────────────  │
│ Contenu de l'étape                             │  1 850,00 CHF chaque mois │
│ (cartes de choix, puces, champs)               │  ─ Validité ───────────── │
│                                                │  Dès le 1er nov. 2026 …   │
│                                                │  …                        │
│                                                │  Impact sur le budget     │
│                                                │  1 850,00 CHF / mois      │
├───────────────────────────────────────────────┴───────────────────────────┤
│ Annuler            Appuie sur Entrée   [Aller à la fin] [Continuer →]     │
└───────────────────────────────────────────────────────────────────────────┘
```

- `p-dialog` : `modal`, non déplaçable, non redimensionnable, `[style]="{ width: '58rem' }"`,
  `[breakpoints]="{ '768px': '100vw' }"` (plein écran sous 768 px, comme l'actuel).
  Hauteur fixe du contenu (≈ `min(40rem, 80vh)`) ; **seule la colonne de la question
  défile**, la fiche a son propre défilement.
- Badge de type dans l'en-tête : `--app-revenu` / `--app-charge` / `--app-reserve` sur
  fond `-bg`. Titre : « Nouveau poste » en création, « Modifier le poste » en édition.
  Sous-titre : foyer · scénario (comme aujourd'hui).
- Colonne fiche : largeur ~18rem, fond `--app-bg`, séparée par `--app-line`.
- **Mobile (< 768 px)** :
    - la fiche est masquée ; une **barre** pleine largeur au-dessus du pied affiche le nom du
      poste (ou « Ta fiche ») et l'impact mensuel, avec « Voir la fiche ▴ » ;
    - un tap ouvre un **tiroir** par le bas (`p-drawer position="bottom"` ou panneau absolu
      dans la popin) contenant la même `app-poste-fiche` ; un tap sur une ligne ferme le tiroir
      et navigue vers l'étape ;
    - le pied n'affiche plus « Annuler » (la croix suffit) ni l'aide clavier ; les boutons
      passent en pleine largeur, empilés, l'action principale en haut.
- Pied :
    - étapes intermédiaires : `Continuer →` (primaire) ; `Aller à la fin` (secondaire)
      seulement si l'étape « Analyse » a déjà été visitée ; aide « Appuie sur Entrée » (desktop) ;
    - dernière étape : `Enregistrer et nouveau` (outlined) + `Enregistrer` (primaire) ;
    - **en édition**, `Enregistrer` est présent à **toutes** les étapes.

---

## 6. Composants légers

### 6.1 `app-step-progress` (shared)

| API | Type | Rôle |
|---|---|---|
| `total` | `input.required<number>()` | nombre d'étapes affichées |
| `courante` | `input.required<number>()` | index 0-based |
| `retour` | `output<void>()` | clic sur le chevron « précédent » (masqué si `courante === 0`) |

Rendu : chevron (44×44), `N` segments égaux (`grid-template-columns: repeat(N, 1fr)`,
hauteur 6 px, `--app-radius-pill`) remplis jusqu'à l'étape courante incluse
(`--p-primary-color`, sinon `--app-line`), puis « 3 / 6 » en `--app-ink-muted`,
`tabular-nums`. `role="progressbar"` + `aria-valuenow/min/max`. Le nombre de segments
**varie** quand l'étape Paiement apparaît ou disparaît : c'est normal.

### 6.2 `app-choix-cartes` (shared)

Groupe de cartes à sélection unique, utilisé pour Validité, Paiement, Comptes.

| API | Type |
|---|---|
| `options` | `input.required<{ value: T; titre: string; sousTitre?: string; desactive?: boolean }[]>()` |
| `value` | `model<T \| null>()` |
| `label` | `input<string>()` (label du groupe, relié par `aria-labelledby`) |

Rendu : grille `repeat(auto-fill, minmax(9rem, 1fr))`, gap 8 px. Carte = `<button>`
hauteur min 56 px, titre `font-semibold`, sous-titre `text-xs` `--app-ink-muted`,
bordure `--app-line-3`, rayon `--app-radius-card`. Sélectionnée : bordure 2 px
`--p-primary-color`, fond token « sélectionné » (cf. §2.1), titre en couleur primaire,
`aria-pressed="true"`. Implémenter `ControlValueAccessor` **ou** `model()` : au choix, mais
rester cohérent avec `form-fields`.

> Les **puces** (fréquence, catégorie, préréglages de répartition) peuvent réutiliser
> `app-select-button` si son rendu convient ; sinon une variante `app-choix-puces`
> (même API, rendu en pilules `--app-radius-pill`, wrap).

### 6.3 `app-echelle-notation` (shared)

| API | Type |
|---|---|
| `value` | `model<number>()` (1 à 5) |
| `label` | `input.required<string>()` |
| `question` | `input<string>()` (aide courte à droite du label) |
| `libelleMin` / `libelleMax` | `input<string>()` |

Rendu : 5 boutons égaux (hauteur 44 px) ; les valeurs `≤ value` ont un fond doux, la
valeur courante une bordure primaire 2 px et `aria-pressed="true"` ; sous la rangée,
`libelleMin` à gauche et `libelleMax` à droite (`text-xs`, muted).
`aria-label` de chaque bouton : « {label} : {n} sur 5 ».
Remplace les `p-slider` 1–5 actuels.

### 6.4 `app-poste-apercu-periodicite` (feature)

Barre de **12 mois à partir du mois de début** du poste.

| API | Type |
|---|---|
| `poste` | `input<PosteEcheancier \| null>()` (type existant de `echeancier.model.ts`) |

- **Réutiliser `imputations()` et `estActif()`** de
  `shared/components/echeancier-annuel/echeancier.util.ts` (appelées pour l'année du début
  et la suivante, puis découpées sur 12 mois) : ce sont les règles R3–R5 déjà testées.
  Ne pas réécrire le calcul.
- Par mois : une barre + l'initiale du mois.
    - ponctuel : grande barre pleine le mois de la date, mini-barres grises ailleurs ;
    - mensuel : barres pleines ;
    - périodique **lissé** (`MENSUALISE`) : barres moyennes en couleur douce, et un **point**
      au-dessus des mois d'échéance (`echeance[i]`), barre en couleur pleine ces mois-là ;
    - périodique **au mois du paiement** (`PERIODIQUE`) : grande barre pleine les mois
      `impute`, mini-barre ailleurs ;
    - moment `INCONNU` : barres moyennes douces, pas de point ;
    - hors validité (`!estActif`) : opacité réduite.
- Une ligne d'en-tête : « Aperçu dès nov. 2026 » + une légende d'une ligne adaptée au cas.
- Couleurs : primaire et sa variante douce (token), `--app-line` pour le vide. `aria-hidden`
  sur la barre (l'information est déjà dans la fiche).
- Différence avec `app-echeancier-multi-annees` : celui-ci reste pour la liste ; le nouvel
  aperçu est volontairement plus simple et plus grand.

### 6.5 `app-poste-repartition` (feature)

Voir §7.5 pour les règles. API :

| API | Type |
|---|---|
| `membres` | `input.required<MembreDto[]>()` (actifs) |
| `comptes` | `input.required<CompteDto[]>()` |
| `partsAuto` | `input.required<Record<string, number>>()` (quote-parts du scénario, 0–1) |
| `montant` / `devise` | `input<number>()` / `input<string>()` |
| `valeur` | `model<RepartitionSaisie>()` |

```ts
interface RepartitionSaisie {
  typeRepartition: TypeRepartition;           // AUTO | REVERSE_AUTO | CUSTOM
  parts: Record<string, number>;              // membreId → % (0–100), utile si CUSTOM
  comptes: Record<string, string | null>;     // membreId → compteId
  comptesSepares: boolean;                    // UI : un compte par personne
}
```

### 6.6 `app-poste-fiche` (feature)

| API | Type |
|---|---|
| `titre` / `categorie` | `input<string>()` |
| `lignes` | `input.required<{ cle: EtapeCle; libelle: string; valeur: string \| null; etat: 'courante' \| 'faite' \| 'vide' }[]>()` |
| `impact` | `input<{ principal: string; secondaire: string }>()` |
| `naviguer` | `output<EtapeCle>()` |

- En-tête « Ta fiche » (muted, petites capitales), puis bloc **Poste** (nom en grand,
  catégorie dessous), puis **une ligne par étape** (pas une par champ) :
  libellé en petites capitales muted + valeur en `font-semibold`. Ligne `vide` : « … »
  muted, bouton désactivé. Ligne `courante` : fond `--app-card`, bordure primaire douce,
  `aria-current="step"`.
- Pied : « Impact sur le budget » + montant en grand (`tabular-nums`) + ligne secondaire.
- Le conteneur calcule les chaînes (pipes, i18n) ; la fiche ne fait qu'afficher.

---

## 7. Étapes

L'ordre et la présence sont définis dans `poste-form-etapes.ts` :

```ts
type EtapeCle = 'quoi' | 'combien' | 'validite' | 'paiement' | 'repartition' | 'analyse';
// 'paiement' n'existe que si periodiciteMois > 1
etapes = computed(() => ETAPES.filter(e => e !== 'paiement' || periodicite() > 1));
```

La navigation se fait **par clé** (pas par index), car la liste change quand la
périodicité change. `etapesVisitees = signal<Set<EtapeCle>>`.

| # | Clé | Titre (i18n) | Ligne de fiche | Contrôles du form |
|---|---|---|---|---|
| 1 | `quoi` | C'est pour quoi ? | *(bloc Poste)* | `description`, `categorieId` |
| 2 | `combien` | Combien ça coûte, et à quel rythme ? ¹ | **Montant** | `montant`, `devise`, `periodiciteMois`, `nature`, `estimPourcentage` |
| 3 | `validite` | Quelle est la période de validité ? ² | **Validité** | `debut`, `fin` |
| 4 | `paiement` | Comment est-il payé ? ³ | **Paiement** | `moment`, `mode` |
| 5 | `repartition` | Qui paie ? ⁴ | **Répartition** | `typeRepartition`, `repartitions[]`, `inclureProrataTheorique` |
| 6 | `analyse` | Une dernière chose, si tu veux | **Analyse · facultatif** | `importance`, `potentielOptimisation`, `deriveExterne` |

¹ Revenu : « Combien reçois-tu, et à quel rythme ? » · Réserve : « Combien mets-tu de
côté, et à quel rythme ? ».
² Ponctuel (`periodiciteMois = 0`) : « Quand ? ».
³ Revenu : « Comment est-il versé ? » · Réserve : « Comment le mets-tu de côté ? ».
⁴ Revenu : « Qui reçoit ? » · Réserve : « Qui épargne ? ».

### 7.1 Étape `quoi`
- `app-input-text` « Nom du poste », autofocus à l'ouverture en création (garder le
  mécanisme `onShow` actuel, cf. focus-trap du `p-dialog`).
- Catégories du type en **puces** (sélection unique, ordre du référentiel tel quel).
- **Aucune** pré-sélection, suggestion ou raccourci (cf. §2.2).
- Valide si `description` et `categorieId` sont renseignés.
- Fiche : titre = description (ou « Sans nom »), sous-titre = libellé catégorie (ou
  « Catégorie à choisir »).

### 7.2 Étape `combien`
- Montant : `app-input-number` grand (taille du texte ≈ `text-3xl`, aligné à droite,
  `minFractionDigits = 2`) + `app-select` devise (`devisesDisponibles`) sur la même ligne.
- « Tous les combien ? » : puces **Une fois (0) · Mensuel (1) · Trimestriel (3) ·
  Semestriel (6) · Annuel (12) · Autre…**.
  « Autre… » fait apparaître un `app-select` avec les autres périodicités
  (`periodiciteOptions` sans 0, 1, 3, 6, 12). En édition, une périodicité hors liste
  sélectionne « Autre… ».
- Ligne de conversion en direct (muted, montant en gras) :
    - 0 → « Un seul paiement de {montant}. »
    - 1 → « Soit {montant × 12} par an. »
    - > 1 → « Soit ≈ {montant ÷ périodicité} par mois. »
    - rien si montant vide.
- Case `app-checkbox` « Montant approximatif » ↔ `nature = ESTIMATION` ; cochée, elle
  affiche en ligne « marge ± [__] % » (`estimPourcentage`, pré-rempli à 10, garder l'effet
  existant).
- Valide si `montant ≥ 0,01` et `estimPourcentage` valide.
- Fiche **Montant** : « {montant devise} {rythme} » + « · ± {x} % » si estimation.
  Exemple : « 1 850,00 CHF chaque mois », « 480,00 CHF chaque année ».
  `rythme` : « une fois », « chaque mois », « chaque année », « tous les N mois ».

### 7.3 Étape `validite`
Ce sont les **dates de validité du contrat**, pas les dates de paiement.
- Sous-titre (périodique uniquement) : « Les dates du contrat ou de l'accord, pas
  forcément celles des paiements. »
- **Début du poste** (`app-choix-cartes`) :
    - « Ce mois » → 1er du mois courant (sous-titre : « 1er oct. 2026 ») ;
    - « Prochain mois » → 1er du mois suivant ;
    - « Autre date » → affiche un `app-date-picker` (sous-titre : la date choisie ou « Choisir… »).
      Dates calculées à partir de `new Date()` (jamais en dur). **Défaut en création :
      « Prochain mois »**. En édition : la carte correspondant à `debut` si elle tombe sur
      l'un des deux premiers cas, sinon « Autre date » + date pré-remplie.
      Ponctuel : même groupe, libellé « Date ».
- **Fin du poste** (périodique uniquement) : « Sans fin » (`fin = null`) · « Pendant 1 an »
  (= début + 1 an − 1 jour, sous-titre « jusqu'au 31 oct. ») · « Autre date » (date-picker).
- Pour un poste **ponctuel ou mensuel**, l'aperçu `app-poste-apercu-periodicite` est
  affiché ici (il n'y a pas d'étape Paiement).
- Valide si `debut` renseigné et pas d'erreur `finAvantDebut` (validateur existant).
- Fiche **Validité** : « Dès le 1er nov. 2026, sans fin » · « Dès le …, jusqu'au … » ·
  ponctuel : « Le 12 oct. 2026 ».

### 7.4 Étape `paiement` (seulement si `periodiciteMois > 1`)
- « Prélevé… » (Revenu : « Versé… », Réserve : « Mis de côté… ») — `app-choix-cartes` sur
  `moment` :
    - `DEBUT_PERIODE` « En début de période », sous-titre « en {mois du début} » ;
    - `FIN_PERIODE` « En fin de période », sous-titre « en {mois de début + périodicité − 1} » ;
    - `INCONNU` « Je ne sais pas », sous-titre « date inconnue ».
- « Dans le budget » — `app-choix-cartes` sur `mode` :
    - `MENSUALISE` « Lissé chaque mois », sous-titre « ≈ {montant ÷ périodicité} / mois » ;
    - `PERIODIQUE` « Le mois du paiement », sous-titre « {montant} en {mois d'échéance} » ;
      **désactivé** quand `moment = INCONNU` (règle existante : `INCONNU` impose
      `MENSUALISE`, garder l'effet `_forcerModeMensualiseSiMomentInconnu`).
- En dessous : `app-poste-apercu-periodicite`, qui réagit immédiatement aux deux choix.
- Toujours valide.
- Fiche **Paiement** : « Prélevé en déc. · lissé chaque mois » ·
  « Prélevé en janv. · compté ce mois-là » · « Date inconnue · lissé chaque mois ».

### 7.5 Étape `repartition`
Composant `app-poste-repartition`. Trois cas selon `membresActifs().length` :

**a) Foyer à 1 membre** : pas de curseur. Seulement le choix du compte (cartes) parmi
`comptesForMembre(membre)`. `typeRepartition = CUSTOM` avec 100 % (comportement actuel).

**b) Foyer à 2 membres** (cas principal, cf. prototype) :
- En-tête : avatar (couleur du membre) + « Dylan · 58 % » + montant de sa part, à gauche ;
  idem pour l'autre membre à droite.
- `<input type="range" min=0 max=100 step=1>` = part du **premier** membre
  (`aria-valuetext` « Dylan 58 %, Camille 42 % »), `accent-color: var(--p-primary-color)`.
- Préréglages en puces : **Tout {A}** (100) · **Au prorata** (part AUTO de A) ·
  **50 / 50** · **Inversé** (part REVERSE_AUTO de A) · **Tout {B}** (0).
- Correspondance avec le modèle :

| Saisie | `typeRepartition` | `repartitions` envoyées |
|---|---|---|
| préréglage « Au prorata », ou curseur = part AUTO | `AUTO` | aucune |
| préréglage « Inversé », ou curseur = part REVERSE_AUTO | `REVERSE_AUTO` | aucune |
| « 50 / 50 » ou toute autre valeur entre 1 et 99 | `CUSTOM` | `[A: v, B: 100 − v]` |
| 100 ou 0 (« Tout A » / « Tout B ») | `CUSTOM` | une seule ligne à 100 % |

Les parts AUTO viennent de `contexte.scenarioCourant()?.repartitions` (comme dans
`appliquerRepartitionSelection()` actuel). Si AUTO vaut 50, le préréglage « 50 / 50 »
force `CUSTOM` ; un glissement du curseur sur 50 donne `AUTO` (le prorata est prioritaire).
- Le curseur met à jour les valeurs affichées **en direct** (`input`) ; les préréglages
  et l'état sélectionné se recalculent au relâchement (`change`).

**c) Foyer à 3 membres ou plus** : pas de curseur. Cartes membres à cocher (au moins un),
puis `app-choix-cartes` « Au prorata / Prorata inversé / Personnalisé » avec, en
sous-titre, le montant de chacun ; en « Personnalisé », un `app-input-number` (%) par
membre et le total en direct (vert si 100 %, rouge sinon), avec
`arrondirSommeRepartition` / `sommeRepartitionValide`.

**Comptes** (dans les cas b et c) :
- Si tous les membres concernés passent par **le même compte** et qu'un compte est commun
  à tous (`compte.membreIds` contient chacun) : un seul groupe de cartes « Payé depuis »
  (Revenu : « Versé sur », Réserve : « Mis de côté sur ») avec les comptes communs, et un
  lien « Chacun depuis un compte différent ».
- Sinon : un groupe de cartes par membre (« Payé depuis · Dylan »), filtré par
  `comptesForMembre()`, et un lien « Le même compte pour tous ».
- Un compte est requis pour chaque membre qui porte une part > 0 (règle
  `definirValiditeCompte` existante).

**Revenu, foyer à plusieurs membres** : `app-checkbox` « Compter ce revenu dans le prorata
du foyer » (`inclureProrataTheorique`), comme aujourd'hui.

- Valide si chaque membre portant une part a un compte et, en `CUSTOM` à 3 membres ou plus,
  si la somme fait 100 %.
- Fiche **Répartition** : « Dylan 58 % · Camille 42 % · Compte joint » ·
  « Dylan · Compte perso Dylan » (un seul membre) · sans le compte s'il diffère par membre.

### 7.6 Étape `analyse` (facultative)
- Sous-titre : « Tu peux enregistrer sans y toucher. »
- Trois `app-echelle-notation` :
    - Importance : question « Peut-on s'en passer ? », min/max = `t.poste.importanceMin|Max` ;
    - Potentiel d'optimisation : « Peut-on payer moins ? », `t.poste.potentielOptimisationMin|Max` ;
    - Dérive externe : « Le montant évolue-t-il sans nous ? », **1 = forte baisse,
      3 = neutre, 5 = forte hausse** (`t.poste.deriveExterneMin|Max`).
- Valeurs par défaut 3 (inchangé). Toujours valide.
- Fiche **Analyse · facultatif** : « Importance 3 · Optimisation 3 · Dérive 3 ».

---

## 8. Navigation et comportements

- **Continuer** : valide l'étape courante (`etapeValide(cle)`) ; si invalide, marque ses
  contrôles `touched`, affiche les erreurs sous les champs et place le focus sur le
  premier champ invalide. Sinon passe à l'étape suivante et l'ajoute aux visitées.
- **Retour** (chevron de `app-step-progress`) : toujours permis.
- **Fiche** : une ligne n'est cliquable que si son étape est visitée ou courante ; aller
  vers une étape plus loin valide les étapes intermédiaires (même règle que `allerA`).
- **Entrée** dans un champ texte/numérique = Continuer (ou Enregistrer à la dernière étape).
  **Échap** = fermer, avec la confirmation existante si le formulaire est `dirty`.
- Changer la périodicité à l'étape `combien` fait apparaître ou disparaître l'étape
  `paiement` ; la barre de progression et la fiche suivent.
- À chaque changement d'étape : défilement de la colonne question en haut, focus sur le
  premier élément interactif de l'étape.
- Fiche et barre mobile se mettent à jour **en direct** (`formValue` signal existant).
- **Création** : ouverture sur `quoi`, seule `quoi` est visitée.
- **Édition** : `initialiserEdition()` existant, toutes les étapes visitées, ouverture sur
  `quoi`, `Enregistrer` disponible à chaque étape, pas d'autofocus surprise.
- **Enregistrer et nouveau** : comportement actuel (`reinitialiserPourNouveau()` : vide
  description, montant et fin, garde le reste, revient à `quoi`, toast de succès).
- Si l'enregistrement échoue en validation : aller à la première étape fautive
  (`premiereEtapeFautive()` adapté aux clés).

---

## 9. Ce qui ne change pas

- Le `FormGroup` actuel (mêmes contrôles et validateurs, `datesCoherentesValidator`).
- La construction du `PosteRequest` dans `enregistrer()` (repartitions seulement en
  `CUSTOM`, ventilations = comptes renseignés, `mode` forcé à `MENSUALISE` si ponctuel ou
  moment inconnu, `fin` ignorée si ponctuel, `inclureProrataTheorique` pour REVENU).
- Les effets existants : chargement des comptes, pré-remplissage 10 % en estimation,
  verrouillage du mode si moment inconnu, confirmation de fermeture si `dirty`,
  réinitialisation à la fermeture en création.

À **supprimer** : `p-stepper`, `frequenceChoisie` / `sousFrequence` (remplacés par les
puces de périodicité), l'étape « Récapitulatif », les `p-slider` 1–5, le centrage
`_centrerEtapeActive`.

---

## 10. Clés i18n à ajouter (fr)

À placer sous `poste.form` (ou adapter au schéma de `i18n.types.ts`), avec leur
équivalent dans `en.json`.

```json
{
  "poste": {
    "form": {
      "titreCreation": "Nouveau poste",
      "titreEdition": "Modifier le poste",
      "taFiche": "Ta fiche",
      "voirFiche": "Voir la fiche",
      "ficheAide": "Touche une ligne pour la modifier",
      "sansNom": "Sans nom",
      "categorieAChoisir": "Catégorie à choisir",
      "impact": "Impact sur le budget",
      "continuer": "Continuer",
      "allerFin": "Aller à la fin",
      "aideEntree": "Appuie sur Entrée",
      "etapes": {
        "quoi": "C’est pour quoi ?",
        "combien": { "CHARGE": "Combien ça coûte, et à quel rythme ?", "REVENU": "Combien reçois-tu, et à quel rythme ?", "RESERVE": "Combien mets-tu de côté, et à quel rythme ?" },
        "validite": "Quelle est la période de validité ?",
        "validitePonctuel": "Quand ?",
        "paiement": { "CHARGE": "Comment est-il payé ?", "REVENU": "Comment est-il versé ?", "RESERVE": "Comment le mets-tu de côté ?" },
        "repartition": { "CHARGE": "Qui paie ?", "REVENU": "Qui reçoit ?", "RESERVE": "Qui épargne ?" },
        "analyse": "Une dernière chose, si tu veux"
      },
      "fiche": { "montant": "Montant", "validite": "Validité", "paiement": "Paiement", "repartition": "Répartition", "analyse": "Analyse · facultatif" },
      "nomPoste": "Nom du poste",
      "frequence": "Tous les combien ?",
      "frequences": { "0": "Une fois", "1": "Mensuel", "3": "Trimestriel", "6": "Semestriel", "12": "Annuel", "autre": "Autre…" },
      "rythme": { "0": "une fois", "1": "chaque mois", "12": "chaque année", "n": "tous les {{n}} mois" },
      "convPonctuel": "Un seul paiement de {{montant}}.",
      "convMensuel": "Soit {{montant}} par an.",
      "convPeriodique": "Soit ≈ {{montant}} par mois.",
      "approximatif": "Montant approximatif",
      "marge": "marge ±",
      "validiteAide": "Les dates du contrat ou de l’accord, pas forcément celles des paiements.",
      "debutPoste": "Début du poste",
      "date": "Date",
      "ceMois": "Ce mois",
      "prochainMois": "Prochain mois",
      "autreDate": "Autre date",
      "choisir": "Choisir…",
      "finPoste": "Fin du poste",
      "sansFin": "Sans fin",
      "sansFinAide": "Jusqu’à nouvel ordre",
      "unAn": "Pendant 1 an",
      "jusquAu": "jusqu’au {{date}}",
      "verbe": { "CHARGE": "Prélevé", "REVENU": "Versé", "RESERVE": "Mis de côté" },
      "momentDebut": "En début de période",
      "momentFin": "En fin de période",
      "momentInconnu": "Je ne sais pas",
      "dateInconnue": "date inconnue",
      "enMois": "en {{mois}}",
      "dansBudget": "Dans le budget",
      "lisse": "Lissé chaque mois",
      "lisseAide": "≈ {{montant}} / mois",
      "moisPaiement": "Le mois du paiement",
      "moisPaiementAide": "{{montant}} en {{mois}}",
      "apercuDes": "Aperçu dès {{mois}}",
      "legende": {
        "ponctuel": "Le montant tombe une seule fois.",
        "mensuel": "Le même montant chaque mois.",
        "lisse": "Barres : part mensuelle · point : mois du paiement.",
        "periodique": "Le montant entier compte le mois du paiement.",
        "inconnu": "Date inconnue : réparti sur chaque mois."
      },
      "resumeValidite": { "debutSansFin": "Dès le {{debut}}, sans fin", "debutFin": "Dès le {{debut}}, jusqu’au {{fin}}", "ponctuel": "Le {{date}}" },
      "resumePaiement": { "lisse": "{{verbe}} en {{mois}} · lissé chaque mois", "periodique": "{{verbe}} en {{mois}} · compté ce mois-là", "inconnu": "Date inconnue · lissé chaque mois" },
      "toutMembre": "Tout {{nom}}",
      "auProrata": "Au prorata",
      "cinquante": "50 / 50",
      "inverse": "Inversé",
      "depuis": { "CHARGE": "Payé depuis", "REVENU": "Versé sur", "RESERVE": "Mis de côté sur" },
      "comptesSepares": "Chacun depuis un compte différent",
      "compteCommun": "Le même compte pour tous",
      "analyseAide": "Tu peux enregistrer sans y toucher.",
      "questionImportance": "Peut-on s’en passer ?",
      "questionOptimisation": "Peut-on payer moins ?",
      "questionDerive": "Le montant évolue-t-il sans nous ?",
      "noteSur5": "{{label}} : {{n}} sur 5"
    }
  }
}
```

Réutiliser les clés existantes quand elles conviennent (`commun.annuler`,
`commun.enregistrer`, `commun.enregistrerEtNouveau`, `commun.champObligatoire`,
`poste.importance*`, `poste.potentielOptimisation*`, `poste.deriveExterne*`,
`poste.inclureProrataTheorique`, `poste.finAvantDebut`, `commun.repartitionInvalide`…).
Montants : `MontantPipe` ; mois et dates : `Intl` / pipes existants (pas de tableau de
mois en dur).

---

## 11. Repères visuels (rôles → tokens)

| Élément | Style |
|---|---|
| Titre de question | `text-2xl font-bold`, `--app-ink`, `text-wrap: balance` |
| Labels de groupe | `text-sm font-semibold`, `--app-ink-muted` |
| Petites capitales (fiche, en-têtes) | `text-xs font-bold uppercase tracking-wide`, `--app-ink-muted` |
| Bordures, séparateurs | `--app-line` (repos), `--app-line-3` (contrôles) |
| Sélection | bordure 2 px `--p-primary-color` + fond token « sélectionné » |
| Fond fiche / barre mobile / tiroir | `--app-bg` |
| Badge type | `--app-revenu|charge|reserve` sur `-bg`, `--app-radius-pill` |
| Rayons | cartes `--app-radius-card`, champs `--app-radius-item`, puces `--app-radius-pill` |
| Erreurs | `p-message severity="error"` (comme aujourd'hui) ou `--app-danger` / `--app-danger-bg` |
| Montants | `tabular-nums` |
| Espacements | utilitaires Tailwind (`gap-2/3/5`, `p-4/6`), pas de marges unitaires |

---

## 12. Definition of Done

- [ ] Création et édition passent par la nouvelle popin ; `postes-liste` inchangé.
- [ ] Payload `PosteRequest` identique à l'actuel pour les mêmes saisies (tester au moins :
  charge mensuelle commune au prorata, assurance annuelle lissée fin de période,
  revenu d'un seul membre, ponctuel, répartition CUSTOM 70/30, foyer mono-membre,
  foyer à 3 membres en CUSTOM).
- [ ] L'étape Paiement apparaît/disparaît avec la périodicité ; la fiche et la barre de
  progression suivent.
- [ ] L'aperçu utilise `imputations()` / `estActif()` et réagit au moment et au mode.
- [ ] Aucun texte en dur, clés fr + en ajoutées.
- [ ] Aucune couleur/rayon/police en dur ; tokens ajoutés dans `_app-tokens.css` si besoin ;
  rendu correct en clair et en `.dark`.
- [ ] Pas de pré-sélection de catégorie, pas de raccourcis.
- [ ] Mobile < 768 px : plein écran, fiche en tiroir, boutons pleine largeur.
- [ ] Clavier : Entrée, Échap, Tab ; `aria-pressed`, `aria-current`, `progressbar`.
- [ ] Tests unitaires des nouveaux composants partagés (`step-progress`, `choix-cartes`,
  `echelle-notation`) et de la correspondance curseur → `typeRepartition` (§7.5).
- [ ] `npm run build` et `npm test` passent (cf. `.github/copilot-instructions.md`).