# 05 — Spécification Frontend (Angular + PrimeNG)

> Écrans, navigation, composants PrimeNG et graphiques. Chaque écran indique les
> endpoints consommés (voir [doc 04](04-api-spec.md)) et les composants clés. FR par
> défaut, i18n prête.

---

## 1. Shell & navigation

- **Topbar** (`TopbarComponent`) : logo, **sélecteur de foyer** (dropdown), **sélecteur
  de scénario** (dropdown, badge « référence »), menu utilisateur (profil, déconnexion),
  sélecteur de langue/thème.
- **Menu latéral** (`SidebarMenuComponent`, masqué sur mobile `hidden md:flex`) :
  - Tableau de bord annuel
  - Tableau de bord du mois
  - Revenus · Charges · Réserves
  - Scénarios (& comparaison)
  - Patrimoine
  - Objectifs
  - Référentiels (Membres, Comptes, Catégories, Actifs, Taux de change)
  - Paramètres du foyer / Accès
- **Layout** : `ShellComponent` en colonne pleine hauteur (`flex flex-col h-screen`),
  largeur centrée max `md:max-w-2/3`.

### Comportement du ShellComponent

Le shell synchronise le contexte foyer depuis l'URL à chaque navigation :

1. **Extraction depuis l'URL** : regex `/f/(uuid)/` → chargement du foyer via l'API si
   le `foyerId` change.
2. **Chargement du contexte** : une fois le foyer connu, charge en parallèle :
   - les membres (`GET .../membres`) → injecte dans `ContexteService.membres`
   - la liste des scénarios (`GET .../scenarios`) → sélectionne le scénario de référence
     (ou le premier) → injecte dans `ContexteService.scenarioCourant`
3. **Auto-sélection** : si aucun `foyerId` dans l'URL et si l'utilisateur n'a qu'un seul
   foyer, le sélectionne automatiquement.

### ContexteService (source de vérité globale)

Signals exposés :
- `foyerId()` — UUID du foyer courant (null si aucun)
- `foyerCourant()` — `FoyerDto` complet
- `scenarioId()` — UUID du scénario courant
- `scenarioCourant()` — `ScenarioDto` complet
- `membres()` — liste des `MembreDto` du foyer
- `deviseBase()` — devise ISO du foyer (ex. `'CHF'`)
- `estEditor()` — true si rôle `OWNER` ou `EDITOR`
- `estOwner()` — true si rôle `OWNER`

Changer foyer ou scénario via `setFoyer()` / `setScenario()` déclenche les effets
réactifs dans tous les composants abonnés.

## 2. Routes (lazy)

```
/login                                  (public)
/register                               (public)
/foyers                                 (choix / création de foyer)
/f/:foyerId
  ├── /dashboard-annuel
  ├── /dashboard-mensuel
  ├── /revenus | /charges | /reserves
  ├── /scenarios | /scenarios/comparaison
  ├── /patrimoine
  ├── /objectifs
  ├── /referentiels/(membres|comptes|categories|actifs|taux)
  ├── /parametres
  └── /acces                            (indépendant de /parametres)
```

`AuthGuard` protège toute la zone `/f/**` et la route shell racine. Les actions d'écriture
sont masquées dans les templates via `contexte.estEditor()` / `contexte.estOwner()` (pas
de guard de rôle dédié côté routing).

### 2.1 Création de foyer — dialog

La page `/foyers` propose un bouton **« Nouveau foyer »** ouvrant un `p-dialog` unique :
- **Nom du foyer** + **devise de base** (dropdown CHF/EUR/USD/GBP/CAD).
- **Membres initiaux** : liste dynamique (min 1). Chaque ligne : champ texte (nom) +
  `<input type="color">` (couleur hex). Boutons `+` / 🗑 (désactivé si un seul membre).

**Règles UX :**
- Bouton **Créer** désactivé si nom du foyer vide ou si un nom de membre est vide.
- Couleur par défaut : `#6366f1` (indigo).
- Après création → redirection automatique vers `/f/:id/dashboard-annuel`.

## 3. Écrans

### 3.1 Tableau de bord annuel  *(reprend « Dashboard annuel » Excel)*

**Endpoints** : `GET .../projection/annuelle?annee=`

**En-tête** :
- Sélecteur d'**année** (`p-select`, options générées depuis `sc.anneeDepart` sur
  `sc.horizonAnnees` années).
- **Sélecteur de vue** (`p-selectButton`, trois options) si le foyer a >1 membre :
  - **Foyer** — seul le graphique et le tableau foyer sont affichés.
  - **Par membre** — seuls les graphiques/tables par membre sont affichés.
  - **Les deux** — tout est visible (défaut initial : « Par membre »).

**KPI annuels** (4 cartes, grille 2 cols mobile / 4 cols desktop) :
- Revenus · Charges · Réserves · Solde disponible, chacun avec estimation mensuelle
  (`÷ 12`, format compact `fr-CH`). Couleur de bordure conditionnelle (vert si solde ≥ 0,
  rouge sinon).

**Graphique mixte foyer** (`p-chart type="bar"`, visible si vue ≠ PAR_MEMBRE) :
- Barres empilées Charges (rouge) + Réserves (bleu), sur l'axe `stack='depenses'`.
- Ligne Revenus (vert, tension 0,3).
- 12 labels mois (Jan–Déc), axes formatés en compact.

**Graphiques par membre** (grille 1 col mobile / 2 cols desktop, visible si vue ≠ FOYER
et foyer > 1 membre) :
- Un `p-card` par membre avec son graphique mixte (même structure foyer).
- Sous le graphique : tableau `p-table` détail mensuel (12 lignes + total).
  Sur mobile (<sm) : cartes compactes par mois en substitut de la table.

**Tableau mensuel foyer** (`p-table`, visible si vue ≠ PAR_MEMBRE) :
- Colonnes : Mois · Revenus · Charges · Réserves · Solde.
- Ligne de pied de page : totaux annuels.
- Sur mobile : même format de cartes compactes.

### 3.2 Tableau de bord du mois  *(reprend « Dashboard du mois » Excel)*

**Endpoints** : `GET .../projection/mensuelle?annee=&mois=`, `GET .../categories`,
`GET .../comptes`

**En-tête** :
- Sélecteurs **année** + **mois** (dropdowns indépendants).
- Sélecteur de vue FOYER / PAR MEMBRE / LES DEUX (si >1 membre).

**KPI foyer** (4 cartes, visible si vue ≠ PAR_MEMBRE) :
Revenus · Charges · Réserves · Solde du mois.

**Taux d'effort foyer** (barre de progression visuelle, visible si vue ≠ PAR_MEMBRE) :
- Calcul : `charges / revenus × 100`, plafonné à 100 %.
- Couleur progressive : vert (<50 %), ambre (50–75 %), rouge (≥75 %).
- Marqueurs à 50 % et 75 % sur la barre.

**Ventilation par catégorie** (3 listes côte à côte en grille 1/3 cols) :
- Revenus · Charges · Réserves ; tri décroissant par montant ; total en bas.
- Seules les catégories avec montant ≠ 0 sont affichées.

**Contribution par catégorie et par membre** (grille 1/2 cols, visible si vue ≠ FOYER) :
- Un `p-card` par membre.
- Badge taux d'effort individuel coloré (vert/ambre/rouge).
- Trois blocs empilés : revenus, charges, réserves — chacun listé par catégorie.

**Répartition par compte et par membre** (grille 1/2 cols, visible si vue ≠ FOYER) :
- Un `p-card` par membre avec mini-KPI 2×2 (revenus/charges/réserves/solde).
- Graphique horizontal `p-chart type="bar"` (indexAxis = 'y') des charges par compte,
  hauteur dynamique (`nbre_comptes × 38 + 16 px`).

### 3.3 Revenus / Charges / Réserves  *(reprennent les feuilles de saisie)*

Composant unique `PostesListeComponent` paramétré par `type` via `input<TypePoste>()`.

**En-tête** :
- Titre + compteur de postes visibles.
- Sélecteur de tri (`p-select`) : **Date** (début/fin) · **Catégorie** · **Description**.
- Cases à cocher : « Masquer les inactifs » (actif par défaut) / « Masquer les futurs ».
- Filtres multiselect (`p-multiselect`) : **Catégories** · **Comptes** (avec tags membres
  colorés dans les options) · **Membres**.
- Bouton Créer (masqué pour `VIEWER`).

**Liste de postes** (cartes flex, non `p-table`) :
- Barre accent colorée gauche (vert REVENU / rouge CHARGE / indigo RESERVE).
- Description + badge `PRÉVISION` (si `nature = PREVISION`).
- Méta : catégorie · période · périodicité avec icônes :
  - ⚡ one-shot (`periodiciteMois = 0`, libellé « Ponctuel »).
  - 🗓 mensualisé ou périodicité ≤ 1 mois.
  - ⚡ ambre si périodique > 1 mois (avec tooltip mode + moment).
- Tags membres colorés :
  - `AUTO`/`REVERSE_AUTO` : « Nom · Compte » pour tous les membres actifs.
  - `CUSTOM` : « Nom · XX% · Compte » uniquement pour les membres à quotePart > 0.
  - Mono-membre : aucun tag.
  - Contraste texte auto (luminance YUV, seuil 170).
- Montant + montant mensualisé (`÷ périodicité`).
- Actions : aperçu 👁 · édition · suppression (masquées pour `VIEWER`).

**États spéciaux** : squelettes PrimeNG pendant le chargement · état vide illustré.

**Filtres actifs** :
- Inactif = `fin < moisCourant`.
- Futur = `debut > moisCourant`.
- Filtre compte : poste retenu si au moins une `ventilation` correspond à un compte
  sélectionné.
- Filtre membre : `CUSTOM` → vérifie `quotePart > 0` ; `AUTO`/`REVERSE_AUTO` → poste
  retenu si au moins un membre sélectionné est actif dans le foyer.

**Dialog de création/édition** :
- **Description** (obligatoire) · **Catégorie** · **Montant** (obligatoire).
- **Périodicité** : dropdown 0–12 mois (0 = « Une seule fois »).
  - `D = 0` (one-shot) : seul le champ `Début` est visible (obligatoire) ; mode/moment
    cachés.
  - `D = 1` : mode et moment cachés (toujours mensualisé).
  - `D > 1` : grille 3 colonnes Périodicité · Moment · Mode.
- **Début** / **Fin** : `p-datepicker`, en 2 colonnes (sauf one-shot).
- **Nature** : EFFECTIF / PRÉVISION (défaut EFFECTIF).
- **Mode de répartition** (masqué si mono-membre) :
  - `AUTO` / `REVERSE_AUTO` : pas de saisie de parts.
  - `CUSTOM` : bloc de parts par membre (`p-inputnumber` %), somme affichée en temps réel
    (vert si = 100 %, rouge sinon), bouton « Équitable », message d'avertissement si ≠ 100 %.
    Bouton **Enregistrer** désactivé si somme ≠ 100 %.
- **Ventilation comptes** : pour chaque membre, `p-select` des comptes auxquels il est
  rattaché. En mode CUSTOM, désactivé si la part du membre est 0.
- **Aperçu mensuel** : dialog secondaire affichant la contribution mois par mois
  (`GET .../apercu?annee=`) pour l'année de départ du scénario.

**Endpoint** : `GET/POST/PUT/DELETE .../postes`

### 3.4 Scénarios & comparaison

**Liste** (`ScenariosListeComponent`) :
- `p-table` colonnes : Nom · Statut (badge « Référence » si `estReference`) · Année de
  départ · Trésorerie initiale · Horizon.
- Actions (masquées pour `VIEWER`) : éditer · dupliquer · définir comme référence ·
  supprimer (supprimer et définir référence masqués pour le scénario de référence).
- **Bouton périodes** (📅, `RepartitionPeriodesComponent`) : visible seulement si le foyer
  a >1 membre.

**Formulaire d'édition/création** (dialog `p-dialog max-w-lg`) :
- Nom · Année de départ · Trésorerie initiale · Horizon.
- **Répartition par défaut** : une ligne par membre avec input % ; somme affichée en
  temps réel ; bouton Enregistrer désactivé si somme ≠ 100 %.

**Périodes de prorata** (`RepartitionPeriodesComponent`) :
- Composant `display:contents` (transparent pour le layout) intégré dans chaque ligne de
  la table des scénarios.
- Ouvre un premier dialog listant les périodes existantes (tableau `p-table`).
- Depuis ce dialog, un second dialog (formulaire) permet de créer/modifier une période :
  - Champs `Début` / `Fin` (`p-datepicker`).
  - Parts par membre (`p-inputnumber` %), somme live, bouton « Équitable ».
  - Bouton Enregistrer désactivé si somme ≠ 100 %.
- Les périodes ouvertes (fin = null) sont affichées avec un tag « Ouverte ».
- Masqué automatiquement si mono-membre.

**Comparaison** (`ComparaisonComponent`) :
- `p-multiselect` de sélection des scénarios à comparer (min 2 ; pré-sélectionne les 2
  premiers).
- Bouton **Comparer** → appelle `GET .../projection/comparaison`.
- **Graphique trésorerie** : `p-chart type="line"` multi-séries, une couleur par scénario.
- **Graphique solde** : `p-chart type="bar"` groupé.
- **Tableau des écarts** : `p-table` avec colonnes Année + une colonne par scénario +
  colonne Écart (max − min).

### 3.5 Patrimoine (net worth)

**Endpoint** : `GET .../projection/patrimoine`

- **Graphique mixte** (`p-chart type="bar"`, hauteur 320 px) :
  - Ligne **Patrimoine net** (violet, `fill: true`).
  - Barres empilées par **compte** (palette de couleurs cyclique, `stack: 'comptes'`).
  - Axe Y formaté en compact.
- **Cartes résumé** (3 cartes, dernière année) : Patrimoine net · Total comptes · Total
  actifs.
- **Tableau évolution annuelle** (`p-table` scrollable) : colonnes Année · Patrimoine net
  puis une colonne par compte puis une colonne par actif.

> ⚠️ La vue patrimoine n'inclut **pas** de graphique doughnut — la spec initiale est
> désactualisée. La vue actuelle est un graphique mixte `line + bar`.

### 3.6 Objectifs

**Endpoints** : `GET/POST/PUT/DELETE .../objectifs`, `GET .../comptes`, `GET .../actifs`

- Grille de **cartes** `p-card` (1 col mobile / 2 cols tablette / 3 cols desktop).
- Chaque carte : libellé · échéance (`DateFrPipe`) · barre de progression `p-progressbar`
  (`valeur = progression × 100`) · pourcentage (`PctPipe`) · épargne requise/mois ·
  tag compte ou actif lié (`p-tag`).
- **Formulaire** (dialog) :
  - Libellé (obligatoire) · Montant cible · Échéance (`p-datepicker`).
  - **Compte lié** (`p-select`, `showClear`) et **Actif lié** (`p-select`, `showClear`)
    en XOR : sélectionner l'un efface automatiquement l'autre (via `(onChange)` handlers).

### 3.7 Référentiels

Écrans CRUD simples (`p-table` + `p-dialog`).

**Membres** :
- Table : couleur (pastille ronde) · Nom · Ordre · Actif (✓ / ✗).
- Formulaire : nom · `p-colorpicker` · ordre.

**Comptes** :
- Table : Libellé · Solde initial · Devise · Membres rattachés (tags `p-tag`) · Ordre.
- Formulaire : libellé · `p-multiselect` membres actifs (`display="chip"`,
  **obligatoire** — au moins un ; validation Bean side UI + 422 côté serveur) · devise ·
  ordre · solde initial.
- À la création, tous les membres actifs sont pré-sélectionnés par défaut.
- À l'édition, seuls les membres **actifs** parmi les rattachés sont re-sélectionnables
  (les inactifs sont préservés côté serveur).

**Catégories** :
- Table : Libellé · Type de poste (filtrable) · Ordre · Actif.
- Formulaire : libellé · type · ordre.

**Actifs** :
- Table : Libellé · Type · Valeur initiale · Taux croissance/an · Ordre.
- Types (enum `TypeActif`) : Compte épargne · 3ᵉ pilier · Investissement · Crypto ·
  Immobilier · Véhicule · Autre.
- Formulaire : libellé · type (défaut = Autre) · devise · valeur initiale · taux de
  croissance (%/an, saisi en % et divisé par 100 à l'envoi) · ordre.

**Taux de change** :
- Table : Devise · Taux vers devise de base.
- Formulaire : devise · taux.

> Erreur serveur `MEMBRE_REFERENCE_SUPPRESSION` → toast d'erreur explicatif
> (`FR.commun.suppressionImpossible`).

### 3.8 Paramètres foyer & accès

**Paramètres** (`/parametres`) :
- Formulaire : nom du foyer · devise de base — accessible à tous, enregistrement réservé
  à `OWNER`.
- Zone dangereuse (visible `OWNER` uniquement) : bouton **Supprimer le foyer** avec
  `p-confirmdialog` → suppression + redirection vers `/foyers`.

**Accès** (`/acces`, route indépendante) :
- Table : Nom complet · Email · Rôle (tag `p-tag` severity warn/info/secondary).
- Actions `OWNER` uniquement : inviter (email + rôle, dialog) · changer le rôle (dialog
  select) · retirer (confirmdialog).
- Le propriétaire ne peut pas se retirer lui-même (boutons cachés pour les lignes de rôle
  `OWNER`).

## 4. Composants & pratiques transverses

### 4.1 Graphiques
- `p-chart` (Chart.js). Palette de couleurs synchronisée avec `membre.couleur` pour la
  cohérence entre écrans.
- Formatage des axes/tooltips via `Intl.NumberFormat('fr-CH', { notation: 'compact' })`.

### 4.2 Formatage montants/dates
- `MontantPipe` : `Intl.NumberFormat` + locale + devise (optionnelle, sinon `deviseBase`).
- `PctPipe` : affiche un décimal en pourcentage (`0.42 → 42,0 %`).
- `PeriodicitePipe` : libellé lisible pour une périodicité en mois.
- `DateFrPipe` : formatage date ISO → affichage fr-CH.

### 4.3 États de chargement
- `p-skeleton` sur tous les écrans de projection pendant le chargement (squelettes aux
  dimensions des blocs réels pour minimiser le layout shift).

### 4.4 Messages
- `p-toast` : succès / erreur (via `MessageService` injectable).
- `p-confirmdialog` : suppressions (via `ConfirmationService` en `providers` du composant
  pour l'isoler).

### 4.5 Réactivité — patterns Angular
- **`signal()`** pour l'état local mutable (`chargement`, `projection`, `ventilations`…).
- **`computed()`** pour les dérivés (`mixedChartData`, `postesVisibles`, `tauxEffort`…).
- **`effect()`** déclaré en champ d'instance (pas en `ngOnInit`) — valide car le contexte
  d'injection est actif au moment de la construction du composant. Permet de réagir aux
  changements de `foyerId()` / `scenarioCourant()` sans `subscribe` manuel.
- **`toSignal()`** pour bridger un Observable RxJS vers un signal (ex. :
  `valueChanges` du `FormControl` `typeRepartition`).
- **`input.required<T>()`** pour les inputs obligatoires (Angular 17+).

### 4.6 Sécurité UX (sans guard dédié)
- Les actions de modification (créer, éditer, supprimer) sont enveloppées dans
  `@if (contexte.estEditor())`.
- Les actions d'administration (inviter, supprimer foyer, définir référence) sont
  enveloppées dans `@if (contexte.estOwner())`.
- Aucun `FoyerAccessGuard` de routing — la sécurité effective est assurée côté serveur
  (JWT + vérification `AccesFoyer` sur chaque endpoint).

### 4.7 Styling
- **Tailwind CSS v4** pour layout/espacement/responsive (`flex`, `grid`, `gap`, `p`, `m`,
  breakpoints `sm`/`md`/`lg`).
- **PrimeNG 22** via `tailwindcss-primeui` + CSS layers (ordre : `tailwind, primeng`).
- Couleurs de tokens (`bg-primary`, `text-surface-*`, `dark:bg-surface-950`).
- Sur composants PrimeNG : utilitaires passés via `styleClass`.
- Mode sombre : `darkModeSelector` aligné avec la variante `dark` de Tailwind.

## 5. Correspondance Excel → écrans (traçabilité)

| Feuille Excel | Écran Angular |
|---|---|
| Dashboard annuel | Tableau de bord annuel (KPI + graphiques + tableaux mensuels) |
| Dashboard du mois | Tableau de bord du mois (ventilations catégorie / compte / membre) |
| Revenus / Charges / Réserves | Écrans de saisie Revenus / Charges / Réserves |
| Paramètres | Référentiels + Paramètres foyer + hypothèses de scénario |
| Moteur | *(non exposé : calcul serveur)* — visible via projections/graphiques |
| *(listes projets, types actifs)* | Objectifs & Patrimoine (modules nouveaux) |
