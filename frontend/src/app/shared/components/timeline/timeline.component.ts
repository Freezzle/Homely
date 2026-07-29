import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { TimelineModule } from 'primeng/timeline';

export interface TimelineItem {
  when: string;
  emoji: string;
  title: string;
  impact?: number;
  /** Nature du montant affiché : 'mensuel' (delta récurrent lissé, défaut) ou
   *  'echeance' (montant réel d'une échéance ponctuelle/périodique, pas un delta mensuel). */
  unite?: 'mensuel' | 'echeance';
  /** Clé de regroupement : les items consécutifs (déjà triés) partageant la même clé sont
   *  fusionnés en un seul point de la timeline. Par défaut, `when` est utilisé comme clé. */
  groupKey?: string | number;
}

export interface TimelineGroup {
  when: string;
  emoji: string;
  items: TimelineItem[];
}

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, TimelineModule],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss',
})
export class TimelineComponent {
  readonly items = input.required<TimelineItem[]>();
  readonly showMarkerIcon = input<boolean>(true);
  /** Devise utilisée pour l'affichage des montants (défaut CHF). */
  readonly devise = input<string>('CHF');
  /** Suffixe pour un impact mensualisé récurrent (ex. "/mois"). */
  readonly suffixeMensuel = input<string>('/mois');
  /** Suffixe pour le montant réel d'une échéance ponctuelle (ex. "/échéance"). */
  readonly suffixeEcheance = input<string>('');
  readonly select = output<TimelineItem>();

  protected readonly groups = computed<TimelineGroup[]>(() =>
    this.regrouperConsecutifs(this.items().filter((item) => this.aUnMontantValide(item.impact)))
  );

  protected impactLabel(item: TimelineItem): string | null {
    if (!this.aUnMontantValide(item.impact)) {
      return null;
    }
    const suffixe = item.unite === 'echeance' ? this.suffixeEcheance() : this.suffixeMensuel();
    return `${item.impact! > 0 ? '+' : '−'}${new Intl.NumberFormat('fr-CH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(item.impact!))} ${this.devise()}${suffixe}`;
  }

  private aUnMontantValide(impact?: number): boolean {
    return impact != null && impact !== 0 && !Number.isNaN(impact);
  }

  protected onSelect(group: TimelineGroup): void {
    this.select.emit(group.items[0]);
  }

  private regrouperConsecutifs(items: TimelineItem[]): TimelineGroup[] {
    const groupes: TimelineGroup[] = [];
    for (const item of items) {
      const cle = item.groupKey ?? item.when;
      const dernier = groupes[groupes.length - 1];
      const cleDernier = dernier ? dernier.items[0].groupKey ?? dernier.items[0].when : undefined;
      if (dernier && cleDernier === cle) {
        dernier.items.push(item);
      } else {
        groupes.push({ when: item.when, emoji: item.emoji, items: [item] });
      }
    }
    return groupes;
  }
}
