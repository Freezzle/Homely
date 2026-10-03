# Indicateur #17 · Courbes multiples avec zone d'écart

Graphique en courbes qui compare **2 à 5 séries mensuelles** sur une même échelle. Une **zone colorée** est dessinée entre deux séries choisies : verte quand la première est au-dessus, rouge quand elle passe en dessous. La couleur change exactement au point de croisement des deux courbes.

Ce document couvre **uniquement la partie graphique** : les courbes, la zone d'écart, l'axe Y, les libellés de mois, la légende et les infobulles. Le texte de diagnostic sous le graphique (pastilles du type « 3 mois en déficit ») est volontairement exclu.

---

## 1. Anatomie

```
┌──────────────────────────────────────────────┐
│ 8 200 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │ ← graduation haute (valeur max réelle)
│        ╱╲                          ╱╲      ● │ ← point sur le mois mis en avant
│ ━━━━━━╱▓▓╲━━━━━━━━━━━━━━━━━━━━━━━━╱▓▓╲━━━━━● │   ▓ = zone rouge (série B > série A)
│ ░░░░░╱░░░░╲░░░░░░░░░░░░░░░░░░░░░░╱░░░░╲░░   │   ░ = zone verte (série A > série B)
│ ━━━━━      ━━━━━━━━━━━━━━━━━━━━━━      ━━━  │
│ 4 300 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │ ← graduation basse (valeur min réelle)
├──────────────────────────────────────────────┤
│  O   N   D   J   F   M   A   M   J   J   A  S│ ← libellés de mois (rouge = mois signalé)
├──────────────────────────────────────────────┤
│ ━ Revenus  ━ Charges  ▬ Excédent  ▬ Déficit  │ ← légende
└──────────────────────────────────────────────┘
```

| Élément | Rôle | Obligatoire |
|---|---|---|
| Courbes | 2 à 5 séries, chacune avec sa couleur, son épaisseur, son tiret et son opacité | Oui (au moins 2 pour la zone) |
| Zone d'écart | Remplissage entre deux séries (`pair`), vert ou rouge selon le signe | Non (`fill: 'between'`) |
| Zone sous la courbe | Variante : remplissage entre une série et zéro | Non (`fill: 'zero'`) |
| Graduations Y | Deux lignes pointillées : valeur max et valeur min réelles, plus la ligne 0 si `zero: true` | Oui |
| Libellés Y | Valeur de chaque graduation, en haut à gauche de la ligne | Oui |
| Point final | Point plein sur le mois mis en avant (`hl`), pour chaque série | Oui (désactivable par série) |
| Libellés de mois | Un par point, alignés sous chaque point ; mois en avant en gras ; mois signalés en rouge | Oui |
| Prévision | Partie des courbes après `hl` en pointillés et atténuée | Non |
| Survol / toucher | Une bande invisible par mois avec une infobulle | Oui |
| Légende | Pastille de couleur + nom, un trait pour une courbe, un bloc pour une zone | Oui |

---

## 2. Données d'entrée

```js
renderMultiLineChart({
  series: [                        // 2 à 5 séries, même longueur
    { name:'Revenus',  values:[…12 nombres…], color:'var(--up)' },
    { name:'Charges',  values:[…], color:'var(--down)' },
    { name:'Fixes',    values:[…], color:'var(--c1)', width:1.8 },
    { name:'Budget',   values:[…], color:'var(--c1)', dash:'6 3' },
    { name:'Mensuel',  values:[…], color:'var(--up)', width:1.2, opacity:.35, noDot:true }
  ],
  fill: 'between',                 // 'between' | 'zero' | null
  pair: [0, 1],                    // index des 2 séries comparées (A, B)
  fillLabels: ['Excédent','Déficit'], // libellés de la zone dans la légende
  labels:     ['O','N','D','J','F','M','A','M','J','J','A','S'],
  labelsFull: ['Oct.','Nov.','Déc.','Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.'],
  highlight: 11,                   // index du mois mis en avant (point + gras)
  isForecast: i => false,          // true → segment en pointillés, libellé en italique
  isFlagged:  i => false,          // true → libellé du mois en rouge
  zero: false,                     // true → l'échelle inclut 0 et trace la ligne 0
  height: 130,                     // hauteur du tracé en px
  tooltip: i => `…`                // texte de l'infobulle du mois i
})
```

### Options par série

| Clé | Type | Défaut | Usage |
|---|---|---|---|
| `name` | string | requis | Libellé dans la légende |
| `values` | number[] | requis | Une valeur par mois |
| `color` | couleur CSS | requis | De préférence une variable du thème (`var(--up)`) |
| `width` | number | `2.2` | Épaisseur en px (reste identique quelle que soit la largeur de la carte) |
| `dash` | string | aucun | `stroke-dasharray`, par ex. `'6 3'` (budget), `'2 3'` (seuil) |
| `opacity` | number | `1` | `.35` pour une série de fond (valeurs brutes derrière une moyenne) |
| `noDot` | bool | `false` | Pas de point final (séries secondaires, seuils) |
| `legendDash` | bool | `false` | Affiche un trait pointillé dans la légende |

### Règles de lisibilité

- **5 séries au maximum.** Au-delà, les courbes se mélangent. Découpez alors en deux graphiques.
- **Une seule zone colorée par graphique.** Elle porte le message principal ; les autres séries sont des lignes seules.
- **Hiérarchie visuelle :** les deux séries de la zone sont en trait plein de 2,2 px. Les séries de détail sont plus fines (1,4–1,8 px), en pointillés ou atténuées.
- **La couleur ne doit jamais être le seul repère :** tirets, épaisseur et légende distinguent aussi les séries.

---

## 3. Calculs

### 3.1 Échelle

```
lo, hi = min et max de toutes les valeurs (plus 0 si zero = true)
marge  = (hi − lo) × 8 %             // de l'air en haut et en bas
lo    -= marge ; hi += marge

X(i) = (i + 0,5) / n × 100           // centre de la colonne i → aligné sous le libellé
Y(v) = (1 − (v − lo) / (hi − lo)) × 100
```

Le SVG utilise `viewBox="0 0 100 100"` et `preserveAspectRatio="none"` : il s'étire sur toute la largeur de la carte. Pour éviter que les traits se déforment, chaque tracé porte `vector-effect="non-scaling-stroke"`.

Les éléments qui doivent rester ronds ou lisibles (points, libellés Y) ne sont **pas** dans le SVG. Ce sont des `<span>` HTML positionnés en absolu à `left: X(i)%` et `top: Y(v)/100 × hauteur px`.

### 3.2 Zone d'écart avec croisement (le point clé)

Un simple polygone « A aller, B retour » donne une seule couleur, même quand les courbes se croisent. Il faut plutôt découper **chaque intervalle entre deux mois** :

```
pour i de 0 à n−2 :
  d0 = A[i]   − B[i]
  d1 = A[i+1] − B[i+1]

  si d0 × d1 < 0 :                        // les courbes se croisent dans l'intervalle
      t  = d0 / (d0 − d1)                 // position du croisement (0…1)
      xm = X(i) + (X(i+1) − X(i)) × t
      ym = Y(A[i] + (A[i+1] − A[i]) × t)
      triangle (X(i),A[i]) → (xm,ym) → (X(i),B[i])          couleur selon d0
      triangle (xm,ym) → (X(i+1),A[i+1]) → (X(i+1),B[i+1])  couleur selon d1
  sinon :
      quadrilatère A[i] → A[i+1] → B[i+1] → B[i]            couleur selon d0 + d1
```

Couleurs : vert = `color-mix(in srgb, var(--up) 16%, transparent)`, rouge = `color-mix(in srgb, var(--down) 22%, transparent)`. Le rouge est un peu plus dense pour attirer l'œil sur le problème.

Les polygones n'ont **pas de contour** : un contour semi-transparent créerait des traits verticaux visibles là où deux polygones se touchent.

**Sens de `pair` :** la zone est verte quand `series[pair[0]] > series[pair[1]]`. Pour comparer charges et budget, mettez le budget en premier (`pair:[budget, charges]`) : la zone est verte sous le budget et rouge au-dessus.

### 3.3 Graduations Y

On trace le **max réel** et le **min réel** des données, pas `lo`/`hi` qui contiennent la marge. Chaque libellé correspond ainsi à une valeur que le graphique atteint vraiment. Si `zero` est actif et que 0 est dans l'intervalle, on ajoute une ligne 0 en trait plein.

Format : `fmtK(v)` → `8 200`, `79,4k` à partir de 10 000, `−300` pour un négatif (vrai signe moins `−`).

### 3.4 Prévision

Si `isForecast(i)` est vrai pour certains mois, chaque série est tracée en deux parties :

- **réalisé** : les mois `!isForecast(i)`, en trait plein ;
- **prévision** : de `highlight` à la fin, avec `stroke-dasharray="4 3"`, une opacité de 60 % et 0,6 px de moins d'épaisseur.

Les deux tracés partagent le point `highlight`, donc la courbe ne présente aucune coupure.

---

## 4. Code de référence

Autonome, sans bibliothèque. Il renvoie une chaîne HTML à insérer dans une carte.

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

.mlc{display:grid;gap:10px}
.mlc-plot{position:relative}
.mlc-plot svg{display:block;width:100%;overflow:visible}
.mlc-plot path,.mlc-plot line{vector-effect:non-scaling-stroke}
.mlc-dot{position:absolute;width:8px;height:8px;border-radius:50%;transform:translate(-50%,-50%);
  border:2px solid var(--card);pointer-events:none}
.mlc-ylab{position:absolute;left:0;transform:translateY(-50%);font-size:9px;font-weight:600;color:var(--muted);
  background:var(--card);padding-right:3px;font-variant-numeric:tabular-nums;pointer-events:none}
.mlc-hit{position:absolute;inset:0;display:flex}
.mlc-hit span{flex:1}
.mlc-hit span:hover{background:color-mix(in srgb,var(--accent) 7%,transparent)}
.mlc-x{display:flex}
.mlc-x span{flex:1;text-align:center;font-size:9px;font-weight:600;color:var(--muted)}
.mlc-x span.hl{color:var(--text);font-weight:700}
.mlc-x span.fc{opacity:.55;font-style:italic}
.mlc-x span.flag{color:var(--down);font-weight:800}
.mlc-key{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:11px;color:var(--muted)}
.mlc-key span{display:inline-flex;align-items:center;gap:5px}
.mlc-key i{width:12px;height:3px;border-radius:2px;flex:none}
.mlc-key i.area{height:8px}
```

> Les libellés de mois utilisent `flex:1` **sans `gap`** : le centre de chaque libellé tombe alors exactement sur `X(i) = (i+0,5)/n`.

### 4.2 JavaScript

```js
function fmtK(v){
  const s = v < 0 ? '−' : ''; v = Math.abs(v);
  return s + (v >= 10000
    ? (Math.round(v/100)/10).toLocaleString('fr-CH') + 'k'
    : Math.round(v).toLocaleString('fr-CH'));
}
const escAttr = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

/* Zone entre deux séries, découpée aux croisements */
function gapFill(a, b, X, Y, pos='var(--up)', neg='var(--down)'){
  const cPos = `color-mix(in srgb,${pos} 16%,transparent)`;
  const cNeg = `color-mix(in srgb,${neg} 22%,transparent)`;
  const poly = (pts, c) =>
    `<path d="M${pts.map(p => p[0].toFixed(3)+' '+p[1].toFixed(3)).join(' L')} Z" fill="${c}" stroke="none"/>`;
  let out = '';
  for (let i = 0; i < a.length - 1; i++){
    const d0 = a[i] - b[i], d1 = a[i+1] - b[i+1];
    if (d0 * d1 < 0){
      const t  = d0 / (d0 - d1);
      const xm = X(i) + (X(i+1) - X(i)) * t;
      const ym = Y(a[i] + (a[i+1] - a[i]) * t);
      out += poly([[X(i),Y(a[i])],[xm,ym],[X(i),Y(b[i])]], d0 > 0 ? cPos : cNeg);
      out += poly([[xm,ym],[X(i+1),Y(a[i+1])],[X(i+1),Y(b[i+1])]], d1 > 0 ? cPos : cNeg);
    } else {
      out += poly([[X(i),Y(a[i])],[X(i+1),Y(a[i+1])],[X(i+1),Y(b[i+1])],[X(i),Y(b[i])]],
                  (d0 + d1) >= 0 ? cPos : cNeg);
    }
  }
  return out;
}

function renderMultiLineChart(o){
  const {
    series, labels, labelsFull = labels,
    fill = 'between', pair = [0,1], fillLabels = ['Excédent','Déficit'],
    highlight = labels.length - 1, isForecast = () => false, isFlagged = () => false,
    zero = false, height: H = 130, tooltip = () => '', showLegend = true
  } = o;

  const n = labels.length;
  const hasFc = labels.some((_, i) => isForecast(i));
  const vals = series.flatMap(s => s.values);

  // Échelle
  let lo = Math.min(...vals, ...(zero ? [0] : [])), hi = Math.max(...vals, ...(zero ? [0] : []));
  const pad = (hi - lo) * .08 || 1; lo -= pad; hi += pad;
  const X = i => (i + .5) / n * 100;
  const Y = v => (1 - (v - lo) / (hi - lo)) * 100;
  const pathOf = (v, keep) => {
    let p = '';
    v.forEach((y, i) => { if (keep(i)) p += (p ? ' L' : 'M') + `${X(i).toFixed(2)} ${Y(y).toFixed(2)}`; });
    return p;
  };

  // Zone
  let area = '';
  if (fill === 'between' && series.length >= 2)
    area = gapFill(series[pair[0]].values, series[pair[1]].values, X, Y);
  else if (fill === 'zero'){
    const v = series[0].values;
    area = `<path d="M${X(0)} ${Y(0)} ${v.map((y,i)=>'L'+X(i)+' '+Y(y)).join(' ')} L${X(n-1)} ${Y(0)} Z"
      fill="color-mix(in srgb,${series[0].color} 14%,transparent)" stroke="none"/>`;
  }

  // Graduations = valeurs réelles
  const ticks = [Math.max(...vals), Math.min(...vals)];
  if (zero && lo < 0 && hi > 0) ticks.push(0);
  const grid = ticks.map(t =>
    `<line x1="0" x2="100" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--border)" stroke-width="1"
      ${t === 0 ? '' : 'stroke-dasharray="2 3"'}/>`).join('');

  // Courbes (réalisé + prévision)
  const lines = series.map(s => {
    const w = s.width ?? 2.2, op = s.opacity ?? 1;
    const real = `<path d="${pathOf(s.values, i => !isForecast(i))}" fill="none" stroke="${s.color}"
      stroke-width="${w}" stroke-linejoin="round" opacity="${op}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
    const fc = hasFc ? `<path d="${pathOf(s.values, i => i >= highlight)}" fill="none" stroke="${s.color}"
      stroke-width="${Math.max(w - .6, 1)}" stroke-dasharray="4 3" opacity="${op * .6}"/>` : '';
    return real + fc;
  }).join('');

  // Éléments HTML superposés
  const dots = series.filter(s => !s.noDot).map(s =>
    `<span class="mlc-dot" style="left:${X(highlight)}%;top:${Y(s.values[highlight]) / 100 * H}px;background:${s.color}"></span>`).join('');
  const ylabs = ticks.map(t =>
    `<span class="mlc-ylab" style="top:${Y(t) / 100 * H}px">${fmtK(t)}</span>`).join('');
  const hits = labels.map((_, i) =>
    `<span title="${escAttr(labelsFull[i] + (isForecast(i) ? ' (prévision)' : '') + ' · ' + tooltip(i))}"></span>`).join('');
  const xlabs = labels.map((l, i) => {
    const c = [i === highlight && 'hl', isForecast(i) && 'fc', isFlagged(i) && 'flag'].filter(Boolean).join(' ');
    return `<span class="${c}">${l}</span>`;
  }).join('');

  // Légende
  const key = !showLegend ? '' : `<div class="mlc-key">
    ${series.map(s => `<span><i style="background:${s.legendDash
        ? `repeating-linear-gradient(90deg,${s.color} 0 3px,transparent 3px 5px)` : s.color};opacity:${Math.max(s.opacity ?? 1, .5)}"></i>${s.name}</span>`).join('')}
    ${fill === 'between' ? `
      <span><i class="area" style="background:color-mix(in srgb,var(--up) 30%,transparent)"></i>${fillLabels[0]}</span>
      <span><i class="area" style="background:color-mix(in srgb,var(--down) 35%,transparent)"></i>${fillLabels[1]}</span>` : ''}
    ${hasFc ? `<span><i style="background:repeating-linear-gradient(90deg,var(--muted) 0 3px,transparent 3px 5px)"></i>Prévision</span>` : ''}
  </div>`;

  return `<div class="mlc">
    <div class="mlc-plot">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="height:${H}px" role="img"
        aria-label="${escAttr(series.map(s => s.name).join(', '))}">${grid}${area}${lines}</svg>
      ${dots}${ylabs}<div class="mlc-hit">${hits}</div>
    </div>
    <div class="mlc-x">${xlabs}</div>
    ${key}
  </div>`;
}
```

### 4.3 Infobulles au toucher (mobile)

L'attribut `title` ne s'affiche pas au toucher. Ajoutez une bulle flottante :

```html
<div id="mlc-tip" hidden style="position:fixed;z-index:50;max-width:240px;background:var(--text);color:var(--card);
  font-size:12px;font-weight:600;padding:6px 9px;border-radius:8px;pointer-events:none"></div>
```

```js
const tip = document.getElementById('mlc-tip'); let tipT;
document.addEventListener('pointerup', e => {
  if (e.pointerType === 'mouse') return;
  const el = e.target.closest('.mlc-hit [title]');
  if (!el){ tip.hidden = true; return; }
  tip.textContent = el.getAttribute('title'); tip.hidden = false;
  tip.style.left = Math.max(8, Math.min(e.clientX, innerWidth - 250)) + 'px';
  tip.style.top  = Math.max(e.clientY - 44, 8) + 'px';
  clearTimeout(tipT); tipT = setTimeout(() => tip.hidden = true, 2800);
});
```

---

## 5. Les 6 configurations

Toutes utilisent la même fonction ; seules les séries et `pair` changent. Données sur 12 mois : `rev`, `chg`, `res`, `pkt`, `fix`, `sal`, `fre`, `aut`, `bud`.

```js
const L  = ['O','N','D','J','F','M','A','M','J','J','A','S'];
const LF = ['Oct.','Nov.','Déc.','Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.'];
const base = { labels:L, labelsFull:LF, highlight:11 };
```

### #17 · Référence (2 courbes)

```js
renderMultiLineChart({ ...base,
  series:[
    { name:'Revenus', values:rev, color:'var(--up)' },
    { name:'Charges', values:chg, color:'var(--down)' }
  ],
  isFlagged: i => chg[i] > rev[i],
  tooltip:   i => `revenus ${rev[i]} · charges ${chg[i]} · écart ${rev[i]-chg[i]} CHF`
});
```

### #17a · Sorties totales (3 courbes)

Zone = revenus face à toutes les sorties, c'est-à-dire le solde non alloué.

```js
const out = chg.map((c,i) => c + res[i] + pkt[i]);
renderMultiLineChart({ ...base,
  series:[
    { name:'Revenus',         values:rev, color:'var(--up)' },
    { name:'Sorties totales', values:out, color:'var(--text)', width:2 },
    { name:'Charges seules',  values:chg, color:'var(--down)', width:1.6, dash:'4 3', legendDash:true }
  ],
  pair:[0,1],
  isFlagged: i => out[i] > rev[i],
  tooltip:   i => `revenus ${rev[i]} · sorties ${out[i]} · dont charges ${chg[i]}`
});
```

### #17b · Fixes vs variables (4 courbes)

```js
const vari = chg.map((c,i) => c - fix[i]);
renderMultiLineChart({ ...base,
  series:[
    { name:'Revenus',         values:rev,  color:'var(--up)' },
    { name:'Charges totales', values:chg,  color:'var(--down)' },
    { name:'Fixes',           values:fix,  color:'var(--c1)', width:1.8 },
    { name:'Variables',       values:vari, color:'var(--c3)', width:1.8 }
  ],
  isFlagged: i => chg[i] > rev[i],
  tooltip:   i => `charges ${chg[i]} = fixes ${fix[i]} + variables ${vari[i]}`
});
```

### #17c · Revenus par source (5 courbes)

```js
renderMultiLineChart({ ...base,
  series:[
    { name:'Revenu total', values:rev, color:'var(--up)' },
    { name:'Charges',      values:chg, color:'var(--down)' },
    { name:'Salaire',      values:sal, color:'var(--c1)', width:1.6, dash:'5 3', legendDash:true },
    { name:'Freelance',    values:fre, color:'var(--c2)', width:1.6, dash:'5 3', legendDash:true },
    { name:'Autres',       values:aut, color:'var(--c4)', width:1.4, dash:'2 2', legendDash:true, noDot:true }
  ],
  isFlagged: i => chg[i] > rev[i],
  tooltip:   i => `total ${rev[i]} = salaire ${sal[i]} + freelance ${fre[i]} + autres ${aut[i]}`
});
```

### #17d · Tendance, moyenne mobile sur 3 mois (4 courbes)

Les moyennes sont en gras et portent la zone ; les valeurs brutes restent en fond.

```js
const mm3 = a => a.map((_,i) => { const w = a.slice(Math.max(0,i-2), i+1); return w.reduce((s,v)=>s+v,0)/w.length; });
const mRev = mm3(rev), mChg = mm3(chg);
renderMultiLineChart({ ...base,
  series:[
    { name:'Revenus MM3',       values:mRev, color:'var(--up)',   width:2.6 },
    { name:'Charges MM3',       values:mChg, color:'var(--down)', width:2.6 },
    { name:'Revenus mensuels',  values:rev,  color:'var(--up)',   width:1.2, opacity:.35, noDot:true },
    { name:'Charges mensuelles',values:chg,  color:'var(--down)', width:1.2, opacity:.35, noDot:true }
  ],
  isFlagged: i => mChg[i] > mRev[i],
  tooltip:   i => `moy. 3 mois : ${Math.round(mRev[i])} / ${Math.round(mChg[i])}`
});
```

### #17e · Réel vs budget (4 courbes)

Zone = budget face aux charges : verte sous le budget, rouge au-dessus.

```js
const seuil = rev.map(r => r * .8);
renderMultiLineChart({ ...base,
  series:[
    { name:'Revenus',            values:rev,   color:'var(--up)' },
    { name:'Charges réelles',    values:chg,   color:'var(--down)' },
    { name:'Budget',             values:bud,   color:'var(--c1)',  width:1.8, dash:'6 3', legendDash:true },
    { name:'Seuil 80 % revenus', values:seuil, color:'var(--warn)', width:1.4, dash:'2 3', legendDash:true, noDot:true }
  ],
  pair:[2,1],
  fillLabels:['Sous budget','Hors budget'],
  isFlagged: i => chg[i] > bud[i],
  tooltip:   i => `charges ${chg[i]} · budget ${bud[i]} · seuil ${Math.round(seuil[i])}`
});
```

---

## 6. Cas limites à tester

| Cas | Comportement attendu |
|---|---|
| Charges > revenus sur 1 mois isolé | Deux triangles rouges autour du pic, la couleur change pile au croisement |
| Charges > revenus sur plusieurs mois de suite | Zone rouge continue, sans coupure visible |
| Courbes qui se croisent à chaque mois (revenus irréguliers) | Alternance vert / rouge, un point de bascule par croisement |
| Valeurs égales (`d0 = 0`) | Pas de division par zéro : le cas `d0 × d1 < 0` est faux, on dessine un quadrilatère |
| Toutes les valeurs identiques | `pad = … \|\| 1` évite une échelle nulle ; les deux libellés Y sont identiques |
| Série à 0 (freelance absent) | La courbe suit la graduation basse ; le libellé Y affiche `0` |
| Valeurs négatives (solde cumulé) | `zero:true` et `fill:'zero'` : ligne 0 pleine, remplissage vers 0 |
| Mois de prévision | Pointillés à partir de `highlight`, libellés en italique, légende « Prévision » |
| Carte étroite (mobile ~330 px) | Le SVG s'étire, les traits gardent leur épaisseur, les points restent ronds |
| Thème sombre | Toutes les couleurs passent par des variables CSS ; les libellés Y ont un fond `var(--card)` |

---

## 7. Accessibilité

- Le `<svg>` a `role="img"` et un `aria-label` qui liste les séries.
- Chaque mois a une zone de survol avec un `title` complet ; au toucher, la bulle flottante de la section 4.3 prend le relais.
- Les séries se distinguent aussi par le tiret, l'épaisseur et l'opacité, pas seulement par la couleur.
- Les mois signalés sont en rouge **et** en gras dans l'axe X.