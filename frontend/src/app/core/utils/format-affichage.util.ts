import { localeDeLangue } from '../i18n/locale.util';

/**
 * Formatte une période mensuelle (`"2027-01"` ou date ISO complète) en libellé court
 * localisé, ex. « janv. 2027 ». Utilisé notamment par les dialogs de gestion des postes
 * (révision, clôture, historique) qui partagent ce format d'affichage.
 */
export function formatPeriodeMois(v: string | null | undefined, locale: string): string {
  if (!v) return '–';
  try {
    const [year, month] = v.split('-');
    const d = new Date(+year, +month - 1, 1);
    return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(d);
  } catch { return v; }
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
export function localeCouranteDeLangue(langue: string): string {
  return localeDeLangue(langue);
}
