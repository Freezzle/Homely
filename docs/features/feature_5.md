# Écran — Comparaison de deux scénarios

> **Statut** : spec fonctionnelle d'une fonctionnalité, pas un document d'architecture.
> Elle vient en complément de `docs/01-principes-et-moteur.md`, `docs/02-domaine-et-donnees.md`,
> `docs/03-architecture.md`, `docs/04-api-et-frontend.md` et des « Règles d'or » du
> [`docs/README.md`](../README.md) — à lire avant de coder. En cas de conflit entre ce
> document et l'un des quatre docs de référence, **les docs de référence gagnent**.
>
> **À qui s'adresse ce document** : à l'agent/IA qui implémente la fonctionnalité dans le
> projet réel (Angular 22 + PrimeNG 22 + Tailwind v4 côté front, Spring Boot 4 côté back).
> Ce document décrit **le besoin fonctionnel** — ce que l'écran doit permettre de faire et
> quelles données il manipule. Le **design visuel, le style, l'architecture des composants,
> la structure des dossiers, le state management, etc. sont laissés à l'appréciation de
> l'agent**, à condition de respecter les conventions déjà en place dans le projet (thème
> PrimeNG, Tailwind, découpage standalone components, i18n, etc.). Un prototype HTML
> interactif (`homely-comparaison-scenarios.html`) est fourni en pièce jointe : c'est une
> **référence de comportement et d'interactions**, pas une maquette à reproduire au pixel
> près — le prototype simule un moteur de calcul en JavaScript uniquement pour être
> autonome ; en production, les données proviennent de l'API réelle (doc 04).

## 1. Objectif

Permettre à un foyer de comparer deux **scénarios** budgétaires (par exemple : « Référence »
vs « Déménagement & optimisation ») côte à côte, sur une année et un périmètre donnés, pour
comprendre **où** et **quand** naît la différence entre les deux prévisions.

**User story** : *En tant qu'utilisateur du foyer (OWNER, EDITOR ou VIEWER), je choisis deux
scénarios existants, une année et un périmètre (foyer entier ou un membre), et je vois
comment mon solde disponible, mes catégories de dépenses et mes postes diffèrent entre les
deux.*

Écran **strictement en lecture** : aucune action d'écriture (pas de création/édition de
poste depuis cet écran). Il est donc visible sans restriction pour les trois rôles
(`OWNER`, `EDITOR`, `VIEWER`) — pas de masquage à prévoir pour ce cas précis, mais rester
cohérent avec le reste de l'application si un lien de navigation « éditer ce scénario » est
ajouté plus tard.

## 2. Entrées de l'écran

Un panneau de filtres, toujours visible, contrôle tout le reste de l'écran :

| Filtre | Description | Défaut |
| --- | --- | --- |
| Scénario de gauche (**A**) | Un des scénarios du foyer courant | Le scénario `estReference = true` |
| Scénario de droite (**B**) | Un autre scénario du foyer courant | Le scénario le plus récemment modifié, différent de A |
| Année | Une année de l'horizon commun aux deux scénarios (`anneeDepart` → `anneeDepart + horizonAnnees - 1`) | `anneeDepart` du scénario de référence |
| Périmètre | Foyer entier, ou un membre actif du foyer | Foyer |

Changer un filtre recalcule tout l'écran. Aucune option n'est enregistrée entre deux
visites (état volatile, propre à la session d'écran).

## 3. Modèle de calcul (rappel)

Tout ce que l'écran affiche découle de fonctions déjà spécifiées dans
`docs/01-principes-et-moteur.md` — **ne pas réinventer de logique de calcul ici** :

- `contribution(poste, année, mois)` / `contributionReelle(...)` — §3
- `quotePartEffective(poste, membre, année, mois)` — §5
- Agrégats mensuels `(revenus, charges, réserves, soldeDisponibleBrut, soldeDisponible)` — §4
- `argentDePoche(membre, année, mois)` — §7
- Ventilation par catégorie — §8

Le calcul doit être fait côté back (le moteur est un module isolé et testé au centime,
doc 03), l'écran ne fait qu'**afficher des projections déjà calculées** pour les deux
scénarios sur l'année et le périmètre demandés. Voir §10 pour le contrat de données attendu.

Point d'attention : le **Reste à vivre** et le **solde disponible** peuvent être négatifs et
ne doivent **jamais être clampés à 0** dans l'affichage (doc 01 §1) — les composants qui
affichent ces valeurs doivent gérer le signe négatif proprement (couleur, alignement de
barre, etc.), pas juste le cas positif.

## 4. Indicateurs — un concept transverse, pas un bandeau

L'écran s'articule autour de **cinq indicateurs budgétaires** issus de la cascade du doc 01 :

| Indicateur | Formule | Sens « favorable » |
| --- | --- | --- |
| Revenus | `Σ contribution` des postes `REVENU` | plus haut = mieux |
| Charges | `Σ contribution` des postes `CHARGE` | plus bas = mieux |
| Réserves | `Σ contribution` des postes `RESERVE` | mouvement interne — ni bon ni mauvais en soi, mais réduit le disponible |
| Argent de poche | `argentDePoche` cumulé | plus bas = plus de disponible |
| Solde disponible | `RàV − argent de poche` | plus haut = mieux |

Ces cinq indicateurs ne sont **plus affichés en bandeau de synthèse en tête d'écran** dans
cette itération (retiré volontairement pour désencombrer l'écran), mais ils restent le
squelette de données de tout le reste de l'écran : ce sont les colonnes de la cascade
budgétaire (§7), les critères de filtrage du tableau de catégories (§6), les lignes de la
carte de chaleur (§8).

**Contrainte d'implémentation Angular — un composant par indicateur.** Chaque indicateur
doit être encapsulé dans **son propre composant Angular**, réutilisable indépendamment de
cet écran (ex. `RevenusIndicateurComponent`, `ChargesIndicateurComponent`, ou un unique
composant générique paramétrable type `IndicateurEcartComponent` si son contrat suffit à
couvrir les cinq cas — au choix de l'agent selon les conventions du projet). Chaque
composant doit être capable de recevoir a minima :

- une **valeur** pour le scénario A et une pour le scénario B (ou directement l'écart déjà
  calculé, selon ce qui est le plus adapté à l'architecture retenue) ;
- le **sens favorable** de l'indicateur (pour colorer l'écart en positif/négatif) ;
- un **libellé** et, si pertinent, une **note contextuelle** (ex. « mouvement interne » pour
  les réserves, « réduit le disponible » pour l'argent de poche).

Objectif : pouvoir réutiliser ces composants ailleurs dans l'application (tableau de bord
d'un scénario seul, futur bandeau de synthèse, écran mobile, etc.) sans dupliquer la logique
d'affichage d'un écart. Le détail de l'API du composant (Inputs/Outputs, signals vs
`@Input()` classiques, dumb vs smart component) est laissé à l'agent, dans le respect des
conventions déjà utilisées ailleurs dans le projet Angular.

## 5. Solde disponible mois par mois

Un graphique comparant, pour l'année sélectionnée, le **solde disponible** des deux
scénarios sur les 12 mois, plus une série secondaire représentant l'écart mensuel
(`soldeB - soldeA`).

- Axe des X : les 12 mois de l'année sélectionnée.
- Deux séries de solde (une par scénario) + une série d'écart.
- Doit rester lisible même quand un ou plusieurs mois ont un solde négatif.

Le prototype utilise Chart.js ; libre à l'agent d'utiliser la librairie de graphiques déjà
en place dans le projet Angular (ou d'en introduire une si aucune n'existe encore), du
moment que le comportement (deux séries + écart, infobulle par mois) est conservé.

## 6. Totaux par catégorie

Un tableau listant, pour l'année et le périmètre sélectionnés, l'**écart annuel** entre les
deux scénarios pour chaque **catégorie** (`Categorie`, doc 02).

Colonnes strictement : **Catégorie**, **Type** (Revenu / Charge / Réserve), **Écart**
(signé, `totalCatégorieB - totalCatégorieA`), **Poids de l'écart** (représentation visuelle
proportionnelle à l'ampleur de l'écart, relative aux autres catégories affichées).

- Pas d'accordéon, pas de détail poste par poste sous une ligne de catégorie (ce niveau de
  détail existe déjà dans le bloc « Ce qui change dans les postes », §9 — pas besoin de le
  dupliquer ici).
- Filtrable par type de poste (Tous / Revenus / Charges / Réserves).
- Filtrable sur « écarts uniquement » (masquer les catégories dont l'écart est nul).
- Triable par catégorie (alphabétique) et par écart (amplitude absolue décroissante par
  défaut, pour faire remonter les plus gros écarts en premier).
- État vide explicite si le filtre ne retourne aucune ligne (pas un tableau simplement
  vide sans explication).

## 7. Cascade budgétaire

Le cœur de l'écran : la cascade de calcul du doc 01 (`Revenus − Charges − Réserves = RàV`,
`RàV − Argent de poche = Solde disponible`), affichée pour permettre une comparaison
visuelle immédiate entre les deux scénarios, **sur un mois donné ou sur l'année complète**.

**Sélecteur de granularité** : bascule **Mois / Année**.

- **Mois** : un sélecteur de mois (avec navigation précédent/suivant) permet de parcourir
  les 12 mois de l'année sélectionnée. La cascade affiche les agrégats de ce mois précis.
- **Année** : la cascade affiche les totaux annuels (mêmes agrégats que le total de la
  projection annuelle, doc 01 §4). Le sélecteur de mois est masqué dans ce mode (il n'a pas
  de sens tant qu'« Année » est actif).

**Disposition** : contrairement à une cascade classique où chaque étape du calcul serait une
ligne, ici c'est l'inverse — **une ligne par scénario**, et une colonne par étape (Revenus,
Charges, Réserves, Reste à vivre, Argent de poche, Solde disponible). Chaque cellule contient
une barre horizontale dont la longueur est proportionnelle à la valeur, **mise à l'échelle
par colonne** (le maximum entre A et B pour cette étape précise, pas un maximum global — sans
quoi l'argent de poche, toujours plus petit que les revenus, deviendrait illisible). Le fait
d'empiler la ligne du scénario A directement au-dessus de celle du scénario B, avec les
colonnes alignées, permet de repérer d'un coup d'œil sur quelle étape porte l'écart. Une
ligne « Écart » synthétise le delta chiffré de chaque colonne.

Ce choix de disposition (ligne = scénario, colonne = étape, barres alignées verticalement
pour comparaison) est fonctionnel et doit être conservé ; sa réalisation technique (table
HTML, composant PrimeNG, grille CSS) est au choix de l'agent.

## 8. Où se situe l'écart

Une carte de chaleur **mois × catégorie** : chaque cellule représente l'effet de l'écart
entre B et A sur le solde disponible, pour cette catégorie et ce mois (positif = B fait
mieux, négatif = B coûte plus). Inclut également l'argent de poche comme ligne à part (ce
n'est pas une catégorie au sens du doc 02, mais son écart doit être visible ici).

- Couleur + intensité proportionnelle à l'ampleur de l'écart, échelle commune à toute la
  grille (contrairement à la cascade budgétaire qui, elle, est mise à l'échelle par
  colonne).
- Une catégorie sans écart significatif sur aucun mois peut être omise pour ne pas
  surcharger la grille.
- Doit permettre de repérer en un coup d'œil : quelle catégorie pèse le plus dans l'écart
  global, et à quel(s) mois.

## 9. Ce qui change dans les postes

Une liste comparant, poste à poste, les deux scénarios — à la manière d'une revue de
changements (diff) :

- **Ajouté** : poste présent dans B, absent de A.
- **Supprimé** : poste présent dans A, absent de B.
- **Modifié** : poste présent dans les deux mais dont un champ significatif diffère
  (montant, périodicité, mode, moment, dates de validité, devise).
- **Inchangé** : poste strictement identique dans les deux scénarios.

Chaque ligne affiche : la description du poste, sa catégorie et sa périodicité, le montant
annuel dans A et dans B (le cas échéant), l'effet net sur le solde disponible.

Un poste chaîné par révision (`posteOrigineId`, doc 01 §9 / doc 02) doit être identifiable
visuellement (ex. étiquette « révision ») plutôt que traité comme un simple ajout/suppression
sans lien — c'est une continuité du même poste dans le temps, pas un poste indépendant.

Filtrable par statut : Changements (tout sauf inchangé, par défaut), Ajoutés, Supprimés,
Modifiés, Tout.

## 10. Contrat de données attendu du back

Cet écran a besoin, pour un couple `(scénarioA, scénarioB, année, périmètre)`, des données
suivantes — à exposer via l'API existante ou un nouvel endpoint de comparaison, selon ce qui
est le plus cohérent avec les contrats déjà définis dans `docs/04-api-et-frontend.md` (à
consulter pour le format exact des DTO et des routes) :

- La **projection annuelle** de chaque scénario pour le périmètre donné (mensuelle +
  totaux) — a priori déjà exposée pour un scénario seul ; à voir si un appel groupé
  « comparer deux scénarios » a du sens côté API pour éviter deux allers-retours, ou si deux
  appels suffisent et que la comparaison se fait côté front.
- Les **totaux par catégorie** de chaque scénario pour l'année et le périmètre donnés.
- La **liste des postes** de chaque scénario (pour construire le diff poste à poste côté
  front) — inclure `posteOrigineId` pour détecter les révisions.
- L'**argent de poche** cumulé par mois pour le périmètre donné (déjà couvert si la
  projection annuelle inclut `soldeDisponible` net de l'argent de poche, mais le détail
  brut/poche doit être distinguable pour l'afficher séparément dans la cascade).

Le multi-tenant s'applique normalement : les deux scénarios comparés doivent appartenir au
même foyer que celui de l'utilisateur courant (test d'accès croisé à prévoir si un nouvel
endpoint est créé, doc README « Règles d'or »).

## 11. Design, style et accessibilité

- Respecter le thème PrimeNG 22 et Tailwind v4 déjà en place dans le projet (pas de
  PrimeFlex, doc README). Aucun SCSS custom ne devrait être nécessaire au-delà des tokens
  déjà définis par le thème du projet.
- Aucun texte en dur : tout passe par les clés i18n existantes (doc README, Definition of
  Done).
- Tableaux larges (cascade budgétaire, détail mensuel le cas échéant) : prévoir un
  défilement horizontal contenu dans son propre conteneur plutôt que de faire défiler toute
  la page.
- Respecter les focus visibles au clavier et `prefers-reduced-motion`.
- Le prototype HTML joint applique un thème clair/sombre basé sur `prefers-color-scheme` —
  à adapter au mécanisme de thème déjà en place dans le projet Angular, s'il existe.

## 12. Definition of Done (spécifique à cet écran)

En complément de la Definition of Done générale du projet (doc README) :

- [ ] Les cinq indicateurs (§4) sont chacun un composant Angular autonome et réutilisable.
- [ ] Le moteur de calcul n'est **pas** dupliqué côté front : l'écran consomme des données
  déjà agrégées par le back (doc 03 — moteur isolé côté serveur).
- [ ] Le Reste à vivre et le solde disponible s'affichent correctement quand ils sont
  négatifs, sur toutes les visualisations (graphique, cascade, carte de chaleur).
- [ ] La bascule Mois/Année de la cascade budgétaire fonctionne dans les deux sens sans
  recharger la page ni perdre les autres filtres.
- [ ] Le filtrage et le tri du tableau de catégories, le filtrage du diff de postes, et la
  navigation mensuelle sont couverts par des tests unitaires de composants.
- [ ] Les trois rôles (`OWNER`, `EDITOR`, `VIEWER`) accèdent à l'écran sans différence de
  comportement (écran en lecture seule).
- [ ] Aucun texte en dur ; toutes les chaînes passent par i18n.

## 13. Annexes

- Prototype de référence : `homely-comparaison-scenarios.html` (autonome, moteur JS de
  démonstration inclus — sert uniquement à valider les interactions et la lecture visuelle,
  pas à être repris tel quel).
- Vocabulaire à respecter : voir le glossaire du `docs/README.md` (Foyer, Scénario, Poste,
  Membre, Contribution, Reste à vivre, etc.) — les noms de composants, variables et DTO
  doivent rester cohérents avec ce langage ubiquitaire plutôt que d'introduire une
  terminologie anglaise ou divergente.