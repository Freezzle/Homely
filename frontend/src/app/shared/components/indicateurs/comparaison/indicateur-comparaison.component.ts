import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { BadgeDeltaComponent } from '../badge-delta/badge-delta.component';
import { TonIndicateur, couleurPleine } from '../tons';

/** Une grandeur comparée entre la période de référence (avant) et la période actuelle (après). */
export interface ElementComparaison {
  cle: string;
  libelle: string;
  valeurPrecedente: string;
  valeurActuelle: string;
  /** Variation en ratio (-0.167 → -16,7 %). `null` masque le badge (pas de référence). */
  delta: number | null;
  inverserDelta?: boolean;
  /** Pastille de couleur devant le libellé (mode tableau uniquement). */
  ton?: TonIndicateur;
}

/**
 * Comparaison « avant / après » d'une ou plusieurs grandeurs. Les valeurs sont fournies
 * déjà formatées par l'appelant.
 *
 * - 1 élément (via `elements` ou via les inputs unitaires) : deux valeurs côte à côte et
 *   badge de variation suivi de `libelleComparaison`.
 * - Plusieurs éléments : tableau « libellé | avant | après », une ligne par élément, le
 *   badge de variation collé à droite de la valeur « après ».
 */
@Component({
  selector: 'app-indicateur-comparaison',
  standalone: true,
  imports: [BadgeDeltaComponent],
  templateUrl: './indicateur-comparaison.component.html',
  styleUrl: './indicateur-comparaison.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurComparaisonComponent {
  private readonly i18n = inject(I18nService);

  /** Éléments comparés. Plus d'un élément → mode tableau. */
  readonly elements = input<ElementComparaison[]>([]);
  /** En-tête de la colonne des libellés (mode tableau). Défaut : « Libellé ». */
  readonly libelleColonne = input<string>('');
  /** En-tête de la période actuelle. Défaut : « Après ». */
  readonly libelleActuel = input<string>('');
  /** En-tête de la période de référence. Défaut : « Avant ». */
  readonly libellePrecedent = input<string>('');

  // Inputs unitaires (un seul élément), ignorées si `elements` est renseigné.
  readonly valeurActuelle = input<string>('');
  readonly valeurPrecedente = input<string>('');
  /** Variation en ratio (-0.167 → -16,7 %). `null` masque le badge (pas de référence). */
  readonly delta = input<number | null>(null);
  readonly inverserDelta = input<boolean>(false);

  /** Texte affiché après le badge (mode 1 élément). Défaut : « d'une période à l'autre ». */
  readonly libelleComparaison = input<string>('');
  readonly formateurDelta = input<((delta: number) => string) | null>(null);

  private readonly t = computed(() => this.i18n.translations().indicateurs);

  protected readonly lignes = computed<ElementComparaison[]>(() => {
    const elements = this.elements();
    if (elements.length) return elements;
    return [{
      cle: 'unique',
      libelle: '',
      valeurPrecedente: this.valeurPrecedente(),
      valeurActuelle: this.valeurActuelle(),
      delta: this.delta(),
      inverserDelta: this.inverserDelta(),
    }];
  });

  protected readonly modeTableau = computed(() => this.lignes().length > 1);

  protected readonly enteteLibelle = computed(() => this.libelleColonne() || this.t().colonneLibelle);
  protected readonly entetePrecedent = computed(() => this.libellePrecedent() || this.t().colonneAvant);
  protected readonly enteteActuel = computed(() => this.libelleActuel() || this.t().colonneApres);

  protected readonly texteComparaison = computed(
    () => this.libelleComparaison() || this.t().comparaisonPeriode,
  );

  protected couleurPastille(ton: TonIndicateur): string {
    return couleurPleine(ton);
  }
}