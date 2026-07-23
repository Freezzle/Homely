/**
 * Utilitaires de conversion date ⇄ chaîne ISO "YYYY-MM-DD" basés sur les composants
 * **locaux** (année/mois/jour) plutôt que sur `toISOString()`/`new Date(string)`, qui
 * convertissent via UTC et décalent la date d'un jour selon le fuseau (ex. minuit local
 * en Suisse l'été devient la veille 22:00 UTC).
 *
 * À utiliser pour toute conversion entre un p-datepicker (Date à minuit local) et un
 * champ API de type date pure (LocalDate côté backend, sans heure).
 */

/** Formate une Date locale en "YYYY-MM-DD" sans passer par UTC (pas de décalage de jour). */
export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse une chaîne "YYYY-MM-DD" en Date locale à minuit (évite l'interprétation UTC de `new Date(string)`). */
export function parseIsoDateLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
