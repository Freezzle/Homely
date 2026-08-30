# Spécification — Ligne de regroupement dans `postes-liste`

## Résumé

Remplacer le séparateur de groupe actuel (bandeau plein `bg-surface-700` / texte blanc uppercase) par un bandeau **sticky**, **coloré selon le type de la liste** (Revenu / Charge / Réserve), affichant le libellé du groupe et son nombre de postes — **sans montant total**.

Portée strictement limitée à cet élément. Ne pas toucher au reste du composant.

---

## 1. Fichiers concernés

- `frontend/src/app/features/postes/postes-liste/postes-liste.component.ts`
- `frontend/src/app/features/postes/postes-liste/postes-liste.component.html`
- `frontend/src/app/features/postes/postes-liste/postes-liste.component.scss` (ou fichier de style équivalent du composant)

Tokens à réutiliser (déjà définis, ne pas en recréer) : `frontend/src/styles/_app-tokens.css`.

---

## 2. Hors scope — à ne surtout pas modifier

- Le style des cartes de poste individuelles (bordures, hover, montant, actions, tags membres…).
- La logique de tri / regroupement existante : `triActuel`, `comparerPostes`, `clefSeparateur`, `racineChaine`, `postesVisibles`. Seule la donnée injectée dans le séparateur et son affichage changent.
- Les filtres, la sélection multiple, les dialogs, la chaîne de révisions (spine).
- **Aucun montant total / somme du groupe** dans le bandeau. C'est une exclusion volontaire, pas un oubli.
- **Aucune couleur par catégorie.** Une seule couleur pour tout le bandeau, dérivée du type de la liste (`type` du composant), pas de la catégorie du poste.

---

## 3. Couleur — une seule couleur, dérivée du type de liste

`PostesListeComponent` reçoit déjà `type = input<TypePoste>('REVENU')`. Le bandeau doit utiliser la paire de tokens correspondante, déjà présente dans `_app-tokens.css` — ne pas coder de couleurs en dur, ne pas écrire de règles `.dark` manuelles : ces tokens pointent sur les variables PrimeNG (`--p-*`) et s'adaptent déjà nativement au light/dark (`.dark` sur `<html>`).

| Type      | Fond du bandeau (doux)   | Accent (monogramme) |
|-----------|---------------------------|----------------------|
| `REVENU`  | `var(--app-revenu-bg)`    | `var(--app-revenu)`  |
| `CHARGE`  | `var(--app-charge-bg)`    | `var(--app-charge)`  |
| `RESERVE` | `var(--app-reserve-bg)`   | `var(--app-reserve)` |

Le fond utilise la variante `-bg` (mix ~15 %, déjà prévue dans la charte pour ce cas d'usage), pas le token plein — un aplat en couleur pleine serait trop proche du bandeau `bg-surface-700` actuel que l'on cherche justement à alléger. Le token plein sert uniquement d'accent (texte du monogramme).

Ne pas modifier le `typeAccentClass` existant (utilisé ailleurs, ex. spine des chaînes de révision) : ajouter un **nouveau** computed dédié pour ne rien casser.

```ts
/** Paire de tokens (fond doux / accent plein) pour le bandeau de regroupement, selon le type de la liste. */
readonly separateurAccent = computed<{ bg: string; fg: string }>(() => {
  switch (this.type()) {
    case 'REVENU':  return { bg: 'var(--app-revenu-bg)',  fg: 'var(--app-revenu)' };
    case 'CHARGE':  return { bg: 'var(--app-charge-bg)',  fg: 'var(--app-charge)' };
    case 'RESERVE': return { bg: 'var(--app-reserve-bg)', fg: 'var(--app-reserve)' };
    default:        return { bg: 'var(--app-revenu-bg)',  fg: 'var(--app-revenu)' };
  }
});
```

---

## 4. Contenu du bandeau

De gauche à droite :

1. **Monogramme** — 1 à 2 lettres dérivées du libellé du groupe (`item.separator`), pas d'une catégorie spécifique : la liste peut être groupée par catégorie, par date ou par description (`triActuel`), le monogramme doit donc rester générique.
   ```ts
   /** 1-2 lettres du libellé de groupe pour le monogramme du bandeau, accents retirés. */
   libelleMonogramme(label: string): string {
     return label
       .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
       .trim()
       .slice(0, 2)
       .toUpperCase();
   }
   ```
2. **Libellé du groupe** — `item.separator`, inchangé.
3. **Nombre de postes du groupe** — nouveau, purement un compte d'éléments (pas un montant). Voir §5.

Aucun quatrième élément (pas de sous-total, pas d'icône d'action).

---

## 5. Modèle de données — extension minimale

`postesAvecSeparateurs()` retourne aujourd'hui `(PosteAffiche | { separator: string })[]`. L'étendre pour inclure le nombre de postes du groupe, calculé en un passage sur `postesVisibles()` (aucune notion de montant) :

```ts
postesAvecSeparateurs = computed<(PosteAffiche | { separator: string; nbPostes: number })[]>(() => {
  const visibles = this.postesVisibles();

  // Nombre de postes par clé de séparateur, calculé une fois.
  const comptesParClef = new Map<string, number>();
  for (const p of visibles) {
    const clef = p._clefSeparateur ?? '';
    comptesParClef.set(clef, (comptesParClef.get(clef) ?? 0) + 1);
  }

  const result: (PosteAffiche | { separator: string; nbPostes: number })[] = [];
  let lastKey: string | null = null;
  for (const p of visibles) {
    const key = p._clefSeparateur ?? '';
    if (key !== lastKey) {
      result.push({ separator: p._labelSeparateur ?? '', nbPostes: comptesParClef.get(key) ?? 0 });
      lastKey = key;
    }
    result.push(p);
  }
  return result;
});
```

Mettre à jour `isSeparator` / `asPoste` en conséquence si leur signature type doit refléter le champ `nbPostes` ajouté.

Le libellé « X postes » doit passer par le service i18n existant (`this.t.poste.*`, cf. les autres libellés du composant) plutôt qu'être codé en dur, avec gestion du pluriel.

---

## 6. Comportement sticky

Le bandeau reste épinglé en haut de son groupe tant qu'on défile dedans (comme un en-tête d'index), et cède la place au bandeau suivant dès qu'on atteint le groupe suivant — comportement CSS natif (`position: sticky`), aucun JS de scroll-listener nécessaire.

```scss
position: sticky;
top: 0;       // à ajuster si un header applicatif fixe existe au-dessus de la liste
z-index: 2;   // au-dessus des cartes, largement sous les dialogs/menus PrimeNG
```

⚠️ Le sticky ne fonctionne que si un ancêtre du bandeau a `overflow-y: auto` (ou si c'est la fenêtre elle-même qui scrolle, sans ancêtre à `overflow` non-visible entre les deux). Vérifier le conteneur réel de la liste dans le layout de la page avant d'appliquer `top: 0` tel quel.

---

## 7. Esquisse d'implémentation (indicative — à adapter aux conventions réelles du projet)

### Template

```html
@for (item of postesAvecSeparateurs(); track $index) {
  @if (isSeparator(item)) {
    <div class="separateur-groupe" [style.background]="separateurAccent().bg">
      <span class="separateur-groupe__mono" [style.color]="separateurAccent().fg">
        {{ libelleMonogramme(item.separator) }}
      </span>
      <span class="separateur-groupe__label">{{ item.separator }}</span>
      <span class="separateur-groupe__count">{{ item.nbPostes }} {{ t.poste.nbPostesGroupe }}</span>
    </div>
  } @else {
    <!-- carte de poste existante, inchangée -->
  }
}
```

### Style

```scss
.separateur-groupe {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--app-line);

  &__mono {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    // currentColor = la couleur posée inline via [style.color] juste au-dessus
    background: color-mix(in srgb, currentColor 24%, transparent);
    font-size: 0.65rem;
    font-weight: 800;
    flex: 0 0 auto;
  }

  &__label {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--app-ink);
  }

  &__count {
    margin-left: auto;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--app-ink-muted);
    white-space: nowrap;
  }
}
```

Notes :
- Le fond (`separateurAccent().bg`) et l'accent du monogramme (`separateurAccent().fg`) sont posés en `[style.*]` plutôt qu'en classes, car ce sont des valeurs dynamiques (dépendantes du `type` de la liste), pas des variantes statiques.
- Le libellé et le compteur restent en `var(--app-ink)` / `var(--app-ink-muted)` (jamais colorés dans l'accent) pour garder une lisibilité correcte sur un fond `-bg` à 15 % dans les deux thèmes.
- Pas d'arrondi (`border-radius`) sur le bandeau, pour rester cohérent avec les cartes de poste existantes qui n'en ont pas.

---

## 8. Vérifications avant merge

- [ ] Contraste texte/fond correct en light **et** en dark (le mix à 15 % peut rendre différemment selon le thème — vérifier visuellement, pas seulement en light).
- [ ] Comportement sticky testé sur une liste avec plusieurs groupes consécutifs (le bandeau suivant doit bien remplacer le précédent au scroll).
- [ ] `typeAccentClass` existant non modifié, toujours fonctionnel à ses autres points d'usage.
- [ ] Aucune régression sur `triActuel = 'DATE'` et `'DESCRIPTION'` (le monogramme et le compteur doivent rester cohérents, pas seulement pour `'CATEGORIE'`).
- [ ] Aucun montant affiché dans le bandeau.