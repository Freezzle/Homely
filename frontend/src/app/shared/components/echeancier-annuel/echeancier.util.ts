import {
  CapsuleVue,
  Coupe,
  EcheancierVue,
  EtatMois,
  Groupe,
  MoisVue,
  PerleVue,
  PosteEcheancier,
  Repere,
} from './echeancier.model';

interface Ym { readonly annee: number; readonly mois: number; }

const ym = (iso: string): Ym => ({ annee: +iso.slice(0, 4), mois: +iso.slice(5, 7) });
/** Mois absolu : douze par an, base 0 sur janvier. */
const abs = (v: Ym): number => v.annee * 12 + (v.mois - 1);
const modulo = (a: number, n: number): number => ((a % n) + n) % n;

/** R3 + R4 — fenêtre de validité. Un ponctuel se réduit à son mois de référence. */
export function estActif(p: PosteEcheancier, annee: number, mois: number): boolean {
  const d = ym(p.debut);
  if (p.periodicite === 0) return annee === d.annee && mois === d.mois;

  const f = p.fin ? ym(p.fin) : null;
  const apres = annee > d.annee || (annee === d.annee && mois >= d.mois);
  const avant = !f || annee < f.annee || (annee === f.annee && mois <= f.mois);
  return apres && avant;
}

function estOccurrence(p: PosteEcheancier, mois: number): boolean {
  const ancre = ym(p.debut).mois;
  return p.moment === 'FIN_PERIODE'
    ? modulo(mois - ancre + 1, p.periodicite) === 0
    : modulo(mois - ancre, p.periodicite) === 0;
}

/** R5 — le budget impute-t-il, une échéance tombe-t-elle, mois par mois. */
export function imputations(
  p: PosteEcheancier, annee: number,
): { impute: boolean[]; echeance: boolean[] } {
  const impute: boolean[] = [];
  const echeance: boolean[] = [];

  for (let mois = 1; mois <= 12; mois++) {
    if (!estActif(p, annee, mois)) { impute.push(false); echeance.push(false); continue; }
    if (p.periodicite === 0 || p.periodicite === 1) { impute.push(true); echeance.push(true); continue; }
    if (p.moment === 'INCONNU') { impute.push(true); echeance.push(false); continue; }

    const occurrence = estOccurrence(p, mois);
    impute.push(p.mode === 'PERIODIQUE' ? occurrence : true);
    echeance.push(occurrence);
  }
  return { impute, echeance };
}

function etat(impute: boolean, actif: boolean): EtatMois {
  if (!actif) return 'hors-validite';
  return impute ? 'impute' : 'actif';
}

/** R4 + R8 — un seul repère par mois, jamais cumulé. */
function repere(p: PosteEcheancier, annee: number, mois: number): Repere {
  const d = ym(p.debut);
  const surDebut = annee === d.annee && mois === d.mois;
  if (p.periodicite === 0) return surDebut ? 'ponctuel' : null;
  if (surDebut) return 'debut';
  const f = p.fin ? ym(p.fin) : null;
  if (f && annee === f.annee && mois === f.mois) return 'fin';
  return null;
}

function styleCapsule(p: PosteEcheancier): Pick<CapsuleVue, 'style' | 'raison'> {
  if (p.moment === 'INCONNU') return { style: 'pointillee', raison: 'moment-inconnu' };
  if (p.mode === 'PERIODIQUE') return { style: 'pointillee', raison: 'imputation-pleine' };
  return { style: 'pleine', raison: 'provision' };
}

/**
 * R7 + R8 — les cycles qui traversent l'année, écrêtés, avec leurs bords.
 * Travailler en mois absolus permet de dessiner le fragment d'un cycle ouvert
 * l'année précédente : sans lui, ses mois seraient imputés sans capsule.
 */
export function cycles(p: PosteEcheancier, annee: number): CapsuleVue[] {
  if (p.periodicite === 0) return [];

  const debutAbs = abs(ym(p.debut));
  const finAbs = p.fin ? abs(ym(p.fin)) : Number.POSITIVE_INFINITY;
  const anneeDu = annee * 12;
  const anneeAu = annee * 12 + 11;

  const bas = Math.max(debutAbs, anneeDu);
  const haut = Math.min(finAbs, anneeAu);
  if (haut < bas) return [];

  const style = styleCapsule(p);
  const fabrique = (naturelDu: number, naturelAu: number): CapsuleVue | null => {
    const du = Math.max(naturelDu, anneeDu, debutAbs);
    const au = Math.min(naturelAu, anneeAu, finAbs);
    if (au < du) return null;
    const coupeDu: Coupe = du === naturelDu ? null : 'annee';
    const coupeAu: Coupe = au === naturelAu ? null : (au === finAbs ? 'validite' : 'annee');
    return {
      du: du - anneeDu + 1,
      au: au - anneeDu + 1,
      capDu: coupeDu === null ? 'arrondi' : 'droit',
      capAu: coupeAu === null ? 'arrondi' : 'droit',
      coupeDu, coupeAu, ...style,
    };
  };

  if (p.moment === 'INCONNU') {
    const c = fabrique(debutAbs, finAbs === Number.POSITIVE_INFINITY ? anneeAu : finAbs);
    return c ? [c] : [];
  }

  const out: CapsuleVue[] = [];
  const premier = Math.floor((bas - debutAbs) / p.periodicite);
  const dernier = Math.floor((haut - debutAbs) / p.periodicite);
  for (let k = premier; k <= dernier; k++) {
    const c = fabrique(debutAbs + k * p.periodicite, debutAbs + (k + 1) * p.periodicite - 1);
    if (c) out.push(c);
  }
  return out;
}

/** R6 — perles réellement dessinées. */
function perles(p: PosteEcheancier, echeance: boolean[]): PerleVue[] {
  const forme: PerleVue['forme'] = p.periodicite === 0 ? 'losange' : 'perle';
  return echeance
    .map((e, i) => (e ? { mois: i + 1, forme } as PerleVue : null))
    .filter((x): x is PerleVue => x !== null);
}

/** Point d'entrée unique : tout le dessin dérive de cette structure. */
export function vueEcheancier(
  p: PosteEcheancier, annee: number, groupe: Groupe = 3,
): EcheancierVue {
  const { impute, echeance } = imputations(p, annee);

  const mois: MoisVue[] = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return {
      mois: m,
      etat: etat(impute[i], estActif(p, annee, m)),
      repere: repere(p, annee, m),
      gras: groupe !== null && (m - 1) % groupe === 0,
      impute: impute[i],
      echeance: echeance[i],
    };
  });

  const d = ym(p.debut);
  const f = p.fin ? ym(p.fin) : null;
  const ponctuel = p.periodicite === 0;

  return {
    mois,
    capsules: cycles(p, annee),
    perles: perles(p, echeance),
    debutMois: !ponctuel && d.annee === annee ? d.mois : null,
    finMois: !ponctuel && f && f.annee === annee ? f.mois : null,
  };
}
