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
├── shared/   composants réutilisables (button, carte-info, indicateurs/*, carte-bilan,
│             tag, metric-ring, event-grid, taux-effort-card) — `button`/`tag` wrappent
│             `p-button`/`p-tag` (API restreinte au sous-ensemble utilisé, `tag` supporte
│             couleur libre ou `severity`)
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
  3 colonnes (libellé | avant | après, pastille de `ton` optionnelle devant le libellé),
  une ligne par élément, le badge collé à droite de la valeur « après » et sans
  `libelleComparaison`.
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
  valeur CSS libre** n'est acceptée en entrée.
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
