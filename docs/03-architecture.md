# 03 — Architecture

> Architecture backend/frontend, sécurité multi-tenant, multi-devises, i18n et structure
> des projets.

> **Décisions gouvernées par ce doc** : découpage en packages, isolation du moteur, stratégie de sécurité multi-tenant, cache, multi-devises, i18n, configuration et couplage PrimeNG/Tailwind.

---

## 1. Vue macro
```
Angular 22 + PrimeNG 22 + Tailwind v4        Spring Boot 4 (Java 21)
(SPA standalone, signals)   ── REST+JWT ──▶   API stateless
                            ◀── JSON DTO ──    ┌ MoteurCalcul (pur) ┐
                                                └──────────┬────────┘
                                                     JPA / Flyway
                                                           ▼
                                                     PostgreSQL 16
```
Principes : **API stateless** (JWT), **moteur de calcul isolé et testable**,
**multi-tenant par foyer**, **DTO ≠ entités** (MapStruct), **schéma géré par Flyway**.

## 2. Stack

| Couche | Choix |
|---|---|
| Backend | Spring Boot **4.0.0**, Java **21** (Web, Data JPA, Security, Validation) |
| Persistance | PostgreSQL **16+**, Flyway (migrations versionnées), `ddl-auto=validate` |
| Mapping | MapStruct, Lombok (DTO ⇄ entités) |
| Doc API | springdoc-openapi (Swagger UI `/swagger-ui.html`) |
| Auth | JWT access + refresh, BCrypt |
| Frontend | Angular **22** (standalone, signals, strict) |
| UI Kit | PrimeNG **22.x**, PrimeIcons, thème par tokens (preset Aura) |
| CSS | Tailwind CSS **v4** couplé via `tailwindcss-primeui` + CSS layers (remplace PrimeFlex) |
| Graphiques | Chart.js via `p-chart` |
| i18n | ngx-translate (`fr.json`/`en.json`) + `Intl` |

> Socles **imposés** : Spring Boot 4, Angular 22, PrimeNG 22, Tailwind v4. Pour les autres
> dépendances, garder la dernière version stable compatible.

## 3. Backend — package-by-feature

Sous `ch.homely` (`src/main/java/ch/homely`) : chaque feature = `controller` → `service`
→ `repository` + `dto` + `mapper` (MapStruct) + `entity`.
```
ch.homely
├── config/       SecurityConfig, CorsConfig, OpenApiConfig, JpaConfig, CacheConfig
├── securite/     JwtService, JwtAuthFilter, MultiTenantService (scoping + rôles)
├── commun/       GlobalExceptionHandler (@RestControllerAdvice), exceptions, ApiError
├── utilisateur/  Utilisateur, AuthService/Controller (register/login/refresh/logout/moi)
├── foyer/        Foyer, AccesFoyer, FoyerService (onboarding atomique)
├── membre/       Membre + CRUD
├── compte/       Compte + compte_membre (N-N) + CRUD
├── categorie/    Categorie + CRUD
├── taux/         TauxChange + CRUD
├── scenario/     Scenario, RepartitionPeriode/Part, duplication/référence
├── poste/        Poste, RepartitionPoste, VentilationCompte, PosteValidator,
│                 PosteService (reviser/annuler/decaler/cloturer/reactiver)
├── poche/        PolitiqueArgentPoche, AllocationArgentPoche, ArgentPocheService
├── dashboard/    Seuils d'interprétation du dashboard (config, sans logique moteur)
├── moteur/       ★ MoteurCalcul (pur, records immuables) + événements + argent de poche
└── projection/   ProjectionService (cache Caffeine) + controllers (annuelle,
                  tresorerie, tresorerie-cumulee, mensuelle, evenements, taux-effort, apercu poste)
```

### 3.1 Module `moteur` (critique)
- **Aucune dépendance** à Spring, JPA ou l'horloge (dates passées en paramètre). Entrées =
  records (`PosteCalcul`, `RepartitionCalcul`, `ParametresScenario`) ; sorties =
  `ProjectionAnnuelle`, `ProjectionPluriannuelle`, `Ventilations`, etc.
- Implémente **exactement** [doc 01](01-principes-et-moteur.md) ; testé par les vecteurs
  golden (JUnit 5 + AssertJ), couverture **> 90 %**. Ne régresse jamais.
- Le module `projection` fait le pont : charge le scénario (JPA, fetch joints anti-N+1),
  mappe vers les records, appelle le moteur, mappe en DTO, gère le cache.

### 3.2 Cache & logique métier
- Cache Caffeine clé `(scenarioId, versionScenario)`, invalidé à chaque modification de
  poste/hypothèse.
- **Règle** : tout calcul dérivé des règles métier (quote-part effective, proratisation,
  conversions, argent de poche…) est calculé **une seule fois côté backend** (dans
  `moteur` ou un service réutilisant `moteur`) et exposé tel quel via DTO. Le frontend
  **affiche**, il ne ré-implémente jamais une formule métier en TypeScript.

## 4. Sécurité & multi-tenant

- **JWT** : access token (15 min, HMAC-SHA256) + refresh opaque (rotation, 7 j, en base
  `token_refresh`, transmis via **cookie httpOnly/Secure/SameSite=Strict** — jamais en
  JSON). Mots de passe **BCrypt**.
- Endpoints publics : `/api/auth/{register,login,refresh,logout}`. Tout le reste exige un
  token valide.
- **Autorisation** : chaque requête cible un foyer (`/api/foyers/{foyerId}/…`).
  `MultiTenantService` vérifie l'`AccesFoyer` et applique le rôle : `VIEWER` (lecture),
  `EDITOR` (+ écriture), `OWNER` (+ gestion des accès, suppression du foyer).
- **Scoping systématique** : toute requête repository filtre par `foyerId` (ou
  `scenarioId` du foyer). **Ne jamais** exposer une entité d'un autre foyer — test de
  sécurité d'accès croisé **obligatoire** (403/404). Toute tentative inter-foyers est
  journalisée.
- CORS restreint par `CORS_ORIGINS`. Erreurs uniformisées via `GlobalExceptionHandler` →
  `ApiError` + code métier stable.

## 5. Multi-devises

Le foyer définit `deviseBase`. Conversion **prévisionnelle** (taux fixes dans
`taux_change`), appliquée par le moteur (doc 01 §6). L'API de projection renvoie des
montants en `deviseBase` (nombres bruts) ; le **formatage** (symbole, séparateurs) est
fait côté frontend via `Intl.NumberFormat`.

## 6. Internationalisation

- FR par défaut, FR/EN disponibles. Traductions dans `frontend/src/assets/i18n/<lang>.json`
  (mêmes clés), chargées via **ngx-translate**. **Aucun texte en dur** dans les composants.
- `I18nService` encapsule `TranslateService` (langue courante en signal, langues
  disponibles, changement de langue). Chaque composant expose `t = this.i18n.translations()`
  pour un accès typé `t.nav.xxx`. Interpolation via `I18nService.instant(cle, params)`.
- Le choix de langue (et le thème clair/sombre) sont des préférences UI persistées en
  `localStorage` — **jamais** de donnée métier applicative en storage.
- Dates/nombres/devises formatés via `Intl` ; le backend renvoie ISO-8601 + nombres bruts.

## 7. Frontend — architecture Angular

- Angular 22, **standalone components** (pas de NgModule), **signals**, Router lazy par
  feature, strict mode TS.
- PrimeNG 22 (tables, dialogs, selects, datepicker, chart…), thème par **tokens** (preset
  Aura). Tailwind v4 = layout/espacement/responsive.
- Services HTTP typés (un par ressource) + **interceptor JWT** (ajout token, refresh
  transparent sur 401) + **interceptor date** (décalage fuseau `p-datepicker` ↔ backend).
- **State** : `ContexteService` (signals globaux « foyer / scénario courant ») ; chaque
  feature gère son état local en signals (pas de store type NgRx).
```
frontend/src/app
├── core/     guards, interceptors (jwt, date), services (ContexteService, I18nService…),
│             pipes (montant/date/pct/périodicité), constants, models
├── shared/   composants réutilisables (button, carte-info, indicateurs/*, liste/*,
│             carte-bilan, tag, metric-ring, event-grid, taux-effort-card) —
│             `button`/`tag` wrappent
│             `p-button`/`p-tag` (API restreinte au sous-ensemble utilisé, `tag` supporte
│             `severity` PrimeNG, `ton` de la charte, ou une couleur libre — dans cet
│             ordre de priorité)
├── shell/    topbar, sidebar-menu, foyer-scenario-switcher
└── features/ auth, foyer, referentiels, scenarios, postes, argent-poche, dashboard,
              parametres
```

### 7.1 Couplage PrimeNG + Tailwind v4
Suivre le guide officiel `primeng.dev/tailwind` :
```scss
@use "primeicons/primeicons.css";
@use "tailwindcss";
@plugin "tailwindcss-primeui";
@layer tailwind, primeng;
```
```ts
providePrimeNG({ theme: { preset: Aura, options: {
  cssLayer: { name: 'primeng', order: 'tailwind, primeng' },
  darkModeSelector: '.app-dark'
}}})
```
- Le layer `primeng` se place **après** `base` mais **avant** les utilitaires Tailwind
  (surcharge sans le préfixe `!`). Utiliser les tokens partagés (`bg-primary`,
  `text-surface-*`). `darkModeSelector` aligné sur la variante `dark` de Tailwind.
- Ne pas utiliser PrimeFlex (legacy).

### 7.1 bis Charte couleur — aucune couleur en dur

**Source unique de vérité** : `frontend/src/styles/_app-tokens.css`. Tout le frontend
consomme ces tokens, **jamais** une couleur littérale.

| Interdit | À utiliser |
|---|---|
| `text-red-500`, `bg-amber-200`, `text-green-600`… (palette Tailwind) | classe utilitaire de `_base.css` ou `var(--app-…)` |
| `var(--p-blue-400)`, `var(--p-red-500)`… (palette PrimeNG brute) | le token `--app-*` correspondant |
| `#EF5350`, `rgb(66 165 245 / .39)`… | `resolveAppColor('--app-…')` / `withAlpha()` pour Chart.js |

Tokens métier (texte **et** fond) :
`--app-revenu`, `--app-charge`, `--app-reserve`, `--app-argent-poche`, `--app-neutre`,
chacun doublé d'un `--app-…-bg` (fond doux opaque). Feedback UI : `--app-success`,
`--app-warning`, `--app-alert`, `--app-danger`, `--app-info` (+ `-bg`). Échelle ordinale
1→5 (importance, potentiel d'optimisation, dérive externe, nécessité) :
`--app-echelle-1..5` (+ `-bg`) — divergente, centrée sur le palier 3 neutre.

**Surface ≠ texte.** Une couleur pleine est calibrée pour des *surfaces* (barres, segments,
pastilles) ; en texte elle n'a pas un contraste suffisant (le jaune `attention` tombe à
1,17:1 sur son propre fond doux). Trois fonctions, trois usages :

| Fonction (`tons.ts`) | Usage |
|---|---|
| `couleurPleine(ton)` | surface pleine : barre, segment, pastille, trait de courbe |
| `couleurDouce(ton)` | surface atténuée : piste, fond d'en-tête, barre non surlignée |
| `couleurForte(ton)` | surface foncée portant du **texte blanc** (cellule de heatmap) |
| `couleurTexte(ton)` | **toute couleur de texte** : badge, tag, libellé coloré |

`couleurTexte` mélange vers `--app-contraste-texte` (noir en clair, blanc en sombre) et
tient le contraste AA dans les deux thèmes.

Classes utilitaires correspondantes (`_base.css`, layer `components`) :
`.montant-revenu`, `.montant-charge`, `.montant-reserve`, `.montant-argent-poche`,
`.montant-neutre`, `.montant-positif`, `.montant-negatif`, `.texte-principal`,
`.texte-attenue`, `.texte-succes`, `.texte-attention`, `.texte-alerte`, `.texte-danger`,
`.texte-info`, `.texte-echelle-1..5`. Les préférer aux `text-[var(--app-…)]` arbitraires.
⚠️ Elles vivent dans le layer `components` : ne pas laisser sur le même élément une
utilitaire Tailwind de couleur (layer `utilities`, prioritaire), qui les écraserait.

Règles de choix :
- Une ligne qui porte un **type de poste connu** (REVENU/CHARGE/RESERVE/ARGENT_POCHE)
  prend le token de ce type, pas le token de signe.
- Un **solde / reste à vivre** s'affiche toujours en `--app-neutre`, quel que soit son
  signe : c'est un résultat, pas un jugement. `--app-positif`/`--app-negatif` ne servent
  que lorsqu'aucun type métier n'est disponible (variation, écart).
  *Exception* : dans une **liste d'alerte** qui ne contient par construction que des
  éléments en difficulté (ex. « les mois déficitaires » du drawer Mois à risque), le
  montant peut rester rouge — c'est la liste entière qui est le signal.
- Une donnée **sans sens métier** (segments d'un donut, séries) prend la palette
  catégorielle via `tons.ts` (`couleurPleine('categorie-N')`), jamais une teinte libre.
- Une **échelle de zones** se décline toujours dans l'ordre
  `succes → attention → alerte → danger` (vert → jaune → orange → rouge). `alerte`
  (orange) n'existant pas dans les sévérités PrimeNG, un tag de zone s'alimente par
  `[ton]` (voir `app-tag`) et non par `[severity]`.

Restent **hors charte** (dynamiques, posées en style inline) : la couleur de membre
(`dto.couleurMembre`) et celle de scénario.

### 7.1 ter Typographie — une seule échelle, quatre rôles de donnée

**Source unique de vérité** : `frontend/src/styles/_typographie.css`.

La rampe de Tailwind y est **remappée sur la charte** via `@theme`
(`--text-sm: var(--app-text-sm)`, …). Conséquence : `class="text-sm"` et
`font-size: var(--app-text-sm)` donnent exactement la même taille. Sans ce remappage les
deux divergeaient sous le même nom (`text-sm` = 14px vs `--app-text-sm` = 12px,
`text-lg` = 18px vs 16px), ce qui était la principale source d'hétérogénéité.

Deux couches, deux usages :

- **`--app-text-*`** (couche primitive, 10 paliers) — le *chrome* : titres, labels,
  légendes, boutons, aides de saisie, graduations d'axe, unités accolées à un chiffre.
- **`--app-donnee-*`** (couche sémantique, 4 rôles) — **toute valeur chiffrée**. Ne crée
  aucune valeur nouvelle : elle donne un rôle aux paliers existants.

| Token | Mobile → desktop | Rôle | Exemples |
|---|---|---|---|
| `--app-donnee-xl` | 24 → 32px | **Chiffre héros** — LA valeur qui justifie la carte | nombre+tendance, sparkline, double courbe, niveau, comparaison à 1 élément, solde d'une carte bilan |
| `--app-donnee-lg` | 20 → 24px | **Valeur mise en avant** | centre de donut/anneau, total de jauge, total de sous-en-tête |
| `--app-donnee-md` | 15 → 16px | **Montant de ligne** | entonnoir, tableau de comparaison, progression, virements, matrice, événements, décomposition |
| `--app-donnee-sm` | 12 → 13px | **Valeur dense** | valeur de légende, badge de variation |

Classes utilitaires équivalentes pour les templates (`_base.css`) : `.montant-heros`,
`.montant-avant`, `.montant-ligne`, `.montant-dense` — elles posent aussi la graisse et
`tabular-nums`. Elles se combinent avec les classes de couleur (`.montant-charge`…).

**Invariants :**
- une carte porte **au plus un** `--app-donnee-xl` ; s'il y en a deux, l'une n'est pas la
  valeur principale ;
- le chiffre principal d'une carte est **toujours plus grand que son titre** (13px) ;
- toute valeur chiffrée porte `font-variant-numeric: tabular-nums` ;
- sous **240px de conteneur**, chaque rôle descend d'un cran (`xl→lg`, `lg→md`, `md→sm`)
  via une container query portée par le composant. Le tableau de `app-indicateur-comparaison`
  compacte plus tôt (440px) : il a 4 colonnes.

⚠️ **Texte dans un SVG** : `font-size` y est exprimé en *unités utilisateur*, donc mis à
l'échelle avec le `viewBox` — une valeur déclarée à 14px rendait entre 12 et 17px selon la
largeur de la carte. Toute valeur lisible doit être un **élément HTML superposé**, jamais
un `<text>` SVG (voir `app-indicateur-donut`, et les libellés d'axe de
`app-indicateur-courbes-multiples` / `app-indicateur-barres-ligne`).

Les anciens `--app-text-chiffre-*` (unités `cqi`) ont été **supprimés** : ils faisaient
suivre au chiffre la largeur de *sa* carte, si bien qu'une même grandeur rendait à 38px
dans une carte large et à 24px dans une carte étroite.

### 7.2 Design system — cartes & indicateurs (standard d'affichage)

**Règle** : tout bloc d'information encadré (dashboard ou autre écran) utilise
`app-carte-info` ; on n'ajoute plus de `p-card` ni d'encadré ad hoc. Le contenu chiffré
passe par les indicateurs partagés plutôt que par un graphique maison.

| Composant | Rôle | Entrées principales |
|---|---|---|
| `app-carte-info` | Carte standard : titre, sous-titre, icône d'info (tooltip), badge, slot d'actions `[carte-actions]`, corps en `ng-content` | `titre` (requis), `sousTitre`, `ton`, `badgeTexte`, `badgeTon`, `niveauTitre` (2–6) |
| `app-indicateur-histogramme` | Barres verticales (séries mensuelles) | `valeurs`, `libelles`, `indexSurligne`, `indicesNegatifs`, `ton`, `tonNegatif`, `hauteur`, `formateurInfobulle`, `interactif` → `(barreClick)` |
| `app-indicateur-donut` | Répartition en % + légende | `segments` (`{libelle, valeur %, ton?, infobulle?}`), `valeurCentrale`, `libelleCentral`, `taille`, `interactif` → `(segmentClick)` |
| `app-indicateur-heatmap` | Grille de cellules colorées + légende | `cellules`, `legende`, `colonnes`, `interactif` → `(celluleClick)` |
| `app-indicateur-nombre-tendance` | Valeur clé + badge de variation | `valeur`, `unite`, `delta`, `inverserDelta`, `libelleComparaison`, `formateurDelta` |
| `app-indicateur-progression` | Barre `actuel / cible` (ton info → attention → succès) | `actuel`, `cible`, `unite`, `ton`, `seuilAttention`, `afficherReste`, `libelleAtteint`, `actuelAffiche`, `cibleAffichee`, `resteAffiche` |
| `app-indicateur-sparkline` | Courbe de tendance miniature + valeur et badge | `serie`, `valeur`, `unite`, `delta`, `inverserDelta`, `ton`, `hauteur`, `formateurDelta` |
| `app-indicateur-comparaison` | Avant / après d'une ou plusieurs grandeurs + variation | `elements` (`{cle, libelle, valeurPrecedente, valeurActuelle, delta \| null, inverserDelta?, ton?}`) ou, pour un seul élément, `valeurActuelle`, `valeurPrecedente`, `delta` (nullable : badge masqué sans référence), `inverserDelta` ; en-têtes `libelleColonne`, `libellePrecedent`, `libelleActuel` (défauts i18n « Libellé / Avant / Après ») ; `libelleComparaison`, `formateurDelta` |
| `app-indicateur-barre-empilee` | Barre unique segmentée + légende | `segments` (`{libelle, valeur %, ton?, infobulle?}`), `palette`, `hauteurBarre`, `afficherLegende`, `interactif` → `(segmentClick)` |
| `app-indicateur-niveau` | Échelle qualitative à 5 segments | `niveau` (1–5), `libelle`, `ton`, `libelleDebut`, `libelleFin` |
| `app-indicateur-double-courbe` | Deux courbes (période actuelle / précédente) sur échelle commune | `serieActuelle`, `seriePrecedente`, `valeur`, `unite`, `delta`, `libelleActuel`, `libellePrecedent`, `tonActuel`, `tonPrecedent`, `hauteur` |
| `app-indicateur-entonnoir` | Étapes successives en barres | `etapes` (`{libelle, valeurAffichee, valeurSecondaire?, largeurPourcent, ton?, infobulle?}`), `ton`, `interactif` → `(etapeClick)` |
| `app-indicateur-gaufre` | Grille de points (proportion sur un total) + légende | `segments` (`{libelle, compte, ton?, infobulle?}`), `palette`, `colonnes`, `total`, `afficherLegende`, `interactif` → `(segmentClick)` |
| `app-indicateur-courbes-multiples` | 1 à 5 courbes sur échelle commune + zone d'écart colorée entre deux d'entre elles | `series` (`{cle, libelle, valeurs, ton?, epaisseur?, tiret?, opacite?, sansPoint?, legendeTiret?}`), `libelles`, `libellesComplets`, `remplissage` (`'entre' \| 'zero' \| null`), `paire`, `libellesZone`, `tonZonePositive`, `tonZoneNegative`, `indexSurligne`, `indicesSignales`, `inclureZero`, `hauteur`, `afficherLegende`, `formateurValeur`, `formateurInfobulle` |
| `app-indicateur-barres-ligne` | Barres empilées (1 à 5 segments) surmontées d'une ligne de référence, axe Y partant de 0 | `segments` (`{cle, libelle, valeurs, ton?, intensite?}`), `ligne` (`{libelle, valeurs, ton?, tiret?, epaisseur?}`), `libelles`, `libellesComplets`, `indexSurligne`, `indicesPrevision`, `hauteur`, `afficherLegende`, `nbGraduations`, `formateurValeur`, `formateurInfobulle` |
| `app-badge-delta` | Badge de variation ▲/▼ partagé par les indicateurs de tendance | `delta` (ratio), `inverserDelta`, `formateur` |

Mutualisation interne à `shared/components/indicateurs/` : `_legende.scss` (styles de
légende du donut, de la barre empilée et de la gaufre) et `courbes.util.ts` (échelle
commune et tracé des chemins SVG de la sparkline, de la double courbe et des courbes
multiples ; échelle partant de 0 à pas « rond » et géométrie des colonnes pour les
barres + ligne).

- `app-indicateur-comparaison` : la **période de référence est affichée en premier**
  (à gauche, ou en haut sous 220px de conteneur où les deux périodes s'empilent) et reste
  en texte atténué, la période courante suit en contrasté ; `app-badge-delta` passe au ton
  neutre et sans flèche à variation nulle. Avec **plus d'un élément**, rendu en tableau
  **4 colonnes** (libellé | avant | après | variation, pastille de `ton` optionnelle devant
  le libellé), une ligne par élément et sans `libelleComparaison`. La colonne de variation
  est la plus à droite, réduite à son contenu et **alignée à droite** pour que tous les
  pourcentages finissent au même bord ; une ligne sans `delta` laisse simplement la cellule
  vide. Sous 440px de conteneur le tableau se compacte (en-têtes sur deux lignes, chiffres
  et gouttières réduits) ; `.table-scroll` sert de filet de sécurité (le débordement reste
  confiné au tableau, jamais rogné par la carte).
  ⚠️ `app-badge-delta` est `inline-flex` : **ne pas** lui poser `container-type:
  inline-size`, la containment de taille le réduirait à 0 et son contenu chevaucherait le
  texte voisin.
- `app-indicateur-entonnoir` : une étape peut porter son propre `ton` (intensité fixe,
  pour des barres typées revenu/charge/réserve) ; sans `ton` par étape, l'opacité du `ton`
  global décroît d'une étape à l'autre. `valeurSecondaire` affiche un texte atténué avant
  la valeur (ex. la part en pourcentage), masqué en conteneur très étroit.
- `app-indicateur-courbes-multiples` : **5 séries au maximum** (au-delà, découper en deux
  cartes) et **une seule zone colorée**, qui porte le message principal ; les autres
  séries sont des traits seuls, plus fins, en pointillés ou atténués. La zone est
  découpée intervalle par intervalle et bascule de couleur **exactement au croisement**
  des deux courbes de `paire` ; elle est positive quand `series[paire[0]]` passe au-dessus
  de `series[paire[1]]` (pour comparer des charges à un budget, mettre le budget en
  premier). Les graduations Y portent les valeurs **réellement atteintes**, pas les bornes
  de tracé. Le SVG s'étirant sur toute la largeur, points et libellés d'axe sont des
  éléments HTML superposés positionnés en pourcentage.
- `app-indicateur-barres-ligne` : **5 segments au maximum** (au-delà, regrouper les petits
  postes en « Autres »). Les valeurs négatives sont ramenées à 0 et l'axe Y part toujours
  de 0, avec un pas « rond » (1, 2, 5 ou 10 × 10ⁿ) commun aux barres et à la ligne. Une
  **ligne pleine** représente un montant réel, une **ligne en pointillés** (`tiret`) une
  valeur fixée à l'avance (budget, objectif) ; la ligne ne reprend pas le ton d'un segment,
  sauf si elle porte la même donnée. Les surfaces empilées reprennent la famille de
  couleurs de l'entonnoir (`couleurSurface(ton, …)`) mais à une intensité plus soutenue
  (`OPACITE_SURFACE_SEGMENT`), les tranches d'une barre devant rester distinctes ;
  `intensite` abaisse cette valeur pour une sous-catégorie du même thème. Au-delà de 720px
  de conteneur, la **légende passe à droite** du tracé (seuil plus haut que les 560px du
  donut et de la gaufre : il faut aussi garder une zone de tracé lisible), ce qui évite des
  barres démesurément larges dans une carte pleine largeur. Le composant ne signale
  **aucun dépassement** : la comparaison barre/ligne reste visuelle.

- **Couleurs** : uniquement via les *tons* typés de
  `shared/components/indicateurs/tons.ts` (`TonSemantique` : neutre, info, succes,
  attention, alerte, danger, revenu, charge, reserve, argent-poche ; `TonCategorie` :
  `categorie-1..10`). Ils résolvent des variables `--app-*` (dark mode inclus) : **aucune
  valeur CSS libre** n'est acceptée en entrée. La même interdiction s'applique au reste du
  frontend, par les tokens et classes utilitaires de la charte (voir §7.1 bis).
- **Une grandeur garde le même ton entre la carte et son drawer.** Le drawer détaille la
  même donnée : il ne doit jamais la recolorer. Si une couleur doit traduire un jugement
  (zone, seuil dépassé), elle est portée par le **badge/tag** et le message, pas par les
  segments ; sauf pour les indicateurs dont la zone *est* le sujet (taux d'effort), où la
  barre reprend alors le ton du badge. Le ton d'en-tête d'une `app-carte-info` suit la même
  logique : ton métier seulement si **toute** la carte porte cette grandeur, ton de feedback
  seulement si la carte émet un jugement, `neutre` sinon.
- Lorsqu'un même classement est rendu par deux visuels (ex. la gaufre « Postes à optimiser »
  et les barres de la matrice budgétaire), les deux partagent **la même échelle de tons** ;
  factoriser la table `zone → ton` (voir `TON_PAR_ZONE_EFFORT`, `PALIERS_SCORE`) plutôt que
  de la dupliquer.
- La palette catégorielle boucle au-delà de 10 tons. Les indicateurs l'appliquent dans
  l'**ordre d'affichage** des segments : plusieurs indicateurs d'une même page partagent
  donc la même séquence de couleurs (1er segment = 1re couleur, etc.).
- La carte n'est **pas** cliquable (actions uniquement dans l'en-tête) ; les indicateurs
  n'émettent leurs événements que si `interactif` est activé.
- Accessibilité : tooltips `pTooltip` **doublés d'un `aria-label`**, titre sémantique via
  `niveauTitre`, éléments interactifs focusables.
- Responsive : le corps de la carte est un `container` (`container: carte / inline-size`) ;
  les indicateurs s'adaptent par **container queries**, pas par media queries.
- **Galerie** : la route publique `/galerie`
  (`features/galerie/galerie-indicateurs.component`) présente un exemple de chaque
  indicateur, plus un conteneur large et un conteneur étroit pour contrôler les container
  queries. Y ajouter tout nouvel indicateur. Seule page de l'application dont les libellés
  sont en dur (données factices, aucune donnée de foyer) — exception assumée à la règle
  « tout en clés i18n ».

### 7.2 bis Design system — listes (cartes dépliables)

**Règle** : tout écran qui liste des entités éditables (postes, argent de poche, prorata)
utilise les primitives de `shared/components/liste/` — jamais un `<div>` habillé à la
main, et **plus de bouton roue dentée** : les actions vivent dans le détail déplié.

| Composant | Rôle | Entrées principales |
|---|---|---|
| `app-carte-liste` | Coquille d'une carte : cadre, tête cliquable (`<button>` ou `<label>` en mode sélection), chevron, zone de détail dépliable, `aria-expanded`/`aria-controls` | `contenuTete` (**`TemplateRef`**, requis), `deplie`, `enSurbrillance`, `lisere`, `modeSelection`, `selectionInputId`, `idDetail`, `libelleBascule` ; `(basculer)` ; `ng-content` = détail |
| `app-entete-groupe` | En-tête de section sticky : libellé, compteur, sous-total et barre de proportion **optionnels** | `libelle`, `nbElements`, `libelleCompteur`, `sousTotal?`, `sousTotalPonctuel`, `part?`, `couleur`, `devise`, `uniteParMois`, `unitePonctuel`, `titreBarre` |
| `app-detail-liste` | Contenu déplié : paires libellé/valeur + rangée d'actions | `lignes: LigneDetail[]`, `actions: MenuItem[]`, `colonneLaterale` ; `ng-content` = blocs propres à l'écran |

- La tête passe par un `TemplateRef` (et non `ng-content`) : elle est rendue dans deux
  branches `@if` exclusives, où un même sélecteur de projection ne peut pas être satisfait
  deux fois.
- Les classes de zones (`zone-nom`, `zone-montant`, `zone-dates`, `zone-complement`,
  `zone-pied`) et les états de liste (`squelette-carte`, `etat-vide`) sont **globales**
  (`src/styles/_cartes-liste.css`, layer `components`), car le contenu d'un `TemplateRef`
  garde la portée de styles de son composant déclarant.
- Classement de la rangée d'actions par la clé `data` du `MenuItem` : `modifier`
  (primaire), `supprimer` (danger, poussé à droite sur desktop), `changer-valeur` (un
  bouton ouvrant un `p-menu` popup), le reste en secondaire outlined.
- Un seul élément déplié à la fois par écran ; Échap referme et rend le focus à la tête.

Détail du patron et déclinaisons par écran : `docs/features/refonte.md`.

### 7.3 Design system — parcours guidés (formulaires en plusieurs étapes)

**Règle** : tout formulaire long (création/édition d'une entité à plus de quatre ou cinq
champs) se présente en **« une question par écran »** dans `app-parcours-guide`, et non en
une popin dense. C'est le cas de **tous** les formulaires de création/édition de
l'application : postes, politiques et allocations d'argent de poche, périodes de prorata,
scénarios, membres, comptes, catégories et taux de change. Les formulaires courts (deux
champs) suivent la même règle, par souci d'homogénéité.

| Composant | Rôle | Entrées principales |
|---|---|---|
| `app-parcours-guide` | Coquille du parcours : dialog, barre d'étapes, colonne de question défilante, fiche récapitulative (tiroir sous 768 px), pied d'actions contextuel | `visible`, `titre`, `sousTitre`, `badgeTexte`, `badgeTon`, `largeur`, `etapes` (`{cle, titre}`), `etapeCourante`, `lignes` (`LigneFiche`), `ficheTitre`, `ficheSousTitre`, `impactPrincipal`/`impactSecondaire` (bloc masqué si vide), `modeEdition`, `peutAllerFin`, `enregistrementEnCours`, `avecEnregistrerEtNouveau` → `(precedent)`, `(suivant)`, `(allerFin)`, `(naviguerFiche)`, `(enregistrer)`, `(enregistrerEtNouveau)`, `(fermer)`, `(ouvert)` ; contenu de l'étape en `ng-content` |
| `app-step-progress` | Chevron de retour + N segments remplis + compteur « n / N » (`role="progressbar"`) | `total`, `courante` (0-based), `libelleRetour`, `libelleProgression` → `(retour)` |
| `app-choix-cartes` | Sélection unique en cartes (titre, sous-titre explicatif, pastilles de rattachement) | `options` (`{value, titre, sousTitre?, desactive?, couleur?, pastilles?}`), `label`, `largeurMin`, `[(value)]` |
| `app-choix-puces` | Même API, rendu en pilules qui passent à la ligne (listes longues, raccourcis de saisie) | idem `app-choix-cartes` |
| `app-echelle-notation` | Échelle 1 à 5 en cinq boutons (remplace les `p-slider` de notation) | `label`, `question`, `libelleMin`, `libelleMax`, `gabaritAria`, `[(value)]` |
| `app-palette-couleurs` | Palette des 10 tons catégoriels, pour choisir la couleur d'un membre | `label`, `gabaritAria`, `[(value)]` (hex résolu depuis les tokens, jamais une valeur en dur) |

Règles :

- Le **nombre d'étapes peut varier** selon les réponses (ex. l'étape « Paiement » d'un poste
  n'existe que si la périodicité dépasse le mois) : la navigation se fait **par clé d'étape**,
  jamais par index.
- La **fiche récapitulative** remplace l'étape « Récapitulatif » : une ligne par étape,
  cliquable, mise à jour en direct. Une ligne **reste muette tant que son étape n'a pas été
  atteinte**, même si le formulaire porte déjà une valeur par défaut. Sous 768 px, la fiche
  devient un panneau ouvert depuis une barre d'impact (panneau absolu interne au dialog, pas
  de drawer imbriqué dans un modal).
- Les **champs de saisie restent la référence** ; les puces ne sont que des raccourcis
  (« Ce mois », « 50 / 50 », « Au prorata »…) et la puce active se **déduit de la valeur du
  champ, jamais d'un état local** — une saisie manuelle n'en allume donc aucune.
- Les composants d'étape sont `OnPush` : ils reçoivent le `FormGroup` (pour
  `formControlName`) **et** un instantané des valeurs pour tout ce qui est affiché ou
  dérivé. Ils ne font ni appel réseau ni calcul métier.
- La popin **ne persiste pas elle-même** quand l'écran parent tient la liste : elle valide,
  construit la requête et l'émet (`(enregistrer)`), le parent appelle le service et referme.
- Sélection : bordure 2 px `--p-primary-color` + fond `--app-selection-bg`
  (`--app-selection-bg-fort` pour la valeur courante d'une échelle) ; zones cliquables
  ≥ 44 px ; `aria-pressed` sur les choix, `aria-current="step"` sur la ligne de fiche active.


## 8. Configuration & environnements

- Backend : profils Spring (`dev`/`prod`), config via variables d'environnement
  (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `CORS_ORIGINS`). **Jamais** de secret
  en dur ni committé (`.env.example` documente les clés).
- `application.yml` : datasource, Flyway `enabled`, JPA `ddl-auto=validate`, Jackson (dates
  ISO). Frontend : `environment.ts` / `.prod.ts` (URL de l'API).
- **Docker** : `docker-compose.yml` (PostgreSQL + backend + front), Dockerfiles
  multi-stage.

## 9. Qualité & robustesse

- Backend : JUnit 5 + AssertJ, intégration via **Testcontainers** (PostgreSQL réel).
  Couverture module `moteur` **> 90 %**.
- Gestion d'erreurs centralisée (`@RestControllerAdvice` → `ApiError` uniforme). Validation
  d'entrée systématique (Bean Validation + `PosteValidator`). Actuator `/health` sécurisé.
