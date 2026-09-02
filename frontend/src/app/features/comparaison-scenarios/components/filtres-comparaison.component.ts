import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToolbarModule } from 'primeng/toolbar';
import { ScenarioDto } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { SelectComponent, SelectButtonComponent } from '../../../shared/components/form-fields';
import { Perimetre } from '../data/comparaison-scenarios.models';

export interface PerimetreOption {
  label: string;
  value: Perimetre;
}

/**
 * Panneau de filtres de l'écran « Comparaison de scénarios » (docs/features/
 * feature_5_bis §3).
 *
 * `<p-toolbar>` unique en haut de page, non sticky : à gauche 3 champs
 * (Scénario A / Scénario B / Année) avec petit libellé au-dessus, à droite un
 * `<p-selectbutton>` de périmètre. Purement présentation : l'état est détenu
 * par la page parente et flotte via `@Input()` / `@Output()`.
 */
@Component({
  selector: 'app-filtres-comparaison',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolbarModule, SelectComponent, SelectButtonComponent],
  templateUrl: './filtres-comparaison.component.html',
  styleUrl: './filtres-comparaison.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiltresComparaisonComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly scenarios = input.required<ScenarioDto[]>();
  readonly annees = input.required<number[]>();
  readonly perimetreOptions = input.required<PerimetreOption[]>();
  readonly scenarioA = input.required<ScenarioDto | null>();
  readonly scenarioB = input.required<ScenarioDto | null>();
  readonly annee = input.required<number | null>();
  readonly perimetre = input.required<Perimetre>();

  readonly scenarioAChange = output<ScenarioDto>();
  readonly scenarioBChange = output<ScenarioDto>();
  readonly anneeChange = output<number>();
  readonly perimetreChange = output<Perimetre>();

  protected libelleScenario(s: ScenarioDto): string {
    return s.estReference ? `${s.nom} (${this.t.comparaisonScenarios.filtres.reference})` : s.nom;
  }

  protected optionsScenarios(): Array<ScenarioDto & { libelle: string }> {
    return this.scenarios().map(s => ({ ...s, libelle: this.libelleScenario(s) }));
  }
}
