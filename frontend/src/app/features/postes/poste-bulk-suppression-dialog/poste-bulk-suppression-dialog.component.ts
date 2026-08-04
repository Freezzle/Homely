import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { notifierSucces, notifierErreur } from '../../../core/utils/toast.util';

/** Dialog de confirmation pour la suppression groupée de postes, avec le nombre concerné. */
@Component({
  selector: 'app-poste-bulk-suppression-dialog',
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: './poste-bulk-suppression-dialog.component.html',
})
export class PosteBulkSuppressionDialogComponent {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  private readonly contexte = inject(ContexteService);
  private readonly posteSvc = inject(PosteService);
  private readonly toast = inject(MessageService);

  readonly visible = input<boolean>(false);
  readonly posteIds = input<string[]>([]);

  readonly visibleChange = output<boolean>();
  /** Émis après suppression réussie : le parent recharge la liste et vide la sélection. */
  readonly enregistre = output<void>();

  enregistrementEnCours = false;

  titre(): string {
    return this.i18n.instant('poste.bulk.titreSuppression', { n: this.posteIds().length });
  }

  message(): string {
    return this.i18n.instant('poste.bulk.confirmationSuppression', { n: this.posteIds().length });
  }

  fermer(): void {
    this.visibleChange.emit(false);
  }

  confirmer(): void {
    const ids = this.posteIds();
    if (ids.length === 0) return;

    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;

    this.enregistrementEnCours = true;
    this.posteSvc.supprimerGroupe(foyerId, scenarioId, { ids }).subscribe({
      next: () => {
        this.enregistrementEnCours = false;
        notifierSucces(this.toast, this.i18n.instant('poste.bulk.succesSuppression', { n: ids.length }));
        this.visibleChange.emit(false);
        this.enregistre.emit();
      },
      error: (err) => {
        this.enregistrementEnCours = false;
        notifierErreur(this.toast, this.t.commun.erreur, err);
      },
    });
  }
}
