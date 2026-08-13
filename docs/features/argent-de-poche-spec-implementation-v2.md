# Spec d'implémentation — Argent de poche (politiques + allocations sur mesure)

> **Note pour l'agent qui implémente cette fonctionnalité**
> Ce document décrit une évolution à ajouter à une application existante de budgétisation
> (prévisions de charges, revenus et réserves, avec un moteur qui calcule un "Reste à vivre" —
> RàV — mensuel par membre, et un dashboard mensuel existant par membre). Il **remplace et
> complète** un document de spec antérieur (`argent-de-poche-spec-implementation.md`,
> versions précédentes) — celui-ci est la référence à jour.
>
> Les noms d'entités utilisés ici (`Foyer`, `Membre`, `Scenario`, `Poste`, `Compte`, etc.)
> sont ceux discutés lors de la conception de l'app et **peuvent ne pas correspondre
> exactement au code actuel**. Avant d'implémenter quoi que ce soit :
> 1. Vérifie les noms réels des entités, services et endpoints dans le code.
> 2. Vérifie comment le RàV mensuel par membre est actuellement exposé — cette fonctionnalité
>    en dépend entièrement et ne doit pas dupliquer ce calcul.
> 3. Repère l'écran de "dashboard mensuel par membre" existant — c'est là que doit s'intégrer
>    le widget décrit en §6, pas dans un nouvel écran séparé.
> 4. Adapte le nommage, les conventions (REST, style de validation, structure de composants)
>    à ce qui existe déjà dans le projet plutôt que de suivre ce document au pied de la lettre.
> 5. Les sections **"Point d'attention"** listent des décisions produit non tranchées — à
>    faire valider par le porteur produit avant de coder, pas à trancher soi-même.

---

## 1. Contexte fonctionnel

Deux concepts distincts, à ne pas confondre dans le modèle de données :

- **`PolitiquePoche`** — un comportement récurrent, actif sur une période donnée (ex. "500 CHF
  de socle + 20% du surplus, de janvier à décembre 2026"). C'est la réponse à *"comment je
  veux fonctionner sur la durée"*.
- **`AllocationSurMesure`** — un montant fixé pour **un seul mois précis**, indépendant de
  toute politique. C'est la réponse à *"ce mois-ci, pour une raison ponctuelle, je veux un
  chiffre différent"* (ex. juillet 2026 : 200 CHF au lieu des 820 CHF que la politique
  aurait donné, parce que le membre part en vacances payées par ailleurs).

Le second concept existe pour éviter d'avoir à découper une politique continue en plusieurs
tronçons pour un seul mois d'exception — ce qui serait correct au niveau des données mais
beaucoup trop lourd à l'usage.

**Priorité de résolution, pour un membre et un mois donnés :**
```
1. Une AllocationSurMesure existe pour ce membre/mois ?  → on l'utilise telle quelle.
2. Sinon, une PolitiquePoche est active ce mois-là ?      → on applique sa formule.
3. Sinon                                                   → 0 CHF (rien de configuré).
```

C'est une fonctionnalité **purement prévisionnelle** : aucune dépense réelle n'est saisie ou
suivie. Le montant résolu enrichit la prévision budgétaire existante, pas un livre de comptes.

### Rappel — formule de calcul d'une PolitiquePoche

```
socleEffectif = socle                              (toujours versé intégralement, jamais réduit)
surplus       = max(0, RàV_du_mois − socle)
bonus         = surplus × pourcentage / 100         (mode variable uniquement)
brut          = socleEffectif + bonus
argentDePoche = min(brut, plafond)                  (mode variable) — ou montantFixe (mode fixe)
trésorerie    = RàV_du_mois − argentDePoche          (peut être négative → découvert assumé)
```

Deux modes de calcul coexistent par politique : **variable** (socle + % du surplus, plafonné)
et **fixe** (montant constant chaque mois). Dans les deux modes, le montant peut créer un
découvert — c'est un comportement voulu, pas un bug.

---

## 2. Modèle de données

### 2.1 `PolitiquePoche` (rappel, inchangé depuis la version précédente de ce document)

| Champ | Type | Contrainte | Description |
|---|---|---|---|
| `id` | UUID / Long | PK | Identifiant |
| `membreId` | FK → `Membre` | NOT NULL | Membre concerné |
| `compteId` | FK → `Compte` | NOT NULL | Compte crédité chaque mois |
| `scenarioId` | FK → `Scenario` | à confirmer | Voir point d'attention §7 |
| `nom` | String | NOT NULL | Nom libre |
| `dateDebut` | Mois (`YYYY-MM`) | NOT NULL | Début de la période |
| `dateFin` | Mois ou `NULL` | — | `NULL` = politique ouverte |
| `mode` | Enum `variable` \| `fixe` | NOT NULL | |
| `socle` | Decimal | NOT NULL, ≥ 0 | Mode variable — minimum garanti |
| `pourcentage` | Decimal (0–100) | NOT NULL | Mode variable — part du surplus prélevée |
| `plafond` | Decimal | NOT NULL, ≥ `socle` | Mode variable — maximum absolu |
| `montantFixe` | Decimal ou `NULL` | NOT NULL si `mode = fixe` | Mode fixe — montant constant |

**Règle de continuité** (rappel, inchangée) : pour un membre donné, l'ensemble des
`PolitiquePoche` doit former une partition sans trou et sans chevauchement de la ligne du
temps — voir le document précédent pour le détail de la validation. Cette règle **ne
s'applique pas** aux `AllocationSurMesure` (voir §2.2).

### 2.2 `AllocationSurMesure` (nouvelle entité)

| Champ | Type | Contrainte | Description |
|---|---|---|---|
| `id` | UUID / Long | PK | Identifiant |
| `membreId` | FK → `Membre` | NOT NULL | Membre concerné |
| `mois` | Mois (`YYYY-MM`) | NOT NULL | Le seul mois concerné par cette allocation |
| `montant` | Decimal | NOT NULL, ≥ 0 | Montant qui remplace le calcul de la politique ce mois-là |
| `raison` | String | nullable | Note libre optionnelle (ex. "Vacances") |
| `compteId` | FK → `Compte` | NOT NULL | Compte crédité — indépendant de celui d'une politique éventuelle |

**Contrainte d'unicité** : `(membreId, mois)` doit être unique — un seul montant sur mesure
possible par membre et par mois. Voir le point d'attention §7 sur le comportement en cas de
tentative de doublon.

**Pas de règle de continuité.** Une `AllocationSurMesure` est un point isolé dans le temps,
pas une période — rien à valider en termes de chevauchement ou de trou. Elle peut exister
même pour un mois où **aucune** politique n'est active (cas "argent de poche = 0 → l'utilisateur
en crée une depuis le dashboard").

---

## 3. Service de résolution (le cœur de cette évolution)

Une méthode centrale, à exposer aussi bien au backend (pour les calculs persistés/exports)
qu'utilisée cohéremment côté frontend (pour l'aperçu en direct dans les popins) :

```
resoudreArgentDePoche(membreId, mois) → {
  montant: number,
  source: 'allocation' | 'politique' | 'aucune',
  allocation?: AllocationSurMesure,   // si source = 'allocation'
  politique?: PolitiquePoche,          // si source = 'politique'
  rav: number,                         // RàV du mois, pour affichage/contexte
}
```

Logique :
1. Chercher une `AllocationSurMesure` pour `(membreId, mois)`. Si trouvée → la retourner
   directement, `montant` = son champ `montant`.
2. Sinon, chercher la `PolitiquePoche` active pour `(membreId, mois)` (celle dont
   `dateDebut ≤ mois ≤ dateFin` ou `dateFin = NULL`). Si trouvée → appliquer sa formule
   sur le RàV du mois (récupéré via le moteur de prévision existant).
3. Sinon → `{ montant: 0, source: 'aucune' }`.

Cette méthode est appelée à trois endroits distincts (voir §5) — centralise-la dans un seul
service pour éviter que la logique de priorité diverge entre eux.

---

## 4. Écran principal — liste

Deux actions désormais, plus deux sections de liste :

- **Bouton "Créer politique"** — ouvre le stepper de configuration (§5.1), comme avant.
- **Bouton "Créer une allocation sur mesure"** — ouvre la popin allocation (§5.2) en mode
  libre : membre et mois tous deux sélectionnables, aucun verrouillage.
- **Section "Mes politiques"** — inchangée par rapport à la version précédente.
- **Section "Allocations sur mesure"** (nouvelle) — liste plate de toutes les
  `AllocationSurMesure`, tous membres confondus, triées par mois. Chaque ligne (membre, mois,
  montant, raison) est cliquable et ouvre la popin d'édition correspondante.

---

## 5. Popins

### 5.1 Popin PolitiquePoche — stepper à 4 étapes désormais

Les étapes 1 à 3 (Membre → Configuration → Compte) sont inchangées par rapport au document
précédent. **Nouvelle étape 4 : "Allocations sur mesure".**

| Étape | Contenu |
|---|---|
| 4. Allocations sur mesure | Liste des `AllocationSurMesure` du membre sélectionné à l'étape 1, dont le mois tombe dans `[dateDebut, dateFin]` de la politique en cours d'édition. Chaque ligne éditable/supprimable. Un bouton "+ Ajouter" ouvre la popin allocation (§5.2) avec le membre verrouillé et le choix du mois **borné** à la période de la politique. |

**Comportement critique à respecter** : les créations/modifications/suppressions
d'allocations faites à cette étape sont **persistées immédiatement**, indépendamment du
bouton "Enregistrer" final du stepper — celui-ci ne sauvegarde que les champs de la
`PolitiquePoche` elle-même (nom, période, mode, paramètres, compte). Ce sont deux entités
distinctes avec deux cycles de sauvegarde distincts ; ne pas les coupler dans une seule
transaction de formulaire, ça compliquerait inutilement l'UX (l'utilisateur ne devrait pas
perdre une allocation ajoutée à l'étape 4 parce qu'il annule ensuite l'édition de la politique).

**Cas d'une politique pas encore créée** (étape 4 atteinte depuis le flow "Créer politique",
avant le premier "Enregistrer") : afficher un message explicatif plutôt qu'une liste vide ou
un bouton d'ajout non fonctionnel — ex. *"Enregistre d'abord cette politique pour pouvoir lui
ajouter des allocations sur mesure."* Une allocation a besoin d'une période de référence
valide (pour borner le choix du mois) et d'un membre confirmé ; les exiger avant que la
politique existe réellement introduirait un état transitoire fragile à gérer (que faire si
l'utilisateur ajoute des allocations puis annule la création de la politique ?).

### 5.2 Popin AllocationSurMesure — réutilisable, un seul composant, trois contextes d'ouverture

Une seule popin, dont le comportement varie selon le contexte qui l'ouvre :

| Champ | Comportement |
|---|---|
| Membre | Verrouillé (affiché en lecture seule) si le contexte le connaît déjà ; sélectionnable sinon |
| Mois | Verrouillé si le contexte impose un mois précis ; sinon sélectionnable, éventuellement **borné** à une plage (ex. la période d'une politique) |
| Montant | Toujours éditable ; peut être **pré-rempli** avec une suggestion selon le contexte |
| Raison | Toujours éditable, optionnelle |
| Compte | Toujours éditable, liste filtrée aux comptes du membre + comptes communs |

**Les trois points d'entrée et leur configuration :**

1. **Depuis l'écran principal** ("Créer une allocation sur mesure") : rien de verrouillé,
   aucune suggestion de montant.
2. **Depuis l'étape 4 d'une politique** : membre verrouillé (celui de la politique), mois
   borné à `[dateDebut, dateFin]` de la politique mais librement choisi dans cette plage.
3. **Depuis le dashboard mensuel d'un membre** (§6) : membre **et** mois tous deux
   verrouillés (le contexte du dashboard les détermine déjà) ; le montant est **pré-rempli**
   avec le résultat actuel de `resoudreArgentDePoche()` pour ce mois — que ce soit le calcul
   de la politique en cours ou `0` — pour donner un point de départ éditable plutôt qu'un
   champ vide.

Le composant doit accepter ces trois configurations via des paramètres d'entrée simples
(membre verrouillé ou non, mois verrouillé ou non, bornes de mois, montant suggéré) plutôt
que de dupliquer la popin trois fois.

---

## 6. Intégration au dashboard mensuel existant

Sur l'écran de dashboard mensuel d'un membre (écran déjà existant dans l'app — **à localiser
dans le code, pas à recréer**), ajouter un petit widget "Argent de poche" :

- Appelle `resoudreArgentDePoche(membreId, moisAffiché)` avec le membre et le mois déjà
  déterminés par le contexte de la page (pas de sélecteur à ajouter, contrairement à la
  maquette de démo fournie qui simule ce contexte avec deux `<select>`).
- Affiche le montant résolu, avec une indication de la source (ex. un petit badge "Politique"
  ou "Allocation sur mesure").
- Affiche un bouton dont le libellé et le comportement dépendent de la source :
  - Si `source === 'allocation'` → **"Modifier l'allocation de ce mois"**, ouvre la popin
    (§5.2) en mode édition, membre et mois verrouillés.
  - Si `source === 'politique'` ou `source === 'aucune'` → **"Créer une allocation sur mesure
    pour ce mois"**, ouvre la popin en création, membre et mois verrouillés, montant
    pré-rempli avec la valeur actuellement affichée (celle de la politique, ou 0).

### Point d'attention — où exactement dans le dashboard mensuel ?
> Ce document ne peut pas préciser l'emplacement visuel exact du widget, n'ayant pas
> connaissance de la mise en page réelle du dashboard mensuel existant. À positionner selon
> ce qui fait sens dans l'écran actuel (probablement à proximité de l'affichage du Reste à
> vivre du mois, puisque l'argent de poche en dépend directement).

---

## 7. Points d'attention à trancher avant implémentation

> **Comportement en cas de doublon `(membreId, mois)` sur une allocation.** La maquette
> affiche un avertissement ("une allocation existe déjà pour ce mois, l'enregistrer ici la
> remplacera") puis écrase silencieusement l'ancienne si l'utilisateur confirme malgré tout.
> C'est probablement suffisant en pratique (le cas se produit rarement, seulement si
> l'utilisateur ouvre volontairement une création alors qu'une édition existe déjà), mais à
> valider — une alternative plus stricte serait d'empêcher complètement la création et de
> rediriger vers l'édition de l'allocation existante.

> **Allocation "orpheline" après modification d'une politique.** Si une `AllocationSurMesure`
> existe pour juillet 2026 et que la politique associée à ce membre est ensuite raccourcie
> pour se terminer en juin 2026, l'allocation continue d'exister sur un mois où (a) l'ancienne
> politique ne couvre plus rien, et (b) une nouvelle politique différente pourrait
> désormais être active. Comme `resoudreArgentDePoche()` vérifie l'allocation *en premier*,
> peu importe : l'allocation continue de s'appliquer même sans politique dessous, ce qui est
> cohérent avec la règle de résolution — mais l'utilisateur pourrait ne plus se souvenir de
> son existence. Pas d'action bloquante nécessaire à ce stade, mais envisager un signalement
> discret (ex. dans la liste "Allocations sur mesure" de l'écran principal, un badge "hors
> politique" quand aucune politique ne couvre plus le mois de l'allocation) si les retours
> utilisateurs montrent que c'est source de confusion.

> **Formule % sur le surplus vs sur le RàV brut**, **scope scénario**, **stratégie de
> cascade sur modification de politique adjacente**, **insertion d'une politique "au
> milieu"** : ces points, déjà signalés dans la version précédente de ce document, restent
> non tranchés et toujours pertinents. Se référer à `argent-de-poche-spec-implementation.md`
> (version antérieure) pour le détail — non reproduits ici pour éviter la duplication.

---

## 8. Backend — ajouts par rapport à la version précédente de la spec

- Nouvelle entité `AllocationSurMesure` (voir §2.2), avec un index unique sur `(membreId, mois)`.
- Nouveau service (ou méthode ajoutée au service existant) exposant `resoudreArgentDePoche()`
  (§3) — c'est la seule pièce de logique métier réellement nouvelle et critique, tout le reste
  n'est que du CRUD standard.
- Endpoints CRUD pour `AllocationSurMesure`, scopés par membre :
  ```
  GET    /api/membres/{membreId}/allocations-sur-mesure
  POST   /api/membres/{membreId}/allocations-sur-mesure
  PUT    /api/allocations-sur-mesure/{id}
  DELETE /api/allocations-sur-mesure/{id}
  GET    /api/membres/{membreId}/argent-de-poche/{mois}   → résolution pour un mois (dashboard)
  ```
- **Aucune validation de continuité** à ajouter pour ces endpoints (contrairement à
  `PolitiquePoche`) — seule la contrainte d'unicité `(membreId, mois)` doit être vérifiée
  côté serveur, avec le comportement à trancher au point d'attention §7.

---

## 9. Frontend (Angular + PrimeNG)

### Composants à ajouter (en complément de ceux déjà décrits dans le code fourni précédemment)

| Composant | Rôle |
|---|---|
| `AllocationSurMesureListeComponent` | Section "Allocations sur mesure" de l'écran principal |
| `AllocationSurMesureFormComponent` | La popin réutilisable (§5.2), avec des `input()` signal pour `membreVerrouille`, `moisVerrouille`, `moisMin`/`moisMax`, `montantSuggere` |
| `ArgentDePocheDashboardWidgetComponent` | Le petit widget à intégrer dans le dashboard mensuel existant (§6) |

### Étendre l'existant

- `PolitiquePocheFormComponent` (déjà livré) : ajouter la 4ᵉ étape du stepper, qui héberge une
  instance de `AllocationSurMesureListeComponent` filtrée par membre + période.
- `PolitiquePocheService` (déjà livré) : ajouter les signals/méthodes pour
  `AllocationSurMesure` et la méthode `resoudreArgentDePoche()`, ou créer un service dédié si
  la séparation des responsabilités est préférable dans les conventions du projet.

### Point d'attention — le code Angular déjà fourni ne couvre pas encore cette évolution
> Le dossier de composants Angular/PrimeNG livré précédemment (`argent-de-poche-v2/`,
> compilé et vérifié avec `ngc --strictTemplates`) a été écrit **avant** l'introduction du
> concept `AllocationSurMesure` et de la 4ᵉ étape du stepper. Il reste une bonne base
> structurelle (signals, standalone, patterns de validation) mais doit être étendu pour
> intégrer cette évolution — ne pas repartir de zéro, mais ne pas non plus le considérer
> comme fonctionnellement complet en l'état.

---

## 10. Fichiers de référence joints

- **`argent-de-poche-allocations.html`** — maquette HTML interactive et fonctionnelle,
  **référence de comportement à jour** pour tout ce document : liste principale avec les deux
  boutons, stepper à 4 étapes, popin allocation réutilisable avec ses trois contextes de
  verrouillage, et démo du widget dashboard mensuel (section "🧪 Démo" en bas de page,
  simulée avec des sélecteurs manuels puisqu'un vrai dashboard n'existe pas dans cette
  maquette autonome). Elle remplace toutes les maquettes HTML antérieures envoyées au fil de
  la conversation.
- **`argent-de-poche-v2/`** (dossier de composants Angular + PrimeNG, livré précédemment) —
  référence structurelle pour les conventions de code (signals, standalone, validation), à
  étendre selon §9 plutôt qu'à utiliser tel quel.
- **`argent-de-poche-spec-implementation.md`** (version antérieure de ce document) — toujours
  valide pour les points non repris ici (détail de la validation de continuité des
  politiques, points d'attention généraux listés au §7).
