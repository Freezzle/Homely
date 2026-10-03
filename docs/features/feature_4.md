# Indicateur #23 · Barres empilées + ligne

Graphique mensuel qui **empile plusieurs montants dans une barre** et trace **une ligne de référence** par-dessus, sur la même échelle. On voit d'un coup d'œil la composition de chaque mois et sa position par rapport à la ligne.

Le composant se limite volontairement au minimum :

- des barres empilées de 1 à 5 segments ;
- **une seule ligne**, pleine ou en pointillés ;
- un axe Y qui part de 0, les libellés de mois, une légende et une infobulle par mois.

Il n'y a **pas** de marquage des dépassements, de mois colorés ou de texte de diagnostic. C'est au lecteur de comparer la pile à la ligne.

---

## 1. Anatomie

```
┌──────────────────────────────────────────────┐
│ 10k ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │ ← graduations « rondes » (0, 5 000, 10k…)
│            ▄▄                         ▄▄     │
│            ██                   ▄▄    ██     │
│ ━━━━━━━━━━━██━━━━━━━━━━━━━━━━━━━██━━━━██━━━━ │ ← ligne de référence (pleine ou pointillée)
│ 5 000 ┄▄▄┄┄██┄▄▄┄┄▄▄┄┄▄▄┄┄▄▄┄┄▄▄┄██┄▄▄┄██┄┄┄ │
│  ▓▓ ▓▓ ██ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ ▓▓ │ ← segments empilés, du bas vers le haut
│  ██ ██ ██ ██ ██ ██ ██ ██ ██ ██ ██ ██ ██ │    dans l'ordre du tableau `stacks`
│ 0 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ ← ligne 0 pleine
├──────────────────────────────────────────────┤
│  O   N   D   J   F   M   A   M   J   J   A  S│ ← mois (mois en avant en gras)
├──────────────────────────────────────────────┤
│ ■ Charges fixes ■ Charges var. ■ Réserves    │ ← légende : un carré par segment,
│ ■ Argent de poche  ━ Revenus                 │    un trait pour la ligne
└──────────────────────────────────────────────┘
```

| Élément | Rôle |
|---|---|
| Barres empilées | 1 à 5 segments par mois. Le premier du tableau est en bas. Un fin séparateur de la couleur de la carte les distingue. |
| Ligne | Une seule série. Trait de 2,2 px passant par le centre de chaque barre. Pleine pour un montant réel, en pointillés pour une valeur de référence (budget, objectif). |
| Axe Y | Part toujours de **0**. Graduations à pas « rond » (1, 2 ou 5 × 10ⁿ). Ligne 0 pleine, les autres en pointillés. |
| Libellés de mois | Un par barre, centré dessous. Le mois mis en avant est en gras. |
| Survol / toucher | Une bande invisible par mois, avec une infobulle qui détaille le calcul. |
| Légende | Carré de couleur pour chaque segment, trait (plein ou pointillé) pour la ligne. |

---

## 2. Données d'entrée

```js
renderStackLineChart({
  stacks: [                       // 1 à 5 segments, du bas vers le haut
    { name:'Charges fixes',     values:[…12 nombres…], color:'var(--down)' },
    { name:'Charges variables', values:[…], color:'color-mix(in srgb,var(--down) 50%,var(--card))' },
    { name:'Réserves',          values:[…], color:'var(--c2)' },
    { name:'Argent de poche',   values:[…], color:'var(--warn)' }
  ],
  line: { name:'Revenus', values:[…], color:'var(--up)' },   // dash:'5 4' pour pointillés
  labels:     ['O','N','D','J','F','M','A','M','J','J','A','S'],
  labelsFull: ['Oct.','Nov.','Déc.','Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.'],
  highlight: 11,                  // index du mois en gras
  isForecast: i => false,         // true → barre à 45 % d'opacité, libellé en italique
  height: 150                     // hauteur du tracé en px
})
```

| Clé | Type | Défaut | Rôle |
|---|---|---|---|
| `stacks[].name` | string | requis | Libellé de la légende et de l'infobulle |
| `stacks[].values` | number[] | requis | Un montant par mois. **Les valeurs négatives sont ramenées à 0.** |
| `stacks[].color` | couleur CSS | requis | Voir la palette en section 5 |
| `line.name` | string | requis | Libellé de la légende et de l'infobulle |
| `line.values` | number[] | requis | Même longueur que les barres |
| `line.color` | couleur CSS | `var(--text)` | |
| `line.dash` | string | aucun | `stroke-dasharray`, par exemple `'5 4'`. Absent = trait plein. |
| `highlight` | number | dernier mois | Mois affiché en gras |
| `isForecast` | fonction | `() => false` | Mois prévus, affichés atténués |
| `height` | number | `150` | Hauteur du SVG en px |

---

## 3. Calculs

### 3.1 Échelle

```
total[i] = somme des segments du mois i (négatifs ramenés à 0)
max      = plus grande valeur entre tous les totaux et toute la ligne
pas      = pas « rond » ≈ max × 1,05 / 3        → 1, 2, 5 ou 10 × 10ⁿ
haut     = arrondi au pas supérieur de max × 1,06

Y(v) = 100 − v / haut × 100                     // 0 est toujours en bas
```

`niceStep` renvoie un pas lisible : pour `max = 9 350`, on obtient `pas = 5 000` et `haut = 10 000`. Les graduations sont donc `0 · 5 000 · 10k`. Tous les libellés tombent ainsi sur des valeurs rondes et l'échelle reste la même pour les barres et la ligne.

### 3.2 Géométrie des barres

```
slot   = 100 / n                // largeur d'une colonne
largeur = slot × 0,62           // la barre occupe 62 % de sa colonne
x(i)   = i × slot + (slot − largeur) / 2
cx(i)  = (i + 0,5) × slot       // centre → sert à la ligne et aux libellés
```

Chaque segment est un `<rect>` qui part du cumul précédent :

```
acc = 0
pour chaque segment k :
   rect  y = Y(acc + v)   hauteur = Y(acc) − Y(acc + v)
   acc  += v
```

Chaque rectangle a un contour de 1 px de la couleur de la carte (`stroke="var(--card)"` + `vector-effect="non-scaling-stroke"`). Il fait office de séparateur entre segments dans les deux thèmes.

### 3.3 La ligne

Un seul `<path>` qui relie `(cx(i), Y(line[i]))` pour tous les mois. Il est tracé **après** les barres pour passer au-dessus. Aucun marqueur ni repère n'est ajouté par barre.

### 3.4 SVG étiré

Comme pour le #17 : `viewBox="0 0 100 100"` avec `preserveAspectRatio="none"`, et `vector-effect="non-scaling-stroke"` sur la ligne et les contours pour que les épaisseurs restent constantes. Les rectangles peuvent s'étirer sans problème. Les libellés Y sont des `<span>` HTML positionnés en absolu, ce qui évite de déformer le texte.

---

## 4. Code de référence

Le code est autonome et sans bibliothèque. Il renvoie une chaîne HTML.

### 4.1 CSS

```css
:root{
  --card:#fff; --text:#101828; --muted:#667085; --border:#e4e7ec; --accent:#4f46e5;
  --up:#12a150; --down:#d92d20; --warn:#c77700;
  --c1:#4f46e5; --c2:#06b6d4; --c3:#f59e0b; --c4:#ec4899; --c5:#10b981;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --card:#151c2a; --text:#eef1f6; --muted:#98a2b3; --border:#263041; --accent:#8b93ff;
    --up:#3ccb7f; --down:#f97066; --warn:#fdb022;
    --c1:#8b93ff; --c2:#22d3ee; --c3:#fbbf24; --c4:#f472b6; --c5:#34d399;
  }
}

.slc{display:grid;gap:10px}
.slc-plot{position:relative}
.slc-plot svg{display:block;width:100%;overflow:visible}
.slc-ylab{position:absolute;left:0;transform:translateY(-50%);font-size:9px;font-weight:600;color:var(--muted);
  background:var(--card);padding-right:3px;font-variant-numeric:tabular-nums;pointer-events:none}
.slc-hit{position:absolute;inset:0;display:flex}
.slc-hit span{flex:1}
.slc-hit span:hover{background:color-mix(in srgb,var(--accent) 7%,transparent)}
.slc-x{display:flex}
.slc-x span{flex:1;text-align:center;font-size:9px;font-weight:600;color:var(--muted)}
.slc-x span.hl{color:var(--text);font-weight:700}
.slc-x span.fc{opacity:.55;font-style:italic}
.slc-key{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:11px;color:var(--muted)}
.slc-key span{display:inline-flex;align-items:center;gap:5px}
.slc-key i{flex:none;border-radius:2px}
.slc-key i.sq{width:10px;height:10px}
.slc-key i.ln{width:16px;height:3px}
```

> Les libellés de mois utilisent `flex:1` **sans `gap`** : chaque libellé est centré sur `cx(i)`, donc exactement sous sa barre.

### 4.2 JavaScript

```js
function fmtK(v){
  const s = v < 0 ? '−' : ''; v = Math.abs(v);
  return s + (v >= 10000
    ? (Math.round(v/100)/10).toLocaleString('fr-CH') + 'k'
    : Math.round(v).toLocaleString('fr-CH'));
}
const fmtCHF  = v => (v < 0 ? '−' : '') + Math.round(Math.abs(v)).toLocaleString('fr-CH');
const escAttr = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

/* Pas de graduation « rond » : 1, 2, 5 ou 10 × 10ⁿ */
function niceStep(max, count = 3){
  const raw = max / count, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

function renderStackLineChart(o){
  const {
    stacks, line, labels, labelsFull = labels,
    highlight = labels.length - 1, isForecast = () => false, height: H = 150
  } = o;

  const n    = line.values.length;
  const vals = stacks.map(s => s.values.map(v => Math.max(0, v)));      // pas de négatif empilé
  const tot  = line.values.map((_, i) => vals.reduce((a, v) => a + v[i], 0));

  // Échelle depuis 0
  const max  = Math.max(...tot, ...line.values, 1);
  const step = niceStep(max * 1.05);
  const top  = Math.ceil(max * 1.06 / step) * step;
  const Y    = v => 100 - v / top * 100;
  const slot = 100 / n, bw = slot * .62;
  const bx   = i => i * slot + (slot - bw) / 2;
  const cx   = i => (i + .5) * slot;

  let g = '';

  // Grille
  const ticks = []; for (let t = 0; t <= top + 1e-9; t += step) ticks.push(t);
  g += ticks.map(t => `<line x1="0" x2="100" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--border)" stroke-width="1"
        vector-effect="non-scaling-stroke" ${t ? 'stroke-dasharray="2 3"' : ''}/>`).join('');

  // Barres empilées
  for (let i = 0; i < n; i++){
    let acc = 0; const op = isForecast(i) ? .45 : 1;
    vals.forEach((v, k) => {
      if (v[i] <= 0) return;
      g += `<rect x="${bx(i)}" y="${Y(acc + v[i])}" width="${bw}" height="${Y(acc) - Y(acc + v[i])}"
              fill="${stacks[k].color}" opacity="${op}"
              stroke="var(--card)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
      acc += v[i];
    });
  }

  // Ligne unique, pleine ou pointillée
  const lc = line.color || 'var(--text)';
  g += `<path d="${line.values.map((v, i) => (i ? 'L' : 'M') + cx(i).toFixed(2) + ' ' + Y(v).toFixed(2)).join(' ')}"
          fill="none" stroke="${lc}" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"
          ${line.dash ? `stroke-dasharray="${line.dash}"` : ''}/>`;

  // HTML superposé
  const ylabs = ticks.map(t => `<span class="slc-ylab" style="top:${Y(t) / 100 * H}px">${fmtK(t)}</span>`).join('');
  const tip = i => `${labelsFull[i]}${isForecast(i) ? ' (prévision)' : ''} · `
    + stacks.map((s, k) => `${s.name} ${fmtCHF(vals[k][i])}`).join(' + ')
    + ` = ${fmtCHF(tot[i])} · ${line.name} ${fmtCHF(line.values[i])}`;
  const hits  = labels.map((_, i) => `<span title="${escAttr(tip(i))}"></span>`).join('');
  const xlabs = labels.map((l, i) =>
    `<span class="${[i === highlight && 'hl', isForecast(i) && 'fc'].filter(Boolean).join(' ')}">${l}</span>`).join('');

  const lineSwatch = line.dash
    ? `repeating-linear-gradient(90deg,${lc} 0 4px,transparent 4px 7px)` : lc;
  const key = `<div class="slc-key">
    ${stacks.map(s => `<span><i class="sq" style="background:${s.color}"></i>${s.name}</span>`).join('')}
    <span><i class="ln" style="background:${lineSwatch}"></i>${line.name}</span>
  </div>`;

  return `<div class="slc">
    <div class="slc-plot">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="height:${H}px" role="img"
        aria-label="${escAttr(stacks.map(s => s.name).join(', ') + ' comparés à ' + line.name)}">${g}</svg>
      ${ylabs}<div class="slc-hit">${hits}</div>
    </div>
    <div class="slc-x">${xlabs}</div>
    ${key}
  </div>`;
}
```

### 4.3 Infobulles au toucher (mobile)

L'attribut `title` ne s'affiche pas au toucher. On utilise la même bulle flottante que pour le #17 :

```html
<div id="slc-tip" hidden style="position:fixed;z-index:50;max-width:240px;background:var(--text);color:var(--card);
  font-size:12px;font-weight:600;padding:6px 9px;border-radius:8px;pointer-events:none"></div>
```

```js
const tip = document.getElementById('slc-tip'); let tipT;
document.addEventListener('pointerup', e => {
  if (e.pointerType === 'mouse') return;
  const el = e.target.closest('.slc-hit [title]');
  if (!el){ tip.hidden = true; return; }
  tip.textContent = el.getAttribute('title'); tip.hidden = false;
  tip.style.left = Math.max(8, Math.min(e.clientX, innerWidth - 250)) + 'px';
  tip.style.top  = Math.max(e.clientY - 44, 8) + 'px';
  clearTimeout(tipT); tipT = setTimeout(() => tip.hidden = true, 2800);
});
```

---

## 5. Couleurs

Ce sont les mêmes conventions que dans le reste du dashboard. Une famille de couleurs correspond à un thème ; les nuances plus claires servent aux sous-catégories.

| Donnée | Couleur | Valeur |
|---|---|---|
| Revenus / salaire | Vert | `var(--up)` |
| Freelance | Vert moyen | `color-mix(in srgb,var(--up) 60%,var(--card))` |
| Autres revenus (chômage…) | Vert clair | `color-mix(in srgb,var(--up) 30%,var(--card))` |
| Charges / charges fixes | Rouge | `var(--down)` |
| Charges variables | Rouge clair | `color-mix(in srgb,var(--down) 50%,var(--card))` |
| Réserves | Cyan | `var(--c2)` |
| Argent de poche | Ambre | `var(--warn)` |
| Solde non alloué | Émeraude | `var(--c5)` |
| Référence (budget, objectif) | Texte, en pointillés | `var(--text)` + `dash:'5 4'` |

**Règles :**
- Une **ligne pleine** représente un montant réel (revenus, charges). Une **ligne en pointillés** représente une valeur fixée à l'avance (budget, objectif).
- La ligne ne doit pas avoir la même couleur qu'un segment de la pile, sauf si elle représente la même donnée.
- Mélanger avec `var(--card)` plutôt qu'avec du blanc : les nuances restent justes en thème sombre.

---

## 6. Les 4 configurations

Données sur 12 mois : `rev`, `chg`, `fix`, `res`, `pkt`, `sal`, `fre`, `aut`, `bud`.

```js
const L  = ['O','N','D','J','F','M','A','M','J','J','A','S'];
const LF = ['Oct.','Nov.','Déc.','Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.'];
const base = { labels:L, labelsFull:LF, highlight:11 };
const vari = chg.map((c,i) => c - fix[i]);
```

### #23 · Sorties empilées vs revenus

Barres empilées = charges fixes + charges variables + réserves + argent de poche. Ligne = revenus du mois.

```js
renderStackLineChart({ ...base,
  line:{ name:'Revenus', values:rev, color:'var(--up)' },
  stacks:[
    { name:'Charges fixes',     values:fix,  color:'var(--down)' },
    { name:'Charges variables', values:vari, color:'color-mix(in srgb,var(--down) 50%,var(--card))' },
    { name:'Réserves',          values:res,  color:'var(--c2)' },
    { name:'Argent de poche',   values:pkt,  color:'var(--warn)' }
  ]
});
```

### #23a · Sources de revenus vs charges

Barres empilées = salaire + freelance + autres revenus. Ligne = charges du mois.

```js
renderStackLineChart({ ...base,
  line:{ name:'Charges', values:chg, color:'var(--down)' },
  stacks:[
    { name:'Salaire',           values:sal, color:'var(--up)' },
    { name:'Freelance',         values:fre, color:'color-mix(in srgb,var(--up) 60%,var(--card))' },
    { name:'Autres (chômage…)', values:aut, color:'color-mix(in srgb,var(--up) 30%,var(--card))' }
  ]
});
```

### #23b · Charges vs budget

Barres empilées = charges fixes + charges variables. Ligne = budget de charges du mois.

```js
renderStackLineChart({ ...base,
  line:{ name:'Budget', values:bud, color:'var(--text)', dash:'5 4' },
  stacks:[
    { name:'Charges fixes',     values:fix,  color:'var(--down)' },
    { name:'Charges variables', values:vari, color:'color-mix(in srgb,var(--down) 50%,var(--card))' }
  ]
});
```

### #23c · Épargne vs objectif 20 %

Barres empilées = réserves hors vacances + solde non alloué (0 s'il est négatif). Ligne = 20 % des revenus du mois.

```js
const solde = rev.map((r,i) => r - chg[i] - res[i] - pkt[i]);
renderStackLineChart({ ...base,
  line:{ name:'Objectif 20 % des revenus', values:rev.map(r => r * .2), color:'var(--text)', dash:'5 4' },
  stacks:[
    { name:'Réserves (hors vacances)', values:res.map(v => v * .85), color:'var(--c2)' },
    { name:'Solde non alloué',         values:solde,                 color:'var(--c5)' }  // négatifs → 0
  ]
});
```

---

## 7. Comportement et cas limites

| Cas | Comportement |
|---|---|
| Valeur négative dans un segment | Ramenée à 0 : le segment n'est pas dessiné. L'infobulle affiche `0`. |
| Segment à 0 | Pas de rectangle ; le segment suivant démarre au même niveau. |
| Tous les segments à 0 un mois donné | Barre absente ; la ligne reste tracée. |
| Ligne plus haute que toutes les barres | L'échelle s'adapte au maximum des deux : la ligne reste dans le cadre. |
| Barre plus haute que la ligne | Rien de spécial : la ligne passe devant la barre. |
| Toutes les valeurs à 0 | `max(…, 1)` évite une division par zéro ; seule la graduation 0 s'affiche. |
| Mois de prévision | Barre à 45 % d'opacité, libellé en italique, infobulle suffixée « (prévision) ». La ligne ne change pas. |
| Carte étroite (~330 px) | Le SVG s'étire, les barres gardent 62 % de leur colonne, la ligne et les séparateurs gardent leur épaisseur. |
| Thème sombre | Toutes les couleurs passent par des variables CSS ; séparateurs et fonds de libellés en `var(--card)`. |
| Plus de 5 segments | Déconseillé : les fines tranches deviennent illisibles. Regroupez les petits postes en « Autres ». |

---

## 8. Accessibilité

- Le `<svg>` porte `role="img"` et un `aria-label` du type « Charges fixes, Charges variables… comparés à Revenus ».
- Chaque mois a une zone de survol dont le `title` détaille le calcul : `Sept. · Charges fixes 2 600 + … = 6 950 · Revenus 6 300`.
- Au toucher, la bulle flottante de la section 4.3 prend le relais.
- La ligne se distingue des barres par sa forme (trait et non surface), pas seulement par sa couleur.