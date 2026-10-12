import { AppTranslations } from '../../../core/i18n/i18n.types';
import { MomentPeriode, TypeRepartition } from '../../../core/models/api.models';

/**
 * Instantané réactif du formulaire, passé aux composants d'étape (OnPush) pour
 * tout ce qui est **affiché** ou dérivé. Les champs éditables, eux, restent
 * pilotés par `formControlName` sur le `FormGroup` partagé.
 */
export interface PosteFormValeurs {
  readonly description?: string | null;
  readonly categorieId?: string | null;
  readonly montant?: number | null;
  readonly devise?: string | null;
  readonly periodiciteMois?: number | null;
  readonly mode?: string | null;
  readonly moment?: MomentPeriode | null;
  readonly nature?: string | null;
  readonly estimPourcentage?: number | null;
  readonly importance?: number | null;
  readonly potentielOptimisation?: number | null;
  readonly deriveExterne?: number | null;
  readonly typeRepartition?: TypeRepartition | null;
  readonly debut?: Date | null;
  readonly fin?: Date | null;
  readonly inclureProrataTheorique?: boolean | null;
}


/**
 * Clés des étapes du parcours de création/édition d'un poste. La navigation se
 * fait **par clé** et jamais par index : l'étape `paiement` apparaît ou
 * disparaît selon la périodicité, donc les index ne sont pas stables.
 */
export type EtapeCle = 'quoi' | 'combien' | 'validite' | 'paiement' | 'repartition' | 'analyse';

const ORDRE: readonly EtapeCle[] = ['quoi', 'combien', 'validite', 'paiement', 'repartition', 'analyse'];

/** Toutes les clés, dans l'ordre d'affichage (y compris `paiement`). */
export const TOUTES_ETAPES = ORDRE;

/** Étapes réellement affichées : `paiement` n'a de sens qu'au-delà du mensuel. */
export function etapesVisibles(periodiciteMois: number): EtapeCle[] {
  return ORDRE.filter(e => e !== 'paiement' || periodiciteMois > 1);
}

// ── Formatage de dates (aucun tableau de mois en dur : tout passe par Intl) ──

/** « nov. 2026 » — mois abrégé + année. */
export function moisAnnee(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(d);
}

/** « nov. » — mois abrégé seul. */
export function moisCourt(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
}

/** « 1 nov. 2026 » — date courte lisible. */
export function dateLisible(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/** Premier jour du mois de `d`, décalé de `decalageMois`. */
export function premierDuMois(d: Date, decalageMois = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + decalageMois, 1);
}

/** Même jour un an plus tard, moins un jour : une validité « pendant 1 an ». */
export function finApresUnAn(debut: Date): Date {
  return new Date(debut.getFullYear() + 1, debut.getMonth(), debut.getDate() - 1);
}

/** 1er janvier de l'année de `d`, décalé de `decalageAnnees`. */
export function debutDAnnee(d: Date, decalageAnnees = 0): Date {
  return new Date(d.getFullYear() + decalageAnnees, 0, 1);
}

/** Dernier jour du mois de `d`. */
export function finDuMois(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** 31 décembre de l'année de `d`. */
export function finDeLAnnee(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31);
}

/**
 * Dernier jour du cycle de périodicité **en cours** à la date `reference`.
 * Les cycles sont ancrés sur la date de début du poste ; si la référence est
 * antérieure au début, c'est le premier cycle qui est retenu.
 */
export function finDuCycleEnCours(debut: Date, periodiciteMois: number, reference: Date): Date | null {
  if (periodiciteMois <= 0) return null;
  const moisDebut = debut.getFullYear() * 12 + debut.getMonth();
  const moisReference = reference.getFullYear() * 12 + reference.getMonth();
  const cycle = Math.max(Math.floor((moisReference - moisDebut) / periodiciteMois), 0);
  const moisFin = moisDebut + (cycle + 1) * periodiciteMois;
  // Jour 0 du mois suivant = dernier jour du mois précédent.
  return new Date(Math.floor(moisFin / 12), moisFin % 12, 0);
}

/** Vrai si les deux dates tombent sur le même jour calendaire. */
export function memeJour(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ── Résumés affichés dans la fiche ────────────────────────────────────────

/** « une fois », « chaque mois », « chaque année », « tous les N mois ». */
export function rythmeLibelle(t: AppTranslations, periodiciteMois: number): string {
  const r = t.poste.form.rythme;
  if (periodiciteMois === 0) return r[0];
  if (periodiciteMois === 1) return r[1];
  if (periodiciteMois === 12) return r[12];
  return r.n.replace('{{n}}', String(periodiciteMois));
}

/** « 1 850,00 CHF chaque mois · ± 10 % » — `montantFormate` est déjà passé au pipe. */
export function resumeMontant(
  t: AppTranslations,
  montantFormate: string,
  periodiciteMois: number,
  estimPourcentage: number | null,
): string {
  const base = `${montantFormate} ${rythmeLibelle(t, periodiciteMois)}`;
  return estimPourcentage == null ? base : `${base} · ± ${estimPourcentage} %`;
}

/** « Dès le …, sans fin » · « Dès le …, jusqu'au … » · ponctuel : « Le … ». */
export function resumeValidite(
  t: AppTranslations,
  debut: Date | null,
  fin: Date | null,
  periodiciteMois: number,
  locale: string,
): string | null {
  if (!debut) return null;
  const r = t.poste.form.resumeValidite;
  if (periodiciteMois === 0) return r.ponctuel.replace('{{date}}', dateLisible(debut, locale));
  if (!fin) return r.debutSansFin.replace('{{debut}}', dateLisible(debut, locale));
  return r.debutFin
    .replace('{{debut}}', dateLisible(debut, locale))
    .replace('{{fin}}', dateLisible(fin, locale));
}

/**
 * Mois de l'échéance d'un cycle : début de période = mois du début ;
 * fin de période = mois du début + périodicité − 1.
 */
export function moisEcheance(debut: Date, periodiciteMois: number, moment: string): Date {
  const decalage = moment === 'FIN_PERIODE' ? Math.max(periodiciteMois - 1, 0) : 0;
  return new Date(debut.getFullYear(), debut.getMonth() + decalage, 1);
}

/** « Prélevé en déc. · lissé chaque mois » / « … · compté ce mois-là » / « Date inconnue · … ». */
export function resumePaiement(
  t: AppTranslations,
  verbe: string,
  debut: Date | null,
  periodiciteMois: number,
  moment: string,
  mode: string,
  locale: string,
): string | null {
  const r = t.poste.form.resumePaiement;
  if (moment === 'INCONNU') return r.inconnu;
  if (!debut) return null;
  const mois = moisCourt(moisEcheance(debut, periodiciteMois, moment), locale);
  const gabarit = mode === 'PERIODIQUE' ? r.periodique : r.lisse;
  return gabarit.replace('{{verbe}}', verbe).replace('{{mois}}', mois);
}

/** « Importance 3 · Optimisation 3 · Dérive 3 ». */
export function resumeAnalyse(
  t: AppTranslations,
  importance: number,
  optimisation: number,
  derive: number,
): string {
  return t.poste.form.resumeAnalyse
    .replace('{{importance}}', String(importance))
    .replace('{{optimisation}}', String(optimisation))
    .replace('{{derive}}', String(derive));
}
