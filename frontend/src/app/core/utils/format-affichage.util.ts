import { localeDeLangue } from '../i18n/locale.util';

/**
 * Formatte une période mensuelle (`"2027-01"` ou date ISO complète) en libellé court
 * localisé, ex. « janv. 2027 ». Utilisé notamment par les dialogs de gestion des postes
 * (révision, clôture, historique) qui partagent ce format d'affichage.
 */
export function formatPeriodeMois(v: string | null | undefined, locale: string): string {
  if (!v) return '...';
  try {
    const [year, month] = v.split('-');
    const d = new Date(+year, +month - 1, 1);
    return new Intl.DateTimeFormat(locale, { month: 'numeric', year: 'numeric' }).format(d);
  } catch { return v; }
}

/**
 * Formatte une date ISO (`"2025-01-15"` ou `"2025-01"`) en mois/année `mm.yyyy`
 * (ex. « 01.2025 »). Volontairement **indépendant de la locale** (contrairement à
 * `formatPeriodeMois`, dont le séparateur et l'ordre varient) : la liste des postes a
 * besoin d'un format court, stable et alignable en colonne.
 */
export function formatMoisAnnee(iso: string | null | undefined): string {
  if (!iso) return '';
  const [annee, mois] = iso.split('-');
  if (!annee || !mois) return iso;
  return `${mois.padStart(2, '0')}.${annee}`;
}

/**
 * Formatte un montant simple (sans style « devise » Intl, juste le nombre + code devise
 * en suffixe), ex. « 1'950 CHF ». Distinct du pipe `montant` (qui utilise `style: currency`)
 * — ce format plus compact est utilisé dans les résumés/écarts des dialogs de poste.
 */
export function formaterMontantSimple(montant: number, locale: string, devise?: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(montant)
    + (devise ? ` ${devise}` : '');
}

/** Locale actif dérivé de la langue de l'app, pour les fonctions de formatage ci-dessus. */
export function localeCouranteDeLangue(langue: string | null | undefined): string {
  return localeDeLangue(langue);
}
