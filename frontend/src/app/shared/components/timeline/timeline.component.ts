import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { TimelineModule } from 'primeng/timeline';

export interface TimelineItem {
  when: string;
  /** Classe d'icône PrimeNG sans le préfixe `pi-` (ex. `calendar-plus`). */
  icon?: string;
  /** Variante de couleur de l'icône : succès (vert), danger (rouge), secondaire (gris). */
  iconVariant?: 'success' | 'danger' | 'secondary';
  title: string;
  impact?: number;
  /** Le changement est-il favorable pour le foyer (gain) ? Pilote la couleur du montant
   *  indépendamment du signe mathématique affiché (ex. une charge qui augmente est
   *  défavorable même si le montant affiché est positif). */
  favorable?: boolean;
  /** Suffixe de périodicité affiché après le montant (ex. `/mois`, `/3mois`, `/ponctuel`). */
  suffixe?: string;
  /** Texte secondaire discret (ex. montant plein + périodicité réelle pour un poste
   *  mensualisé périodique — « 300 CHF tous les 3 mois »). */
  montantSecondaire?: string;
  /** Pour une REVISION : montant "avant" déjà formaté (ex. "1000/mois"), affiché en texte
   *  neutre. Quand défini (avec `montantApresLabel`), remplace l'affichage `impact`/`suffixe`. */
  montantAvantLabel?: string;
  /** Pour une REVISION : montant "après" déjà formaté (ex. "1200/mois"), coloré selon
   *  `favorable`. */
  montantApresLabel?: string;
  /** Clé de regroupement : les items consécutifs (déjà triés) partageant la même clé sont
   *  fusionnés en un seul point de la timeline. Par défaut, `when` est utilisé comme clé. */
  groupKey?: string | number;
}

export interface TimelineGroup {
  when: string;
  icon?: string;
  iconVariant?: 'success' | 'danger' | 'secondary';
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
  readonly select = output<TimelineItem>();

  protected readonly groups = computed<TimelineGroup[]>(() =>
    this.regrouperConsecutifs(this.items().filter((item) => this.estAffichable(item)))
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

  private aUnMontantValide(impact?: number): boolean {
    return impact != null && impact !== 0 && !Number.isNaN(impact);
  }

  private estAffichable(item: TimelineItem): boolean {
    return this.aUnMontantValide(item.impact) || !!item.montantApresLabel;
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
        groupes.push({ when: item.when, icon: item.icon, iconVariant: item.iconVariant, items: [item] });
      }
    }
    return groupes;
  }
}
