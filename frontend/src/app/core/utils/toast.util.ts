import { MessageService } from 'primeng/api';

/**
 * Mutualise les toasts succès/erreur répétés à l'identique dans une dizaine de composants
 * (référentiels, scénarios, postes, accès...) : `severity: 'success'` avec un
 * simple résumé, et `severity: 'error'` avec le message métier renvoyé par l'API
 * (`err.error.message`, format `ApiError` — doc 04 §2) en détail.
 */

/** Affiche un toast de succès (ex. après création/modification/suppression réussie). */
export function notifierSucces(toast: MessageService, resume: string): void {
  toast.add({ severity: 'success', summary: resume });
}

/**
 * Affiche un toast d'erreur, en reprenant le message métier de l'`ApiError` si présent
 * (`err?.error?.message`). `vieMs` permet de reprendre le `life` explicite utilisé par
 * certains écrans (ex. 5000ms sur des erreurs plus rares à laisser plus longtemps affichées).
 */
export function notifierErreur(toast: MessageService, resume: string, err?: unknown, vieMs?: number): void {
  const detail = (err as { error?: { message?: string } } | null | undefined)?.error?.message;
  toast.add({ severity: 'error', summary: resume, detail, life: vieMs });
}
