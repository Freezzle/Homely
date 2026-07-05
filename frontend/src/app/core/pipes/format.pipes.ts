import { Pipe, PipeTransform, inject } from '@angular/core';
import { ContexteService } from '../services/contexte.service';
import { FR } from '../i18n/fr';

/**
 * T9.2 — Pipe formatage montant : utilise Intl.NumberFormat + deviseBase du foyer.
 * Usage : {{ valeur | montant }} ou {{ valeur | montant:'EUR' }}
 */
@Pipe({ name: 'montant', standalone: true, pure: false })
export class MontantPipe implements PipeTransform {
  private contexte = inject(ContexteService);

  transform(value: number | null | undefined, devise?: string): string {
    if (value == null) return '–';
    const currency = devise ?? this.contexte.deviseBase();
    return new Intl.NumberFormat('fr-CH', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}

/**
 * Pipe formatage date locale FR.
 * Usage : {{ dateIso | dateFr }} ou {{ dateIso | dateFr:'month' }}
 */
@Pipe({ name: 'dateFr', standalone: true })
export class DateFrPipe implements PipeTransform {
  transform(value: string | null | undefined, format: 'date' | 'month' | 'year' = 'date'): string {
    if (!value) return '–';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '–';
    if (format === 'month') return new Intl.DateTimeFormat('fr-CH', { month: 'long', year: 'numeric' }).format(d);
    if (format === 'year') return String(d.getFullYear());
    return new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  }
}

/**
 * Pipe formatage pourcentage.
 * Usage : {{ 0.58 | pct }} → 58 %
 */
@Pipe({ name: 'pct', standalone: true })
export class PctPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = 0): string {
    if (value == null) return '–';
    return new Intl.NumberFormat('fr-CH', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
}

/**
 * Pipe traduction de la périodicité en mois → libellé français.
 * Usage : {{ p.periodiciteMois | periodicite }}
 * Résultat : Mensuel, Trimestriel, Semestriel, Annuel, Tous les N mois…
 */
@Pipe({ name: 'periodicite', standalone: true, pure: true })
export class PeriodicitePipe implements PipeTransform {
  transform(mois: number | null | undefined): string {
    if (mois == null || mois < 1) return '–';
    const labels = FR.poste.periodiciteLabels;
    if (mois >= 1 && mois <= 12) return labels[mois - 1];
    return `Tous les ${mois} mois`;
  }
}

