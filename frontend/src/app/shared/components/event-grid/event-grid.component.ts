import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { TimelineItem } from '../timeline/timeline.component';

interface EventGridGroup {
  when: string;
  items: TimelineItem[];
}

@Component({
  selector: 'app-event-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './event-grid.component.html',
  styleUrl: './event-grid.component.scss',
})
export class EventGridComponent {
  readonly items = input.required<TimelineItem[]>();
  readonly devise = input<string>('CHF');
  /** `'grouped'` (défaut) : sections par date (`when`), comme dans l'onglet d'origine.
   *  `'flat'` : liste simple à une colonne, sans en-tête ni compteur — utilisé quand tous
   *  les items partagent le même `when` (ex. drawer "Événements" en vue mensuelle), pour
   *  éviter une en-tête de section redondante. */
  readonly layout = input<'grouped' | 'flat'>('grouped');
  readonly select = output<TimelineItem>();

  protected readonly groups = computed<EventGridGroup[]>(() =>
    this.regrouperConsecutifs(this.items().filter((item) => this.estAffichable(item)))
  );

  /** Items affichables à plat (mode `'flat'`), triés tels que reçus (déjà ordonnés par
   *  l'appelant), sans regroupement par date. */
  protected readonly itemsAPlat = computed<TimelineItem[]>(() =>
    this.items().filter((item) => this.estAffichable(item))
  );

  protected impactLabel(item: TimelineItem): string | null {
    if (!this.aUnMontantValide(item.impact)) {
      return null;
    }
    return `${item.impact! > 0 ? '+' : '−'}${new Intl.NumberFormat('fr-CH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(item.impact!))} ${this.devise()}${item.suffixe ?? ''}`;
  }

  protected onSelect(item: TimelineItem): void {
    this.select.emit(item);
  }

  private aUnMontantValide(impact?: number): boolean {
    return impact != null && impact !== 0 && !Number.isNaN(impact);
  }

  private estAffichable(item: TimelineItem): boolean {
    return this.aUnMontantValide(item.impact) || !!item.montantApresLabel;
  }

  private regrouperConsecutifs(items: TimelineItem[]): EventGridGroup[] {
    const groupes: EventGridGroup[] = [];
    for (const item of items) {
      const cle = item.groupKey ?? item.when;
      const dernier = groupes[groupes.length - 1];
      const cleDernier = dernier ? dernier.items[0].groupKey ?? dernier.items[0].when : undefined;
      if (dernier && cleDernier === cle) {
        dernier.items.push(item);
      } else {
        groupes.push({ when: item.when, items: [item] });
      }
    }
    return groupes;
  }
}
