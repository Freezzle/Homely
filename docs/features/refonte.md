# Refonte de la liste des postes (zone liste uniquement)

> **Pour l'agent** : ce document décrit une refonte **ciblée** de
> `features/postes/postes-liste/`. Lire aussi `docs/README.md`,
> `docs/04-api-et-frontend.md` §3.2 et §4, et `.github/copilot-instructions.md`.
> Les règles métier de ces docs priment sur ce fichier.

---

## 1. Périmètre

**À modifier** : uniquement la zone liste, c'est-à-dire le contenu de
`<div class="flex-1 min-h-0 overflow-y-auto">` dans `postes-liste.component.html`
(skeletons, état vide, séparateurs de groupe, cartes de poste) et le code TS/SCSS qui la sert.

**À ne pas toucher** :
- l'en-tête (titre, bouton Créer) ;
- `app-postes-barre-filtres` (recherche, trier, filtres, options, bouton sélection) ;
- la barre d'actions groupées (sélection multiple) ;
- tous les dialogs et drawers en bas du template ;
- la logique de filtrage, de tri, de regroupement et de chaînes de révisions
  (`postesVisibles`, `groupesAffiches`, `_estChaine`, `_premierDuBloc`, `_nbMasquesAvant|Apres`…) :
  on change **le rendu**, pas les données.

Résultat visé : chaque poste devient une **carte** (séparée de la suivante par un espace),
avec une ligne sur deux niveaux, un **pied d'étiquettes**, et un **détail dépliable**
qui contient les actions.

---

## 2. Contraintes

1. **Styles** : tokens de `src/styles/_app-tokens.css` (`--app-ink`, `--app-ink-muted`,
   `--app-line`, `--app-card`, `--app-bg`, `--app-revenu|charge|reserve(-bg)`, `--app-info(-bg)`,
   `--app-warning(-bg)`, `--app-space-*`, `--app-text-*`, `--app-weight-*`,
   `--app-radius-*`…), variables PrimeNG, utilitaires Tailwind. **Aucune couleur, taille de
   police ou rayon en dur.** Ajouter un token dans `_app-tokens.css` s'il en manque un.
2. **i18n** : aucun texte en dur ; clés à ajouter dans `fr.json` **et** `en.json` (§9).
3. **Réutiliser** : `app-tag` (étiquettes), `app-button`, `app-checkbox`, `MontantPipe`,
   `PeriodicitePipe`, `actionItemsFor(p)`, `membresAffichesPoste(p)`, `natureAffichee(p)`,
   `separateurAccent()`, `posteEnSurbrillanceId`.
4. **Nouveaux composants légers** (standalone, `OnPush`, `input()`/`output()`, sans HTTP) :
   voir §8.
5. Accessibilité : la tête de carte est un vrai `<button>` (`aria-expanded`,
   `aria-controls`), cibles ≥ 44 px, focus visible, Échap referme le détail ouvert.

---

## 3. Anatomie d'une carte

```
┌───────────────────────────────────────────────────────────────┐
│ Charges et électricité                    ≈ 70,00 CHF / mois ⌄│  ← ligne 1
│ Depuis le 01.2025                    210,00 CHF · Tous les 3 mois│  ← ligne 2
│ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│ [Compte joint] [± 10 %] [Nécessité : 4/5] [Dérive : 4/5] [→ Révision]│  ← pied (étiquettes)
├───────────────────────────────────────────────────────────────┤
│ (détail, visible seulement si la carte est dépliée)            │
└───────────────────────────────────────────────────────────────┘
```

Grille de la tête (desktop) :
`grid-template-columns: minmax(0,1fr) auto 24px;`
`grid-template-areas: "nom montant chevron" "dates periodicite chevron" "pied pied pied";`

- **Carte** : fond `--app-card`, bordure 1 px `--app-line`, rayon `--app-radius-item`
  (≈ 10 px) ou `--app-radius-card`, `overflow: hidden`. Espace entre cartes ≈ 6 px
  (`gap` du conteneur, pas de marges). Survol : bordure un ton plus foncé. Carte dépliée :
  fond de tête doux (`--app-info-bg` ou token « sélectionné »).
- **Padding** de la tête ≈ 11 px × 14 px ; hauteur min. ≈ 60 px.
- **Mobile (< 768 px, `md:` Tailwind)** : même grille sans la colonne chevron
  (`"nom montant" "dates periodicite" "pied pied"`) ; le nom est tronqué sur une ligne
  (`text-overflow: ellipsis`) ; la colonne de droite ne dépasse pas ~48 % de la largeur.

### 3.1 Ligne 1, gauche : libellé
`p.description` (garder le surlignage de recherche existant `descriptionSurlignee(p)`),
`font-semibold`, ~15 px, une seule ligne tronquée. **Rien d'autre** sur cette ligne
(plus de tags catégorie, estimation, révision ni d'icônes cœur/flèches : ils passent au pied).

### 3.2 Ligne 1, droite : montant par mois
Calcul **volontairement simple**, sans tenir compte des dates de validité ni du mode :

```ts
montantParMois(p) = p.periodiciteMois > 0 ? p.montant / p.periodiciteMois : p.montant;
```

- Ne **pas** utiliser `p.montantMensualise` ici.
- Affichage : `{{ montantParMois(p) | montant:p.devise }}` + suffixe « / mois » plus petit et
  en `--app-ink-muted` ; préfixe « ≈ » si `periodiciteMois > 1` (le résultat est une moyenne).
- Ponctuel (`periodiciteMois === 0`) : montant brut, **sans** « / mois ».
- Taille : ~14 px, `font-bold`, `tabular-nums`, pas de retour à la ligne.

### 3.3 Ligne 2, gauche : dates
Format **mm.yyyy** (mois sur 2 chiffres, point, année), indépendant de la locale.
Créer un util `formatMoisAnnee(iso: string): string` → `"01.2025"` dans
`core/utils/format-affichage.util.ts` (ne pas réutiliser `formatPeriodeMois`, dont le
séparateur dépend de la locale).

| Cas | Texte |
|---|---|
| `debut` seul (pas de `fin`) | « Depuis le 01.2025 » |
| `debut` et `fin` | « Du 04.2024 au 03.2027 » |

Les postes ponctuels n'ont pas de `fin` : ils suivent donc la 1re règle
(« Depuis le 11.2026 »). Texte `text-xs`/`text-sm`, `--app-ink-muted`, `tabular-nums`,
une ligne tronquée.

### 3.4 Ligne 2, droite : périodicité
`--app-ink-muted`, `text-xs`, aligné à droite, une ligne :

| `periodiciteMois` | Texte |
|---|---|
| 0 | `t.poste.oneShot` (« Ponctuel ») |
| 1 | `p.periodiciteMois \| periodicite` (« Tous les mois ») |
| > 1 | `{{ p.montant \| montant:p.devise }} · {{ p.periodiciteMois \| periodicite }}` (« 210,00 CHF · Tous les 3 mois ») |

Le montant brut n'apparaît que pour les périodicités > 1, pour qu'on retrouve la somme
réellement payée à chaque échéance.

### 3.5 Pied d'étiquettes
Une 3e rangée **à l'intérieur de la carte**, pleine largeur, séparée des deux lignes
par un trait **pointillé** `--app-line` (pas de fond gris : c'est ce qui le rattache
visuellement à son poste). `margin-top` ≈ 5 px, `padding-top` ≈ 5 px, étiquettes en
`flex-wrap` avec `gap` ≈ 4 px. **Le pied n'est pas rendu s'il n'a aucune étiquette.**

Étiquettes **très petites** (`app-tag`, hauteur ≈ 18 px, `--app-text-2xs`,
`--app-weight-semibold`, rayon `--app-radius-pill`), dans cet ordre :

| # | Étiquette | Condition | Texte | Ton |
|---|---|---|---|---|
| 1 | **Comptes** | une ventilation existe | libellé du compte ; si les membres utilisent des comptes différents, une étiquette par membre « Dylan : Compte perso » (réutiliser `membresAffichesPoste(p)` / `libelleCompteVentilationPourMembre`) | neutre, ou couleur du membre (`rep.couleur`) comme aujourd'hui |
| 2 | **Estimation** | `nature === 'ESTIMATION'` | `natureAffichee(p)` (« ± 10 % ») | `--app-warning(-bg)` |
| 3 | **Mensualisé** | `periodiciteMois > 1` et `mode === 'MENSUALISE'` | « Mensualisé » | neutre |
| 4 | **Révision** | `p.posteOrigineId` (maillon issu d'une révision) | `t.poste.revisionTag` (« Révision ») | `--app-info(-bg)` |
| 4b | | `p.posteSuivantId` présent et maillon suivant masqué | « → {montant} dès le {mm.yyyy} » (montant/date du successeur) | `--app-info(-bg)` |
| 4c | | `_nbMasquesAvant` / `_nbMasquesApres` > 0 | « {n} révision(s) précédente(s)/suivante(s) masquée(s) » | neutre |
| 5 | **Nécessité** | `importance !== 3` | `importanceTooltip(n)` (« Nécessité : 4/5 ») | neutre |
| 6 | **Potentiel d'optimisation** | `potentielOptimisation !== 3` | `potentielOptimisationTooltip(n)` | neutre |
| 7 | **Dérive externe** | `deriveExterne !== 3` | `deriveExterneTooltip(n)` + icône `pi-arrow-up` (4–5) ou `pi-arrow-down` (1–2) | neutre |

- Les 3 indicateurs d'analyse ne s'affichent que hors valeur neutre (3), comme aujourd'hui.
- L'option existante **« Cacher les détails »** (`cacherDetails()`) masque les étiquettes
  Comptes, Nécessité, Optimisation et Dérive ; Estimation et Révision restent visibles.
- Les icônes cœur / flèches et leurs classes `texte-echelle-*` disparaissent de la ligne.

### 3.6 Chevron et sélection
- Chevron `pi-chevron-down` en `--app-ink-muted` à droite, pivoté de 180° quand la carte
  est dépliée ; masqué sur mobile (toute la tête reste cliquable).
- **Mode sélection** (`modeSelection()`) : la tête devient un `<label>` avec
  `app-checkbox` en 1re colonne (`grid-template-columns: 24px minmax(0,1fr) auto`), le
  chevron est masqué et le dépliage désactivé. `toggleSelection(p.id)` inchangé.
- La surbrillance `posteEnSurbrillanceId()` (ring primaire) est conservée sur la carte.

### 3.7 Chaînes de révisions
Remplacer la « spine » (`border-l-5`, `-mt-2`, flèches absolues) par :
- un liseré gauche 3 px `--p-primary-color` (`box-shadow: inset 3px 0 0 …`) sur les cartes
  `_estChaine` ;
- un espacement réduit (≈ 2 px au lieu de 6) entre deux maillons consécutifs d'une même
  chaîne (`!_premierDuBloc`) ;
- les compteurs de maillons masqués passent en étiquette (ligne 4c du tableau).

---

## 4. Détail déplié (nouveau)

- **Un seul poste déplié à la fois** : `posteDeplieId = signal<string | null>(null)`.
  Clic sur la tête → ouvre / referme. Changer de type ou de filtres referme.
  Échap referme et rend le focus à la tête.
- Le détail est **sous la tête et le pied**, dans la même carte, fond `--app-card`,
  `border-top` 1 px (couleur primaire douce), padding ≈ 14 × 16 px, apparition sans
  animation lourde (fondu court, respecter `prefers-reduced-motion`).

Contenu (composant `app-poste-detail`, §8) :

```
┌──────────────────────────────────────────┬─────────────────────────┐
│ MONTANT            VALIDITÉ               │ ANALYSE                 │
│ 210,00 CHF ·       Du 01.01.2025          │ Nécessité        ▮▮▮▮▯  │
│ Tous les 3 mois    sans fin               │ Optimisation     ▮▮▮▯▯  │
│ PAIEMENT           RÉPARTITION            │ Dérive externe   ▮▮▮▮▯  │
│ Fin de période ·   Au prorata ·           │                         │
│ montant périodique Dylan 58 % · Camille 42 %│                       │
│ COMPTES                                    │                         │
│ Compte joint                               │                         │
├──────────────────────────────────────────┴─────────────────────────┤
│ [Modifier] [Réviser le montant] [Terminer] [Historique] …  [Supprimer]│
└─────────────────────────────────────────────────────────────────────┘
```

**Colonne gauche — paires libellé / valeur** (`<dl>`, grille 2 colonnes sur desktop,
1 colonne sur mobile, libellé au-dessus de la valeur) :

| Libellé | Valeur |
|---|---|
| Montant | `montant | montant:devise` · `periodiciteMois | periodicite` (+ `natureAffichee` si estimation) |
| Validité | « Du dd.mm.yyyy au dd.mm.yyyy » ou « Depuis le dd.mm.yyyy, sans fin » (dates complètes ici) |
| Paiement | seulement si `periodiciteMois > 1` : `t.poste.momentOptions[moment]` · `t.poste.modeOptions[mode]` |
| Répartition | `t.poste.typeRepartitionOptions[typeRepartition]` + parts par membre (données de `membresAffichesPoste`) |
| Comptes | ventilations (libellé par membre si différents) |

Libellés en `text-xs uppercase tracking-wide --app-ink-muted`, valeurs en
`text-sm font-semibold --app-ink`.

**Colonne droite — Analyse** : les 3 notes en lecture seule (libellé + « n/5 » + 5 segments,
segments pleins en primaire, vides en `--app-line`). Composant `app-echelle-lecture` (§8).

**Dernière ligne du corps — Aperçu du rythme** : `app-poste-apercu-periodicite`
(`shared/components/echeancier-annuel/`, le même que dans le formulaire de poste) en
**pleine largeur** (`grid-column: 1 / -1`), juste au-dessus du trait pointillé des actions.
Le conteneur lui passe un objet `ApercuPeriodicitePoste` (`{ poste, entete, legende, locale }`)
construit par `PostesListeComponent.apercuPeriodicite(p)` ; `null` — donc section absente —
si le poste n'a pas de date de début. Textes repris des clés `poste.form.apercuDes` et
`poste.form.legende.*`, la règle de légende vivant dans `legendeApercuPeriodicite()`,
partagée avec le formulaire.

**Rangée d'actions** (sous un trait pointillé) : **les actions du menu roue dentée sont
déplacées ici**, construites à partir de `actionItemsFor(p)` (mêmes conditions d'affichage,
mêmes `command`) :
- 1er bouton « Modifier » en primaire ;
- les autres en secondaire outlined, dans l'ordre de `actionItemsFor` (Aperçu, Historique,
  Réviser le montant, Annuler la révision, Décaler la date d'effet, Terminer/Réactiver) ;
- le sous-menu « Changer une valeur » devient **un** bouton qui ouvre un `p-menu` popup
  avec ses 4 items (Catégorie, Nécessité, Optimisation, Dérive) ;
- « Supprimer » en dernier, `severity="danger"` outlined, poussé à droite sur desktop ;
- sur mobile : grille de 2 colonnes, « Modifier » et « Supprimer » en pleine largeur ;
- rôle `VIEWER` (`!contexte.estEditor()`) : seuls Aperçu et Historique.

Le `p-menu #menuActions` et le bouton `pi-cog` de chaque carte sont **supprimés**.

---

## 5. Sections (groupes)

Remplacer le bandeau coloré `.separateur-groupe` par un en-tête plus léger, toujours
**sticky** (`top: 0`, fond `--app-bg` pour masquer les cartes qui défilent dessous) :

```
Logement  (3)                                       ≈ 1 935,00 CHF / mois
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━──────────────────────────────────────
```

- Gauche : `groupe.separator` en `font-bold` ~15 px, puis une pastille compteur
  (`groupe.nbPostes`, petite capsule `--app-line` / `--app-ink-muted`).
- Droite : **sous-total mensuel** du groupe = somme de `montantParMois(p)` (§3.2) des postes
  récurrents du groupe ; si le groupe contient des ponctuels, ajouter
  « + {somme} ponctuel ». Libellé « / mois » en muted.
- Dessous, pleine largeur : une **barre de proportion** (hauteur 4 px, rayon pill, fond
  `--app-line`) remplie à `sous-total du groupe / total des groupes affichés`, couleur
  `separateurAccent().fg` (couleur du type de liste). `title` = « {x} % du total affiché ».
- Espacement : ≈ 14 px au-dessus, 8 px en dessous ; les cartes du groupe suivent avec le
  même `gap` que dans le §3.
- Mode `regrouperPar === 'AUCUN'` : pas d'en-tête (comportement actuel).
- Supprimer l'indentation `ms-2 md:ms-3` des cartes regroupées.

Mettre à jour `postes-liste.component.scss` en conséquence (`.separateur-groupe` devient
`.entete-groupe` ou équivalent, sans fond coloré).

---

## 6. États

- **Chargement** : skeletons à la forme des nouvelles cartes (2 lignes + pied fin), dans le
  même conteneur à `gap`.
- **Vide** : inchangé (texte + bouton Créer / effacer les filtres).

---

## 7. Comportements à conserver

- Recherche surlignée dans le libellé.
- `navigerVersPoste(id)` (depuis l'historique) : faire défiler jusqu'à la carte, la mettre
  en surbrillance **et la déplier**.
- Après enregistrement d'un dialog (`onDialogEnregistre`, `charger()`), garder le même
  poste déplié s'il existe toujours.
- Tri, regroupement, filtres, options et sélection multiple : aucun changement de logique.

---

## 8. Composants

### 8.1 Primitives partagées — `shared/components/liste/`

Le patron de liste décrit ici est **mutualisé** : il sert la liste des postes, l'écran
*Argent de poche* et l'écran *Prorata des membres*. Les trois primitives ne connaissent
aucun modèle métier.

| Composant | Rôle | Entrées / sorties principales |
|---|---|---|
| `app-carte-liste` | coquille : cadre, tête cliquable, chevron, zone de détail, a11y | `contenuTete: TemplateRef`, `deplie`, `enSurbrillance`, `lisere`, `modeSelection`, `selectionInputId`, `idDetail`, `libelleBascule` ; `(basculer)` ; `<ng-content>` = détail |
| `app-entete-groupe` | en-tête de section sticky | `libelle`, `nbElements`, `libelleCompteur`, `sousTotal?`, `sousTotalPonctuel`, `part?`, `couleur`, `devise`, `uniteParMois`, `unitePonctuel`, `titreBarre` |
| `app-detail-liste` | paires libellé/valeur + rangée d'actions | `lignes: LigneDetail[]`, `actions: MenuItem[]`, `colonneLaterale` ; `<ng-content>` = blocs propres à l'écran |

Points structurants :

- La tête est passée en **`TemplateRef`** et non en `ng-content` : elle est rendue dans
  deux variantes exclusives (`<button>` dépliant / `<label>` de sélection), et deux
  `<ng-content>` de même sélecteur dans deux branches `@if` ne peuvent pas recevoir le
  même contenu.
- Les classes de zones de la tête (`zone-nom`, `zone-montant`, `zone-dates`,
  `zone-complement`, `zone-pied`) ainsi que `squelette-carte` et `etat-vide` vivent dans
  le partiel **global** `src/styles/_cartes-liste.css` : le contenu d'un `TemplateRef`
  reste dans la portée de styles de son composant déclarant. Même mécanisme que
  `_tableaux.css` / `.table-scroll`.
- `app-entete-groupe` n'affiche le sous-total et la barre de proportion que si `sousTotal`
  et `part` sont fournis. L'argent de poche et le prorata n'en passent pas (aucun montant
  n'y est sommable hors moteur) : ils n'ont que libellé + compteur.
- La rangée d'actions est construite à partir des `MenuItem` de l'écran, classés par leur
  clé `data` : `modifier` (primaire), `supprimer` (danger, poussé à droite),
  `changer-valeur` (bouton ouvrant un `p-menu` popup), le reste en secondaire outlined.

### 8.2 Composants propres aux postes

Dans `features/postes/postes-liste/components/` :

| Composant | Rôle | Entrées / sorties principales |
|---|---|---|
| `app-poste-carte` | tête d'un poste (2 lignes + pied) posée dans `app-carte-liste` | `poste`, `deplie`, `modeSelection`, `selectionne`, `cacherDetails`, `enSurbrillance` ; `basculer`, `selectionChange` |
| `app-poste-etiquettes` | construit et affiche le pied | `poste`, `cacherDetails`, `membresAffiches`, `successeur?` |
| `app-poste-detail` | blocs propres au poste projetés dans `app-detail-liste` | `lignes`, `actions: MenuItem[]`, `analyses`, `apercu: ApercuPeriodicitePoste \| null` |
| `shared/components/echelle-lecture` | note 1–5 en lecture seule | `label`, `valeur` |

Les composants reçoivent des valeurs **déjà calculées** par `PostesListeComponent`
(montant par mois, textes de dates, étiquettes) : pas de logique métier ni d'appel HTTP.
Ajouter les fonctions `montantParMois(p)`, `texteDates(p)`, `textePeriodicite(p)`,
`sousTotalGroupe(groupe)` dans le composant (ou un util pur testé).

### 8.3 Déclinaisons sur les autres écrans

| Écran | Tête de carte | Groupes | Détail déplié |
|---|---|---|---|
| **Argent de poche** | L1 nom / raison + montant (montant fixe, montant de l'allocation, ou **pourcentage du RàV** pour une politique VARIABLE) ; L2 période `mm.yyyy → mm.yyyy` + type · mode ; pied : tag Membre·Compte coloré | par membre / type / mois de début, **libellé + compteur** | Membre, Compte, Période ou Mois, Mode, Formule ou Montant + Motif |
| **Prorata des membres** | L1 plage de dates `jj.mm.aaaa → jj.mm.aaaa` (ou `→ …` si ouverte) à gauche, résumé des parts à droite ; **pas de pied d'étiquettes** | **par année de début**, libellé + compteur | Début, Fin (ou « Période ouverte »), puis une ligne par membre avec sa quote-part |

La formule complète d'une politique VARIABLE ne tient pas sur la ligne du montant : la
tête n'affiche que le pourcentage, la formule entière vit dans le détail.

---

## 9. Clés i18n à ajouter (fr)

```json
{
  "poste": {
    "liste": {
      "parMois": "/ mois",
      "depuisLe": "Depuis le {{debut}}",
      "duAu": "Du {{debut}} au {{fin}}",
      "depuisLeSansFin": "Depuis le {{debut}}, sans fin",
      "ponctuel": "ponctuel",
      "mensualise": "Mensualisé",
      "revisionSuivante": "→ {{montant}} dès le {{date}}",
      "revisionsMasqueesAvant": "{{n}} révision(s) précédente(s) masquée(s)",
      "revisionsMasqueesApres": "{{n}} révision(s) suivante(s) masquée(s)",
      "partDuTotal": "{{n}} % du total affiché",
      "detail": {
        "montant": "Montant",
        "validite": "Validité",
        "paiement": "Paiement",
        "repartition": "Répartition",
        "comptes": "Comptes",
        "analyse": "Analyse"
      },
      "deplier": "Afficher le détail de {{nom}}",
      "replier": "Masquer le détail de {{nom}}"
    }
  }
}
```

Réutiliser les clés existantes : `poste.oneShot`, `poste.periodiciteLabels` (via
`PeriodicitePipe`), `poste.revisionTag`, `poste.importanceValeur`,
`poste.potentielOptimisationValeur`, `poste.deriveExterneValeur`, `poste.momentOptions`,
`poste.modeOptions`, `poste.typeRepartitionOptions`, `poste.nbPostesGroupe`, et toutes les
clés d'actions déjà utilisées dans `actionItemsFor`.

---

## 10. Definition of Done

- [ ] Seule la zone liste a changé ; en-tête, barre de filtres, barre groupée et dialogs
  sont identiques.
- [ ] Ligne : libellé, montant par mois (`montant / periodiciteMois`), dates
  « Depuis le mm.yyyy » / « Du mm.yyyy au mm.yyyy », périodicité. Rien d'autre.
- [ ] Pied d'étiquettes dans la carte, séparé par un pointillé, absent s'il est vide, avec
  Comptes, Estimation, Mensualisé, Révision, Nécessité, Optimisation, Dérive.
- [ ] Plus de bouton roue dentée ; toutes les actions sont dans le détail déplié, avec les
  mêmes conditions qu'avant (y compris pour `VIEWER`).
- [ ] Un seul poste déplié à la fois ; Échap, focus et `aria-expanded` corrects.
- [ ] En-têtes de groupe sticky avec compteur, sous-total mensuel et barre de proportion.
- [ ] Mobile < 768 px : carte lisible sur 2 lignes + pied, actions en grille 2 colonnes.
- [ ] Aucune couleur / taille / rayon en dur ; rendu correct en clair et en `.dark`.
- [ ] Clés fr + en ajoutées ; aucun texte en dur.
- [ ] Tests unitaires : `montantParMois`, `texteDates`, `textePeriodicite`, construction des
  étiquettes (cas ponctuel, mensuel, trimestriel mensualisé, estimation, chaîne).
- [ ] `npm run build` et `npm test` passent (cf. `.github/copilot-instructions.md`).