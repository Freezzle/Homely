import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Signal, input } from '@angular/core';
import { CompteDto, MembreDto, VirementCompteDto } from '../../../../core/models/api.models';
import { TableVirementsComptesComponent } from '../../shared/components/table-virements-comptes/table-virements-comptes.component';

/**
 * Payload transmis via `IndicatorDrawerService.open({ data })` — références de signaux pour
 * rester réactif (changement de mois).
 */
export interface VirementsComptesDrawerData {
  virements: Signal<VirementCompteDto[]>;
  comptes: Signal<readonly CompteDto[]>;
  membres: Signal<readonly MembreDto[]>;
  virementsFaits: Signal<ReadonlySet<string>>;
  membreActuelId: Signal<string | null>;
  devise: Signal<string>;
  chargement: Signal<boolean>;
  onBascule: (cle: string) => void;
}

/**
 * Contenu du drawer pour l'indicateur "Virements des comptes" : enveloppe fine autour de
 * `<app-table-virements-comptes>` (table à sous-en-têtes groupée par compte source).
 */
@Component({
  selector: 'app-virements-comptes-drawer-content',
  standalone: true,
  imports: [CommonModule, TableVirementsComptesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './virements-comptes-drawer-content.component.html',
})
export class VirementsComptesDrawerContentComponent {
  readonly data = input<VirementsComptesDrawerData>();
}
