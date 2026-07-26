import { Langue } from './i18n.service';

/** Mappe la langue applicative (fr/en) vers une locale ICU de formatage. */
export function localeDeLangue(langue: Langue | string | null | undefined): string {
  return langue === 'en' ? 'en-GB' : 'fr-CH';
}
