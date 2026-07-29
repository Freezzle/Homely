import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { AppTranslations } from '../../../core/i18n/i18n.types';

/**
 * Dialog (purement présentationnel) d'aperçu des contributions mensuelles d'un
 * poste sur une année. Extrait de `postes-liste.component.ts` pour en réduire la
 * taille : toute la logique de récupération des données (`PosteService.apercu`)
 * reste dans le composant parent, qui garde la responsabilité métier — ce composant
 * ne fait qu'afficher les données déjà chargées.
 */
@Component({
  selector: 'app-poste-apercu-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, TableModule, MontantPipe],
  templateUrl: './poste-apercu-dialog.component.html',
})
export class PosteApercuDialogComponent {
  readonly t = input.required<AppTranslations>();
  readonly visible = input<boolean>(false);
  readonly data = input<{ annee: number; contributions: { mois: number; contribution: number }[] } | null>(null);

  readonly visibleChange = output<boolean>();
}
