import {
  AggregatDto, CategorieDto, PosteDto, ProjectionAnnuelleDto, ResolutionArgentPocheDto,
  ResolutionArgentPocheFoyerMoisDto, VentilationAnnuelleDto, VentilationsDto,
} from '../../../core/models/api.models';
import {
  CascadeEtape, CategorieEcartRow, FiltrePostesDiff, HeatmapLigne, IndicateurEcart,
  MoisAgregatEnrichi, Perimetre, PosteDiffRow, ScenarioComparaisonData, StatutDiffPoste,
} from './comparaison-scenarios.models';

const AGREGAT_VIDE: AggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };

function enrichir(base: AggregatDto | undefined, argentPoche: number): MoisAgregatEnrichi {
  const a = base ?? AGREGAT_VIDE;
  return {
    revenus: a.revenus,
    charges: a.charges,
    reserves: a.reserves,
    soldeDisponible: a.soldeDisponible,
    argentPoche,
    ravBrut: a.soldeDisponible + argentPoche,
  };
}

/**
 * Combine les réponses déjà calculées par le back (projection annuelle + ventilation
 * annuelle + résolution d'argent de poche) en un seul modèle d'affichage pour un
 * scénario — aucune règle moteur réinventée ici, uniquement de l'indexation/agrégation
 * de données déjà agrégées côté serveur (doc 01 §1/§4/§7).
 */
export function construireDonneesScenario(
  projection: ProjectionAnnuelleDto,
  ventilation: VentilationAnnuelleDto,
  postes: PosteDto[],
  poche: ResolutionArgentPocheDto[] | ResolutionArgentPocheFoyerMoisDto[],
  perimetre: Perimetre,
): ScenarioComparaisonData {
  const estFoyer = perimetre === 'foyer';

  const pocheParMois: number[] = new Array(12).fill(0);
  if (estFoyer) {
    for (const p of poche as ResolutionArgentPocheFoyerMoisDto[]) {
      pocheParMois[p.mois - 1] = p.total;
    }
  } else {
    (poche as ResolutionArgentPocheDto[]).forEach((p, index) => { pocheParMois[index] = p.montant; });
  }

  const aggregatsBase: AggregatDto[] = estFoyer
    ? projection.mois.map(m => m.agregat)
    : (projection.moisParMembre[perimetre] ?? []);

  const moisAgregats = Array.from({ length: 12 }, (_, i) => enrichir(aggregatsBase[i], pocheParMois[i] ?? 0));

  const totalAnnuelBase = estFoyer ? projection.totalAnnuel : (projection.parMembre[perimetre] ?? AGREGAT_VIDE);
  const pocheAnnuelle = pocheParMois.reduce((somme, v) => somme + v, 0);
  const totalAnnuel = enrichir(totalAnnuelBase, pocheAnnuelle);

  const parCategorie: Record<string, number> = estFoyer
    ? { ...ventilation.parCategorie }
    : Object.fromEntries(
        Object.entries(ventilation.parCategorieMembre).map(([catId, parMembre]) => [catId, parMembre[perimetre] ?? 0]),
      );

  return { moisAgregats, totalAnnuel, parCategorie, postes };
}

/** Les 5 indicateurs budgétaires transverses (doc feature_5_bis §4), à partir des
 *  totaux annuels déjà combinés de chaque scénario. Non affichés sur cet écran
 *  mais le contrat doit exister pour un futur réemploi. */
export function construireIndicateurs(
  a: MoisAgregatEnrichi,
  b: MoisAgregatEnrichi,
  labels: { revenus: string; charges: string; reserves: string; argentPoche: string; soldeDisponible: string },
  notes: { reserves: string; argentPoche: string; soldeDisponible: string },
): IndicateurEcart[] {
  return [
    { cle: 'revenus', label: labels.revenus, valeurA: a.revenus, valeurB: b.revenus, sensFavorable: 1 },
    { cle: 'charges', label: labels.charges, valeurA: a.charges, valeurB: b.charges, sensFavorable: -1 },
    { cle: 'reserves', label: labels.reserves, valeurA: a.reserves, valeurB: b.reserves, sensFavorable: -1, note: notes.reserves },
    { cle: 'argentPoche', label: labels.argentPoche, valeurA: a.argentPoche, valeurB: b.argentPoche, sensFavorable: -1, note: notes.argentPoche },
    { cle: 'soldeDisponible', label: labels.soldeDisponible, valeurA: a.soldeDisponible, valeurB: b.soldeDisponible, sensFavorable: 1, note: notes.soldeDisponible },
  ];
}

/** Cascade budgétaire (doc feature_5_bis §7) — un agrégat (mois précis ou total
 *  annuel) → 6 étapes, avec sens favorable et opérateur visuel par colonne.
 *
 *  Les libellés sont passés par le composant (i18n) ; l'ordre et les métadonnées
 *  (opérateur, sens, couleur) sont figés par la spec. */
export function construireCascade(
  a: MoisAgregatEnrichi,
  b: MoisAgregatEnrichi,
  labels: { revenus: string; charges: string; reserves: string; rav: string; argentPoche: string; soldeDisponible: string },
): CascadeEtape[] {
  return [
    { cle: 'revenus', label: labels.revenus, valeurA: a.revenus, valeurB: b.revenus,
      sensFavorable: 1, operateur: '', estResultat: false, couleurBarre: 'var(--p-primary-500)' },
    { cle: 'charges', label: labels.charges, valeurA: a.charges, valeurB: b.charges,
      sensFavorable: -1, operateur: '−', estResultat: false, couleurBarre: 'var(--p-red-500)' },
    { cle: 'reserves', label: labels.reserves, valeurA: a.reserves, valeurB: b.reserves,
      sensFavorable: -1, operateur: '−', estResultat: false, couleurBarre: 'var(--p-blue-500)' },
    { cle: 'rav', label: labels.rav, valeurA: a.ravBrut, valeurB: b.ravBrut,
      sensFavorable: 1, operateur: '=', estResultat: true, couleurBarre: 'var(--p-surface-400)' },
    { cle: 'argentPoche', label: labels.argentPoche, valeurA: a.argentPoche, valeurB: b.argentPoche,
      sensFavorable: -1, operateur: '−', estResultat: false, couleurBarre: 'var(--p-amber-500)' },
    { cle: 'soldeDisponible', label: labels.soldeDisponible, valeurA: a.soldeDisponible, valeurB: b.soldeDisponible,
      sensFavorable: 1, operateur: '=', estResultat: true, couleurBarre: 'var(--p-surface-400)' },
  ];
}

/** Totaux par catégorie (doc feature_5_bis §6) — une ligne par catégorie du foyer,
 *  y compris à écart nul (le filtrage « écarts uniquement » est laissé au composant
 *  table). Le champ `effet = impact × ecart` porte le sens favorable pour le tri
 *  et la barre divergente. */
export function construireCategoriesEcart(
  categories: CategorieDto[],
  parCategorieA: Record<string, number>,
  parCategorieB: Record<string, number>,
): CategorieEcartRow[] {
  return categories.map(c => {
    const totalA = parCategorieA[c.id] ?? 0;
    const totalB = parCategorieB[c.id] ?? 0;
    const ecart = totalB - totalA;
    const impact: 1 | -1 = c.typePoste === 'REVENU' ? 1 : -1;
    return {
      categorieId: c.id, libelle: c.libelle, type: c.typePoste,
      totalA, totalB, ecart, impact, effet: impact * ecart,
    };
  });
}

/** Clé d'appariement d'un poste entre deux scénarios distincts n'ayant aucun lien de
 *  duplication commun : fallback par contenu (type + description normalisée), seul
 *  identifiant "métier" disponible dans ce cas (scénarios anciens sans `sourcePosteId`,
 *  ou postes créés indépendamment dans chaque scénario). */
function cleAppariement(p: PosteDto): string {
  return `${p.type}::${(p.description ?? '').trim().toLowerCase()}`;
}

/** Racine de la chaîne de duplication d'un poste (doc feature_5_bis §9) : un poste
 *  jamais dupliqué est sa propre racine (`p.id`) ; une copie porte la racine du tout
 *  premier poste dont elle est issue (`p.sourcePosteId`, propagé transitivement côté
 *  back — cf. `ScenarioService#dupliquerPostes`). Deux postes de scénarios distincts
 *  partageant la même racine sont **le même poste métier**, quels que soient les
 *  changements de description/catégorie/montant qu'il a subis depuis. */
function racineAppariement(p: PosteDto): string {
  return p.sourcePosteId ?? p.id;
}

function montantAnnuel(p: PosteDto): number {
  return p.montantMensualise * 12;
}

function posteEquivalent(a: PosteDto, b: PosteDto): boolean {
  return a.montant === b.montant
    && a.periodiciteMois === b.periodiciteMois
    && a.mode === b.mode
    && a.moment === b.moment
    && a.nature === b.nature
    && a.debut === b.debut
    && a.fin === b.fin
    && (a.devise ?? null) === (b.devise ?? null)
    && (a.categorieId ?? null) === (b.categorieId ?? null);
}

/** Diff poste à poste (doc feature_5_bis §9) entre les deux scénarios.
 *
 *  L'appariement se fait en priorité par **racine de duplication commune**
 *  (`sourcePosteId`/`id`, cf. `racineAppariement`) — le cas le plus fréquent, un
 *  scénario B étant presque toujours une copie/variante de A. En fallback (postes
 *  créés indépendamment dans chaque scénario, ou scénarios antérieurs à l'ajout de
 *  `sourcePosteId`), appariement par contenu métier (type + description normalisée). */
export function construirePostesDiff(
  postesA: PosteDto[],
  postesB: PosteDto[],
  categoriesParId: Record<string, CategorieDto>,
): PosteDiffRow[] {
  const parRacineA = new Map(postesA.map(p => [racineAppariement(p), p]));
  const parRacineB = new Map(postesB.map(p => [racineAppariement(p), p]));
  const parContenuB = new Map(postesB.map(p => [cleAppariement(p), p]));

  const consommesA = new Set<string>();
  const consommesB = new Set<string>();
  const paires: Array<{ a?: PosteDto; b?: PosteDto }> = [];

  // 1) Appariement par racine de duplication commune (le cas de loin le plus fréquent).
  for (const [racine, a] of parRacineA) {
    const b = parRacineB.get(racine);
    if (b && !consommesB.has(b.id)) {
      paires.push({ a, b });
      consommesA.add(a.id);
      consommesB.add(b.id);
    }
  }

  // 2) Fallback par contenu métier (type + description normalisée).
  for (const a of postesA) {
    if (consommesA.has(a.id)) continue;
    const cle = cleAppariement(a);
    const b = parContenuB.get(cle);
    if (b && !consommesB.has(b.id)) {
      paires.push({ a, b });
      consommesA.add(a.id);
      consommesB.add(b.id);
    }
  }

  // 3) Postes restants = SUPPRIME (dans A seul) ou AJOUTE (dans B seul).
  for (const a of postesA) if (!consommesA.has(a.id)) paires.push({ a });
  for (const b of postesB) if (!consommesB.has(b.id)) paires.push({ b });

  return paires.map(({ a, b }, index) => construireLigneDiff(a, b, categoriesParId, index));
}

function construireLigneDiff(
  posteA: PosteDto | undefined,
  posteB: PosteDto | undefined,
  categoriesParId: Record<string, CategorieDto>,
  ordre: number,
): PosteDiffRow {
  const reference = posteB ?? posteA;
  if (!reference) throw new Error('Paire vide de postes dans la diff');

  let statut: StatutDiffPoste;
  if (posteA && !posteB) statut = 'SUPPRIME';
  else if (!posteA && posteB) statut = 'AJOUTE';
  else statut = posteEquivalent(posteA!, posteB!) ? 'INCHANGE' : 'MODIFIE';

  const montantAnnuelA = posteA ? montantAnnuel(posteA) : null;
  const montantAnnuelB = posteB ? montantAnnuel(posteB) : null;
  const signe = reference.type === 'REVENU' ? 1 : -1;
  const effetNet = signe * ((montantAnnuelB ?? 0) - (montantAnnuelA ?? 0));
  const estRevision = !!(posteA?.posteOrigineId || posteA?.posteSuivantId
    || posteB?.posteOrigineId || posteB?.posteSuivantId);

  return {
    cle: `${posteA?.id ?? ''}::${posteB?.id ?? ''}::${ordre}`,
    description: reference.description,
    categorieLibelle: reference.categorieId ? categoriesParId[reference.categorieId]?.libelle : undefined,
    type: reference.type,
    periodiciteMois: reference.periodiciteMois,
    mode: reference.mode,
    moment: reference.moment,
    nature: reference.nature,
    debut: reference.debut,
    fin: reference.fin,
    devise: reference.devise,
    statut,
    estRevision,
    montantAnnuelA,
    montantAnnuelB,
    montantAvant: posteA?.montant ?? null,
    montantApres: posteB?.montant ?? null,
    effetNet,
  };
}

export function filtrerPostesDiff(lignes: PosteDiffRow[], filtre: FiltrePostesDiff): PosteDiffRow[] {
  switch (filtre) {
    case 'CHANGES': return lignes.filter(l => l.statut !== 'INCHANGE');
    case 'AJOUT': return lignes.filter(l => l.statut === 'AJOUTE');
    case 'SUPPR': return lignes.filter(l => l.statut === 'SUPPRIME');
    case 'MODIF': return lignes.filter(l => l.statut === 'MODIFIE');
    case 'TOUS': return lignes;
  }
}

/** Ordre des statuts pour le tri de la diff (feature_5_bis §9) : Ajouté →
 *  Supprimé → Modifié → Inchangé, puis par `|totalB − totalA|` décroissant. */
const ORDRE_STATUT: Record<StatutDiffPoste, number> = {
  AJOUTE: 0, SUPPRIME: 1, MODIFIE: 2, INCHANGE: 3,
};

export function trierPostesDiff(lignes: PosteDiffRow[]): PosteDiffRow[] {
  return [...lignes].sort((x, y) => {
    const parStatut = ORDRE_STATUT[x.statut] - ORDRE_STATUT[y.statut];
    if (parStatut !== 0) return parStatut;
    const ampX = Math.abs((x.montantAnnuelB ?? 0) - (x.montantAnnuelA ?? 0));
    const ampY = Math.abs((y.montantAnnuelB ?? 0) - (y.montantAnnuelA ?? 0));
    return ampY - ampX;
  });
}

/** Compteur par statut, calculé sur l'ensemble des lignes **avant filtrage**
 *  (feature_5_bis §9 en-tête). */
export function compterParStatut(lignes: PosteDiffRow[]): Record<StatutDiffPoste, number> {
  const compteur: Record<StatutDiffPoste, number> = { AJOUTE: 0, SUPPRIME: 0, MODIFIE: 0, INCHANGE: 0 };
  for (const ligne of lignes) compteur[ligne.statut] += 1;
  return compteur;
}

/** Carte de chaleur mois × catégorie (doc feature_5_bis §8) — nécessite le détail
 *  mensuel par catégorie (endpoint `projection/mensuelle`, appelé 12 fois par
 *  scénario faute d'endpoint annuel avec détail mois × catégorie). Effet signé
 *  sur le solde disponible : positif = B fait mieux ce mois-là pour cette
 *  catégorie.
 *
 *  Seuil d'inclusion d'une ligne : `somme(|v|) >= 1` sur les 12 mois — sous ce
 *  seuil la catégorie est omise pour ne pas surcharger la grille. Le seuil de
 *  significativité **par cellule** (`< 0.5`) est appliqué à l'affichage par le
 *  composant, pas ici. */
export function construireHeatmap(
  categories: CategorieDto[],
  mensuelA: VentilationsDto[],
  mensuelB: VentilationsDto[],
  argentPocheParMoisA: number[],
  argentPocheParMoisB: number[],
  perimetre: Perimetre,
  libelleArgentPoche: string,
  seuilSommeInclusion = 1,
): HeatmapLigne[] {
  const estFoyer = perimetre === 'foyer';
  const lignes: HeatmapLigne[] = [];

  for (const categorie of categories) {
    const signe = categorie.typePoste === 'REVENU' ? 1 : -1;
    const valeursParMois = Array.from({ length: 12 }, (_, i) => {
      const a = estFoyer
        ? (mensuelA[i]?.parCategorie[categorie.id] ?? 0)
        : (mensuelA[i]?.parCategorieMembre[categorie.id]?.[perimetre] ?? 0);
      const b = estFoyer
        ? (mensuelB[i]?.parCategorie[categorie.id] ?? 0)
        : (mensuelB[i]?.parCategorieMembre[categorie.id]?.[perimetre] ?? 0);
      return signe * (b - a);
    });
    const somme = valeursParMois.reduce((s, v) => s + Math.abs(v), 0);
    if (somme >= seuilSommeInclusion) {
      lignes.push({ cle: categorie.id, libelle: categorie.libelle, valeursParMois });
    }
  }

  const argentPocheValeurs = Array.from({ length: 12 }, (_, i) =>
    -((argentPocheParMoisB[i] ?? 0) - (argentPocheParMoisA[i] ?? 0)));
  const sommePoche = argentPocheValeurs.reduce((s, v) => s + Math.abs(v), 0);
  if (sommePoche >= seuilSommeInclusion) {
    lignes.push({ cle: '__argent-poche__', libelle: libelleArgentPoche, valeursParMois: argentPocheValeurs });
  }

  return lignes;
}

/** Bornes de l'horizon commun aux deux scénarios (doc feature §2) — l'année
 *  sélectionnable doit appartenir à l'intersection des deux horizons. */
export function anneesCommunes(
  a: { anneeDepart: number; horizonAnnees: number },
  b: { anneeDepart: number; horizonAnnees: number },
): number[] {
  const debut = Math.max(a.anneeDepart, b.anneeDepart);
  const fin = Math.min(a.anneeDepart + a.horizonAnnees - 1, b.anneeDepart + b.horizonAnnees - 1);
  if (fin < debut) return [];
  return Array.from({ length: fin - debut + 1 }, (_, i) => debut + i);
}
