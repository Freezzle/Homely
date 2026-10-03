import { Injectable, Pipe, PipeTransform, inject } from '@angular/core';
import { ContexteService } from '../services/contexte.service';
import { TranslateService } from '@ngx-translate/core';
import { localeDeLangue } from '../i18n/locale.util';

/**
 * T9.2 — Pipe formatage montant : utilise Intl.NumberFormat + deviseBase du foyer.
 * Usage : {{ valeur | montant }} ou {{ valeur | montant:'EUR' }}
 */
@Pipe({ name: 'montant', standalone: true, pure: false })
@Injectable({ providedIn: 'root' })
export class MontantPipe implements PipeTransform {
  private contexte = inject(ContexteService);
  private translate = inject(TranslateService);

  transform(value: number | null | undefined, devise?: string): string {
    if (value == null) return '–';
    const currency = devise ?? this.contexte.deviseBase();
    return new Intl.NumberFormat(localeDeLangue(this.translate.currentLang()), {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}

/**
 * Pipe formatage pourcentage.
 * Usage : {{ 0.58 | pct }} → 58 %
 */
@Pipe({ name: 'pct', standalone: true })
export class PctPipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(value: number | null | undefined, decimals = 0): string {
    if (value == null) return '–';
    return new Intl.NumberFormat(localeDeLangue(this.translate.currentLang()), {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
}

/**
 * Pipe traduction de la périodicité en mois → libellé français.
 * Usage : {{ p.periodiciteMois | periodicite }}
 * Résultat : Aucune (0), Mensuel (1), Bimestriel (2), Trimestriel (3), Semestriel (6), Annuel (12), Tous les N mois…
 */
@Pipe({ name: 'periodicite', standalone: true, pure: true })
export class PeriodicitePipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(mois: number | null | undefined): string {
    if (mois == null) return '–';
    const labels: string[] = this.translate.instant('poste.periodiciteLabels');
    if (mois === 0 && labels[0]) return labels[0];  // "Aucune" pour one-shot
    if (mois >= 1 && mois <= 12) return labels[mois];  // Index décalé car [0]="Aucune"
    return `Tous les ${mois} mois`;
  }
}

