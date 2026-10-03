# Mission : refonte responsive et centralisation des styles de l'application Angular

Tu es un développeur front-end senior expert Angular, CSS/SCSS moderne et design systems.
Ta mission est de rendre toute l'application responsive et de centraliser ses styles selon
les meilleures pratiques actuelles (state of the art) des projets web professionnels.

## Contraintes d'écran
- Largeur minimale supportée (mobile) : **435px**. Aucun débordement horizontal, aucun élément
  coupé ou illisible à cette largeur.
- Largeur maximale du contenu (desktop) : **1360px**. Au-delà, le contenu reste centré dans
  un conteneur de 1360px max, sans s'étirer.
- Entre les deux, la mise en page doit s'adapter de manière fluide (pas seulement 2 états figés).
- Approche **mobile-first** : styles de base pour mobile, puis enrichis via `min-width`.

## Phase 1 — Audit approfondi (avant toute modification)
Analyse l'ensemble du projet en profondeur :
1. Lis `angular.json`, `styles.scss` (ou équivalent), et TOUS les fichiers de styles des
   composants (`*.scss`, `*.css`, styles inline dans les `@Component`, attributs `style=""`
   et `[ngStyle]` dans les templates).
2. Inventorie toutes les valeurs en dur : couleurs (hex, rgb, noms), polices, tailles de
   police, graisses, interlignes, espacements (margin/padding/gap), border-radius, ombres,
   z-index, largeurs/hauteurs fixes en px, breakpoints/media queries existants.
3. Identifie les doublons et les valeurs quasi identiques à fusionner (ex. #333 et #343434).
4. Repère tout ce qui casse en responsive : largeurs fixes, tableaux larges, `position:
   absolute` fragiles, images non fluides, flex sans wrap, textes qui débordent, modales,
   menus/navigation, formulaires.
5. Vérifie si une librairie UI est utilisée (Angular Material, PrimeNG, Bootstrap, Tailwind…)
   et adapte la stratégie pour t'intégrer à son système de theming plutôt que de le combattre.

Produis un court résumé de cet audit et du plan avant de commencer les modifications.

## Phase 2 — Architecture de styles centralisée
Crée une structure claire, par exemple :

src/styles/
abstracts/
_tokens.scss        → design tokens exposés en CSS custom properties (:root)
_breakpoints.scss   → valeurs des breakpoints + mixins (ex. @include respond-to(md))
_mixins.scss        → mixins utilitaires (container, truncate, focus-visible…)
_functions.scss     → fonctions éventuelles (rem(), etc.)
_index.scss         → @forward de tout le dossier abstracts
base/
_reset.scss         → reset/normalize moderne (box-sizing, img fluides, etc.)
_typography.scss    → styles typographiques globaux (body, h1–h6, p, a…)
layout/
_container.scss     → conteneur centré max 1360px avec gouttières fluides
_grid.scss          → utilitaires de grille/flex si utiles
styles.scss           → point d'entrée unique qui assemble le tout

Règles :
- **Design tokens en CSS custom properties** (`--color-primary`, `--font-size-lg`,
  `--space-4`, `--radius-md`…) pour permettre un theming runtime (ex. mode sombre futur).
- Couleurs : palette nommée sémantiquement (primary, secondary, surface, text, text-muted,
  border, success, warning, danger…), pas par teinte (« blue-dark »).
- Typographie : familles de polices centralisées, échelle de tailles cohérente en `rem`,
  **typographie fluide avec `clamp()`** entre 435px et 1360px. Interlignes et graisses en tokens.
- Espacements : échelle cohérente (ex. base 4px ou 8px) en `rem`.
- Breakpoints définis UNE seule fois et utilisés uniquement via les mixins.
- Utilise le module system Sass moderne (`@use` / `@forward`), jamais `@import`.
- Configure `stylePreprocessorOptions.includePaths` dans `angular.json` pour que les
  composants puissent faire `@use 'abstracts' as *;` proprement.
- Privilégie les techniques modernes : Flexbox, CSS Grid (`auto-fit`/`minmax()`),
  `clamp()`, `min()`/`max()`, unités logiques, `aspect-ratio`, et les **container queries**
  lorsqu'un composant doit s'adapter à son conteneur plutôt qu'à l'écran.

## Phase 3 — Application sur toutes les pages et composants
- Remplace TOUTES les valeurs en dur par les tokens/mixins correspondants, dans chaque
  composant, sans exception.
- Supprime les styles inline et `[ngStyle]` purement décoratifs au profit de classes.
- Garde l'encapsulation des styles Angular ; évite `::ng-deep` (si inévitable, justifie-le
  en commentaire et limite sa portée avec `:host`).
- Si une logique responsive est nécessaire côté TypeScript, utilise `BreakpointObserver`
  d'Angular CDK avec les mêmes valeurs de breakpoints que le SCSS.
- Adapte les éléments complexes : navigation (menu burger en mobile si pertinent),
  tableaux (scroll horizontal maîtrisé ou affichage en cartes), formulaires (champs pleine
  largeur en mobile), modales, images et médias.
- Préserve le rendu visuel actuel sur desktop autant que possible : l'objectif est de
  structurer et rendre responsive, pas de redesigner.
- Respecte l'accessibilité de base : zones tactiles ≥ 44px en mobile, contrastes conservés,
  `:focus-visible` visible, pas de taille de police < 16px sur les inputs mobiles.

## Phase 4 — Revues successives (obligatoire)
Une fois le travail terminé, relis l'ensemble au moins **3 fois**, avec un angle différent
à chaque passage :
1. **Revue d'exhaustivité** : recherche dans tout le projet (regex) les valeurs restées en
   dur : `#[0-9a-fA-F]{3,8}`, `rgb(`, `rgba(`, `hsl(`, `font-size:`, `font-family:`,
   `px` hors tokens, `@media` hors mixins, `style="`, `[ngStyle]`. Corrige chaque occurrence
   ou justifie-la.
2. **Revue responsive** : pour chaque page/route, vérifie mentalement le rendu à 435px,
   ~768px, ~1024px et 1360px+ : débordements, chevauchements, textes coupés, éléments
   inaccessibles.
3. **Revue de cohérence et qualité** : tokens réellement utilisés (supprime les inutilisés),
   nommage homogène, pas de doublons, pas de code mort, l'application compile
   (`ng build`) sans erreur ni nouveau warning.
   Si une revue révèle des oubli, corrige-les puis recommence la revue concernée.

## Hors périmètre
- Pas de tests unitaires, e2e ou autres tests.
- Pas de changement de logique métier ni de structure des composants au-delà du nécessaire.

## Livrable final
Termine par un récapitulatif concis : architecture de styles mise en place, liste des
tokens créés, composants modifiés, points délicats traités, et éventuelles limites ou
éléments qui nécessitent une décision de ma part.