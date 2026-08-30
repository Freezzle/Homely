# Barre filtres / tri — spécification fonctionnelle

Cible : `postes-liste.component.html` (listes Revenus / Charges / Réserves).
Ce document décrit **l'intention et le comportement attendu**. L'implémentation
(structure des composants, styles, gestion d'état) reste à l'appréciation du projet.

---

## 1. Le problème à résoudre

La zone de filtres actuelle occupe trois blocs empilés :

1. le select de tri + le champ de recherche + les boutons d'action,
2. les trois multi-selects (catégories, comptes, membres),
3. sur mobile ces éléments passent les uns sous les autres.

Résultat : environ 270 px sur téléphone et 100 px sur écran large sont consommés
**avant le premier poste**. Sur un téléphone, l'utilisateur voit deux postes à
l'ouverture de la page.

Objectif : **une seule ligne, de hauteur constante, qui ne grandit jamais**, quel
que soit le nombre de filtres actifs.

---

## 2. Principe directeur

> Une barre unique. Ce qui ne tient pas dedans passe dans un menu, jamais sur une
> deuxième ligne.

Trois règles qui découlent de ce principe :

- **La hauteur est un invariant.** Ajouter un filtre ne doit jamais repousser la
  liste vers le bas. Si une information ne tient pas, elle se compte au lieu de
  s'afficher.
- **Un contrôle visible par intention.** Chercher, trier, filtrer. Tout le reste
  (densité, colonnes, mode sélection) va dans les menus ou disparaît.
- **Rien ne se perd.** Chaque filtre actif reste retrouvable en un geste, même
  s'il n'est pas visible à l'écran.

---

## 3. Composition de la barre

De gauche à droite :

| Élément | Rôle |
|---|---|
| **Champ de recherche** | Occupe tout l'espace disponible. Prioritaire, car c'est l'action la plus fréquente. |
| **Bouton « Trier »** | Ouvre un menu. Affiche le critère courant et le sens. |
| **Bouton « Filtres »** | Ouvre un menu. Affiche une pastille avec le **nombre** de filtres actifs. |

La barre reste visible pendant le défilement de la liste.

### Ce que ces trois éléments remplacent

- le select de tri → bouton **Trier**
- le champ de recherche par description → **champ de recherche** (élargi à
  d'autres champs, voir §4)
- les trois multi-selects → menu **Filtres**
- le menu « visibilité des détails » → à déplacer dans un menu d'affichage
  au niveau de l'en-tête de page, pas dans la barre de filtres
- le bouton « activer le mode sélection » → à supprimer : la sélection se
  déclenche au survol sur desktop et par appui long sur mobile

---

## 4. Le champ de recherche

Comportement attendu :

- **Recherche instantanée**, sans bouton de validation, avec une temporisation
  courte avant de relancer le filtrage.
- **Insensible aux accents et à la casse.** Saisir `impots` doit trouver
  « Acompte impôts », `creche` doit trouver « Crèche ». C'est un point non
  négociable pour une application francophone.
- **Portée élargie** : la description, mais aussi la catégorie et le compte.
  L'utilisateur ne sait pas dans quel champ se trouve le mot qu'il cherche.
- **Surlignage** de la portion correspondante dans le libellé des résultats.
- **Bouton d'effacement** visible dès que le champ contient du texte.
- Optionnel mais recommandé : **préfixes de recherche** du type `cat:santé`,
  `membre:marc`, `compte:élodie`, `>500`. Ils permettent aux utilisateurs
  avancés de filtrer sans ouvrir de menu. Documenter la syntaxe dans le texte
  d'invite du champ.

Sur desktop, un raccourci clavier (`/`) place le focus dans le champ.

---

## 5. Le menu « Trier »

Contenu :

- La **liste des critères** de tri sous forme de choix exclusif : équivalent
  mensuel, montant saisi, description, date d'effet, et tout autre critère déjà
  présent dans `triOptions`.
- Le **sens de tri**, croissant ou décroissant, comme réglage séparé.

Deux points importants :

- **Tri et regroupement sont deux choses distinctes.** Aujourd'hui `triActuel`
  pilote à la fois l'ordre des postes et l'apparition des séparateurs de groupe.
  Il faut les séparer : un réglage « Trier par », un réglage « Regrouper par ».
  Le regroupement peut vivre dans ce même menu ou dans le menu d'affichage.
- **Le sens de tri doit exister.** Il n'est actuellement pas exposé.

Le bouton affiche en permanence le critère courant, pour qu'on sache dans quel
ordre on lit sans ouvrir le menu.

---

## 6. Le menu « Filtres »

C'est lui qui absorbe les trois multi-selects. Il contient des sections :

- **État** — actifs, à venir, terminés. Cette notion existe déjà dans les données
  (`debut` / `fin`) mais n'est aujourd'hui visible ni filtrable. C'est le filtre
  le plus utile et il devrait figurer en premier.
- **Nature** — estimations, montants confirmés.
- **Catégorie**, **Compte**, **Membre** — les listes existantes.

Attendus de comportement :

- **Chaque valeur affiche son volume** (« Santé 4 »). Un filtre qui annonce son
  résultat avant le clic évite les sélections qui ne renvoient rien.
- **Sélection multiple** au sein d'une section, cumul entre sections.
- Une action **« Tout effacer »** en pied de menu.
- Le menu **reste ouvert** pendant qu'on coche plusieurs valeurs, et la liste se
  met à jour derrière lui en temps réel.
- Le nombre total de filtres actifs s'affiche sur le bouton. C'est ce compteur
  qui remplace l'affichage permanent des valeurs sélectionnées, et c'est ce qui
  garantit la hauteur constante.

---

## 7. Desktop

- Les trois éléments tiennent sur une seule ligne, la recherche prenant l'espace
  restant.
- Les boutons **Trier** et **Filtres** sont libellés en toutes lettres, avec le
  critère courant et le compteur.
- Les menus s'ouvrent **en superposition, ancrés sous leur bouton**. Ils ne
  déplacent aucun contenu.
- Un clic à l'extérieur ou la touche d'échappement ferme le menu.
- La barre reste accrochée en haut pendant le défilement, sous l'en-tête de page.

## 8. Mobile

- Même barre, même hauteur. La recherche garde toute la largeur restante.
- Les deux boutons deviennent **deux carrés à icône** placés à droite du champ.
  Le bouton Filtres porte une **pastille numérique** quand des filtres sont
  actifs, ce qui remplace le libellé.
- Les menus s'ouvrent en **feuille depuis le bas de l'écran**, pas en petit
  menu flottant : les cibles tactiles doivent être confortables et la liste des
  catégories peut être longue.
- La feuille se termine par un bouton de validation qui annonce le résultat
  (« Voir 14 postes »), afin que l'utilisateur sache ce qu'il obtient avant de
  refermer.
- Prévoir la marge de sécurité basse des téléphones pour cette feuille.

---

## 9. États et cas limites

- **Aucun filtre** : le bouton Filtres n'affiche pas de pastille.
- **Aucun résultat** : distinguer deux situations, car elles n'appellent pas la
  même action.
    - liste vide parce qu'aucun poste n'existe → proposer la création,
    - liste vide à cause de la recherche ou des filtres → proposer d'effacer la
      recherche et/ou de retirer les filtres, en rappelant leur nombre.
- **Chargement** : afficher des silhouettes qui reprennent la forme des lignes
  finales, pour éviter que le contenu ne saute quand il arrive.
- **Filtre devenu vide** : si un filtre porte sur une catégorie supprimée
  entre-temps, le retirer silencieusement plutôt que d'afficher une liste vide
  inexplicable.

---

## 10. Persistance

- L'état de la barre — recherche, tri, sens, filtres, regroupement — doit se
  refléter dans **l'URL**. Cela rend le retour arrière du navigateur cohérent,
  permet de partager une vue et de recharger la page sans tout reperdre.
- Le tri, le regroupement et la densité peuvent en plus être **mémorisés par
  utilisateur** d'une visite à l'autre. Les filtres, non : un filtre encore actif
  à la visite suivante produit une liste incomplète que l'utilisateur ne
  s'explique pas.
- Regrouper tout cet état en **un seul objet** plutôt qu'en signaux séparés
  facilite la synchronisation avec l'URL et la remise à zéro.

---

## 11. Accessibilité

- Les deux boutons de menu annoncent leur état d'ouverture et le menu leur est
  rattaché.
- Le compteur de filtres doit être lisible autrement que par sa couleur : le
  nombre lui-même suffit, ne pas se contenter d'une pastille colorée.
- Le champ de recherche porte un libellé, même quand seul le texte d'invite est
  visible.
- Le nombre de résultats est annoncé aux technologies d'assistance à chaque
  changement de filtre, via une région de politesse.
- Les menus se parcourent au clavier et le focus revient sur le bouton
  déclencheur à la fermeture.
- Les cibles tactiles des deux boutons carrés respectent la taille minimale
  recommandée sur mobile.

---

## 12. Critères de réussite

1. La zone de filtres occupe **une seule ligne**, de hauteur identique sur
   desktop et sur mobile.
2. Cette hauteur **ne change jamais**, avec zéro comme avec cinq filtres actifs.
3. Sur un téléphone, au moins **cinq postes** sont visibles à l'ouverture de la
   page, contre deux aujourd'hui.
4. Toutes les capacités de filtrage existantes restent atteignables, aucune n'est
   perdue en route.
5. Recharger la page ou revenir en arrière restitue exactement la même vue.