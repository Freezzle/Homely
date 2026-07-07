# 05 — Spécification Frontend (Angular + PrimeNG)

> Écrans, navigation, composants PrimeNG et graphiques. Chaque écran indique les
> endpoints consommés (voir [doc 04](04-api-spec.md)) et les composants clés. FR par
> défaut, i18n prête.

---

## 1. Shell & navigation

- **Topbar** : logo, **sélecteur de foyer** (dropdown), **sélecteur de scénario**
  (dropdown, badge « référence »), menu utilisateur (profil, déconnexion), sélecteur de
  langue/thème.
- **Menu latéral** (`p-menu` / `p-panelMenu`) :
  - Tableau de bord annuel
  - Tableau de bord du mois
  - Revenus · Charges · Réserves
  - Scénarios (& comparaison)
  - Patrimoine
  - Objectifs
  - Référentiels (Comptes, Catégories, Actifs, Taux de change, Membres)
  - Paramètres du foyer / Accès
- Contexte global (`ContexteService`, signals) : `foyerCourant`, `scenarioCourant`.
  Changer l'un rafraîchit les écrans dépendants.

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
  ├── /referentiels/(comptes|categories|actifs|taux|membres)
  └── /parametres | /acces
```
`AuthGuard` sur `/f/**`, `FoyerAccessGuard` vérifie l'appartenance + rôle (masque les
actions d'écriture pour `VIEWER`).

## 3. Écrans

### 3.1 Tableau de bord annuel  *(reprend « Dashboard annuel » Excel)*
- Sélecteur d'**année** (dropdown sur l'horizon du scénario).
- **KPI annuels** (revenus/charges/réserves/solde).
- **Un tableau mensuel foyer** (`p-table`) — colonnes Mois, Revenus, Charges, Réserves,
  Solde disponible + ligne Total année.
- Graphiques :
  - **Mixte mensuel foyer** : barres empilées Charges + Réserves + ligne Revenus.
  - **Un graphique mixte par membre** (même structure) pour visualiser la contribution
    individuelle.
- Endpoint principal : `…/projection/annuelle?annee=`.
- Le DTO expose aussi `moisReel` et `moisParMembreReel` pour la vue « flux réels ».

### 3.2 Tableau de bord du mois  *(reprend « Dashboard du mois » Excel)*
- Sélecteurs **année + mois**.
- **KPI foyer** : revenus / charges / réserves / solde du mois.
- **3 listes catégories séparées** : revenus, charges, réserves (tri décroissant + total
  par type) pour éviter tout mélange des types.
- **Vue par membre** : mini-KPI, badge taux d'effort, et barres horizontales des charges
  par compte.
- Endpoint : `…/projection/mensuelle?annee=&mois=`.

### 3.3 Revenus / Charges / Réserves  *(reprennent les feuilles de saisie)*
Trois écrans quasi identiques (composant générique paramétré par `type`).
- **`p-table`** triable avec colonnes : Description (badge nature), Catégorie, Montant,
  **Montant mensualisé** (calculé), Périodicité (avec icône de mode), Début, Fin,
  Répartition (résumé). Édition via **`p-dialog`**.
- Formulaire de poste : champs typés — `p-select` (catégorie, mode, moment, devise),
  `p-inputnumber` (montant, périodicité), `p-datepicker` (début/fin), éditeur de
  **répartition** (une ligne par membre avec `p-inputnumber` en %, **contrôle live que la
  somme = 100 %**, bouton « répartir équitablement »), éditeur de **ventilation comptes**
  (par membre → `p-select` compte).
- Bouton **« Aperçu mensuel »** sur une ligne → affiche la contribution mois par mois du
  poste (`…/postes/{id}/apercu?annee=`) — pédagogique pour comprendre mensualisé vs
  périodique.
- En-tête : totaux « actifs ce mois », « dont membre X », « total annuel ×12 » (comme
  l'Excel).
- Validation UX : la sauvegarde est bloquée si la répartition ne somme pas à 1
  (message clair), miroir de la règle backend (422).

Comportement UI actuel du dialog de poste :

- `nature` (`EFFECTIF`/`PREVISION`) avec défaut `EFFECTIF`.
- `moment` visible dès que `periodiciteMois > 1`.
- `mode` masqué quand `periodiciteMois == 1` (cas mensuel).
- `debut` et `fin` sur la même ligne (2 colonnes).
- Ligne périodicité/mode/moment en grille adaptative (1 ou 3 colonnes).
- Icônes dans la liste : calendrier pour mensualisé, éclair pour périodique.

### 3.4 Scénarios & comparaison
- **Liste** des scénarios (`p-table` / cartes) : nom, référence (badge), année de départ,
  horizon. Actions : créer, dupliquer, éditer hypothèses, définir comme référence,
  supprimer.
- **Édition des hypothèses** : année de départ, trésorerie initiale, horizon,
  **répartition par défaut** (éditeur % par membre, somme = 100 %).
- **Comparaison** : multi-sélection de scénarios + choix de métrique (trésorerie / solde
  annuel / net worth) → **graphique multi-séries** (`p-chart` line) + tableau des écarts.
- Endpoints : `…/scenarios`, `…:dupliquer`, `…:definir-reference`,
  `…/projection/comparaison`.

### 3.5 Patrimoine (net worth)  *(module nouveau)*
- Vue d'ensemble : **courbe du net worth** dans le temps, répartition par compte/actif
  (`p-chart` doughnut à une date + `p-chart` area empilée dans le temps).
- Tableau des comptes/actifs avec solde initial, taux de croissance, solde projeté final.
- Endpoint : `…/projection/patrimoine?jusquAnnee=`.

### 3.6 Objectifs  *(module nouveau)*
- Cartes objectifs : libellé, montant cible, échéance, **barre de progression**
  (`p-progressbar`), épargne mensuelle requise, date d'atteinte prévue.
- Formulaire : libellé, catégorie projet, montant cible, échéance (`p-datepicker`),
  support (compte **ou** actif via `p-select`).
- Endpoint : `…/objectifs` (réponse enrichie du calcul).

### 3.7 Référentiels
Écrans CRUD simples (`p-table` + `p-dialog`) : **Comptes** (libellé, type, solde initial,
devise), **Catégories** (libellé, type de poste, filtre par type), **Actifs** (libellé,
type, solde initial, taux de croissance), **Taux de change** (devise, taux vers base),
**Membres** (nom, couleur, ordre). Empêcher la suppression d'un membre référencé (message
serveur `MEMBRE_REFERENCE_SUPPRESSION`).

### 3.8 Paramètres foyer & accès
- Paramètres : nom du foyer, **devise de base**.
- Accès (OWNER) : liste des utilisateurs + rôle, invitation par email, changement de
  rôle, retrait. Masquer pour non-OWNER.

## 4. Composants & pratiques transverses

- **Graphiques** : `p-chart` (Chart.js). Palette dérivée des `couleur` de membres pour
  cohérence entre écrans. Formatage des axes/tooltips via `Intl` (devise du foyer).
- **Formatage montants/dates** : pipes dédiés s'appuyant sur `Intl.NumberFormat` /
  `Intl.DateTimeFormat` + locale + `deviseBase`.
- **États de chargement** : `p-skeleton` / spinners sur les écrans de projection.
- **Messages** : `p-toast` (succès/erreur), `p-confirmdialog` (suppressions).
- **Réactivité** : changer foyer/scénario/année/mois via signals → recalcul déclaratif
  des données affichées (effets/`computed`).
- **Styling** : **Tailwind CSS v4** pour la mise en page/espacement/grille/responsive,
  couplé à PrimeNG via `tailwindcss-primeui` + CSS layers (voir doc 03 §6.1). Utiliser les
  couleurs de tokens partagées (`bg-primary`, `text-surface-*`) pour rester cohérent avec
  le thème PrimeNG. Sur un composant PrimeNG, passer les utilitaires via `styleClass`.
- **Accessibilité & responsive** : grille Tailwind (`grid`, `flex`, breakpoints `sm/md/lg`) ;
  les tableaux passent en cartes sur mobile si pertinent.
- **Droits** : directive `*siRole="'EDITOR'"` masquant les actions d'écriture pour les
  `VIEWER`.

## 5. Correspondance Excel → écrans (traçabilité)

| Feuille Excel | Écran Angular |
|---|---|
| Dashboard annuel | Tableau de bord annuel (3 tableaux + courbe trésorerie) |
| Dashboard du mois | Tableau de bord du mois (ventilations catégorie/compte) |
| Revenus / Charges / Réserves | Écrans de saisie Revenus / Charges / Réserves |
| Paramètres | Référentiels + Paramètres foyer + hypothèses de scénario |
| Moteur | *(non exposé : calcul serveur)* — visible via projections/graphes |
| *(listes projets, types actifs inutilisées)* | Objectifs & Patrimoine (modules nouveaux) |
