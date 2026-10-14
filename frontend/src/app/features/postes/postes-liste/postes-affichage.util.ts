import { PosteDto } from '../../../core/models/api.models';
import { formatMoisAnnee } from '../../../core/utils/format-affichage.util';
import { PosteEcheancier } from '../../../shared/components/echeancier-annuel/echeancier.model';

/** Fonction de traduction instantanée (`I18nService.instant`), injectée par l'appelant. */
export type TraduireFn = (cle: string, params?: Record<string, unknown>) => string;

/** Un poste ponctuel (one-shot) est imputé au seul mois de son début. */
export function estPonctuel(p: PosteDto): boolean {
  return p.periodiciteMois === 0;
}

/**
 * Montant « par mois » affiché sur la carte : le champ dérivé `montantMensualise`
 * calculé par le moteur (`montant / periodiciteMois`, et `montant` complet pour un
 * ponctuel). On ne le recalcule pas côté front pour rester aligné au centime sur le
 * moteur (docs/01 §3.6).
 */
export function montantParMois(p: PosteDto): number {
  return p.montantMensualise;
}

/**
 * Le montant par mois d'un poste non mensuel est une **moyenne** : on le préfixe
 * alors de « ≈ » pour ne pas laisser croire à une échéance réelle.
 */
export function estMontantApproche(p: PosteDto): boolean {
  return p.periodiciteMois > 1;
}

/**
 * Fenêtre de validité condensée, en `mm.yyyy` : « Depuis le 01.2025 » ou
 * « Du 04.2024 au 03.2027 ». Les ponctuels n'ont pas de fin et suivent la 1re forme.
 */
export function texteDates(p: PosteDto, traduire: TraduireFn): string {
  const debut = formatMoisAnnee(p.debut);
  if (!debut) return '';
  const fin = formatMoisAnnee(p.fin);
  return fin
    ? traduire('poste.liste.duAu', { debut, fin })
    : traduire('poste.liste.depuisLe', { debut });
}

/** Sous-total d'un groupe : récurrents mensualisés d'un côté, ponctuels de l'autre. */
export function sousTotalGroupe(postes: PosteDto[]): { recurrent: number; ponctuel: number } {
  let recurrent = 0;
  let ponctuel = 0;
  for (const p of postes) {
    if (estPonctuel(p)) ponctuel += montantParMois(p);
    else recurrent += montantParMois(p);
  }
  return { recurrent, ponctuel };
}

/**
 * Part d'un groupe dans le total affiché (0–1), bornée et protégée de la division par
 * zéro — sert à remplir la barre de proportion de l'en-tête de groupe.
 */
export function partDuTotal(sousTotal: number, total: number): number {
  if (!total) return 0;
  return Math.min(1, Math.max(0, sousTotal / total));
}

/**
 * Réduit un poste au seul rythme attendu par `app-poste-apercu-periodicite` (quand,
 * jamais combien). `null` sans date de début : il n'y a alors aucun repère temporel à
 * dessiner.
 */
export function echeancierDepuisPoste(p: PosteDto): PosteEcheancier | null {
  if (!p.debut) return null;
  return {
    periodicite: p.periodiciteMois,
    mode: p.mode === 'PERIODIQUE' ? 'PERIODIQUE' : 'MENSUALISE',
    moment: p.moment,
    debut: p.debut,
    fin: p.fin ?? null,
  };
}
