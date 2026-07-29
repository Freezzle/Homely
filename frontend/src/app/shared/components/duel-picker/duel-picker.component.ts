import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ScenarioDto } from '../../../core/models/api.models';
import { SelectModule } from 'primeng/select';

type ScenarioAvecCouleur = ScenarioDto & { couleur?: string };

@Component({
  selector: 'app-duel-picker',
  standalone: true,
  imports: [CommonModule, SelectModule, FormsModule],
  templateUrl: './duel-picker.component.html',
  styleUrl: './duel-picker.component.scss',
})
export class DuelPickerComponent {
  readonly left = input.required<ScenarioDto>();
  readonly rightOptions = input.required<ScenarioDto[]>();
  readonly right = input.required<ScenarioDto>();
  readonly rightChange = output<ScenarioDto>();

  protected couleurScenario(scenario: ScenarioDto | null | undefined): string {
    return (scenario as ScenarioAvecCouleur | null | undefined)?.couleur ?? 'var(--p-primary-color)';
  }
}
