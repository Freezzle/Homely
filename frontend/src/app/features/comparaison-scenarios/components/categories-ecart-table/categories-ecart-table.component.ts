import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { TypePoste } from '../../../../core/models/api.models';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TagComponent, TagSeverity } from '../../../../shared/components/tag/tag.component';
import { SelectButtonComponent, CheckboxComponent } from '../../../../shared/components/form-fields';
import { CategorieEcartRow } from '../../data/comparaison-scenarios.models';
import { estNul, formatMontantSigne, signeEcart } from '../../data/format-montant.util';

type FiltreType = 'TOUS' | TypePoste;
type TriColonne = 'libelle' | 'effet';
type TriDirection = 1 | -1;

const SEVERITE_PAR_TYPE: Record<TypePoste, TagSeverity> = {
  REVENU: 'success',
  CHARGE: 'danger',
  RESERVE: 'info',
};

/**
 * Tableau « Totaux par catégorie » (docs/features/feature_5_bis §6).
 *
 * Colonnes strictement dans l'ordre : Catégorie / Type (`p-tag`) / Écart /
 * Poids de l'écart (**barre divergente depuis le centre**, jamais > 50 % de
 * chaque côté). Tri par défaut par `|effet|` décroissant, où
 * `effet = impact × delta` (le sens favorable est pris en compte). La barre
 * divergente est mise à l'échelle **par lignes affichées** (pas par toutes les
 * catégories du foyer).
 */
@Component({
  selector: 'app-categories-ecart-table',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, TagComponent, SelectButtonComponent, CheckboxComponent],
  templateUrl: './categories-ecart-table.component.html',
  styleUrl: './categories-ecart-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesEcartTableComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();

  readonly rows = input.required<CategorieEcartRow[]>();
  readonly devise = input<string>('CHF');

  protected readonly filtreType = signal<FiltreType>('TOUS');
  protected readonly ecartsUniquement = signal(true);
  protected readonly triColonne = signal<TriColonne>('effet');
  protected readonly triDirection = signal<TriDirection>(-1); // desc par défaut

  protected readonly typeOptions = computed(() => [
    { label: this.t.commun.tous, value: 'TOUS' as FiltreType },
    { label: this.t.referentiels.categorie.typeOptions.REVENU, value: 'REVENU' as FiltreType },
    { label: this.t.referentiels.categorie.typeOptions.CHARGE, value: 'CHARGE' as FiltreType },
    { label: this.t.referentiels.categorie.typeOptions.RESERVE, value: 'RESERVE' as FiltreType },
  ]);

  protected readonly rowsFiltrees = computed(() => {
    const type = this.filtreType();
    const ecartsUniquement = this.ecartsUniquement();
    let rows = this.rows();
    if (type !== 'TOUS') rows = rows.filter(r => r.type === type);
    if (ecartsUniquement) rows = rows.filter(r => !estNul(r.ecart));
    return rows;
  });

  /** Amplitude max des effets sur les lignes **affichées** — se recalcule à
   *  chaque changement de filtre (feature_5_bis §6). */
  protected readonly effetMax = computed(() =>
    Math.max(1, ...this.rowsFiltrees().map(r => Math.abs(r.effet))));

  protected readonly rowsTriees = computed(() => {
    const colonne = this.triColonne();
    const direction = this.triDirection();
    const rows = [...this.rowsFiltrees()];
    if (colonne === 'libelle') {
      return rows.sort((a, b) => direction * a.libelle.localeCompare(b.libelle));
    }
    return rows.sort((a, b) => direction * (Math.abs(a.effet) - Math.abs(b.effet)));
  });

  /** Largeur de la partie colorée de la barre divergente, en % du conteneur
   *  (jamais > 50 % — car ancrée au centre à 50 %). */
  protected largeur(row: CategorieEcartRow): number {
    return (Math.abs(row.effet) / this.effetMax()) * 50;
  }

  protected trierPar(colonne: TriColonne): void {
    if (this.triColonne() === colonne) {
      this.triDirection.set(this.triDirection() === 1 ? -1 : 1);
    } else {
      this.triColonne.set(colonne);
      // Défaut : libellé asc, effet desc (feature_5_bis §6).
      this.triDirection.set(colonne === 'libelle' ? 1 : -1);
    }
  }

  protected severite(type: TypePoste): TagSeverity {
    return SEVERITE_PAR_TYPE[type];
  }

  protected typeLabel(type: TypePoste): string {
    return this.t.referentiels.categorie.typeOptions[type];
  }

  protected ecartFormate(ecart: number): string {
    return formatMontantSigne(ecart, this.i18n.currentLang());
  }

  protected signe(ecart: number): 'positif' | 'negatif' | 'nul' {
    return signeEcart(ecart);
  }
}

