import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

/**
 * Dialog de confirmation de suppression réutilisable, pour les cas où une simple
 * confirmation via `ConfirmationService`/`p-confirmdialog` ne suffit pas (ex. écran
 * catégories, qui propose une migration optionnelle des postes liés avant
 * suppression). Le contenu additionnel est projeté via `<ng-content>`, ce qui évite
 * de recréer un système de confirmation parallèle à `ConfirmationService` pour
 * chaque cas particulier.
 */
@Component({
  selector: 'app-dialog-suppression',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: './dialog-suppression.component.html',
})
export class DialogSuppressionComponent {
  readonly visible = input<boolean>(false);
  readonly titre = input<string>('');
  readonly libelleAnnuler = input<string>('');
  readonly libelleSupprimer = input<string>('');
  /** Affiche le spinner et désactive le bouton de confirmation pendant la suppression. */
  readonly enCours = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly confirmer = output<void>();

  fermer(): void {
    this.visibleChange.emit(false);
  }
}
