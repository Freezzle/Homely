import { Component, inject, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { SliderModule } from 'primeng/slider';
import { MessageService } from 'primeng/api';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { CategorieDto, ChampGroupable } from '../../../core/models/api.models';
import { notifierSucces, notifierErreur } from '../../../core/utils/toast.util';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { SelectComponent } from '../../../shared/components/form-fields';

/**
 * Dialog polymorphe de mise à jour groupée sur un unique champ descriptif
 * (catégorie / importance / potentiel d'optimisation). Un seul champ est modifiable
 * par ouverture de dialog — jamais de combinaison de plusieurs champs en un appel
 * (contrainte UX : une seule action à la fois sur une sélection multiple).
 */
@Component({
  selector: 'app-poste-bulk-champ-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonComponent, SelectComponent, SliderModule],
  templateUrl: './poste-bulk-champ-dialog.component.html',
})
export class PosteBulkChampDialogComponent {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  private readonly contexte = inject(ContexteService);
  private readonly posteSvc = inject(PosteService);
  private readonly toast = inject(MessageService);

  /** Champ ciblé par cette ouverture de dialog. */
  readonly champ = input.required<ChampGroupable>();
  readonly visible = input<boolean>(false);
  readonly posteIds = input<string[]>([]);
  readonly categories = input<CategorieDto[]>([]);

  readonly visibleChange = output<boolean>();
  /** Émis après une mise à jour réussie : le parent recharge la liste et garde la sélection active. */
  readonly enregistre = output<void>();

  enregistrementEnCours = false;
  valeurCategorieId: string | null = null;
  valeurImportance = 3;
  valeurPotentiel = 3;

  /** Réinitialise les valeurs par défaut à chaque ouverture. */
  private readonly _resetSurOuverture = effect(() => {
    if (this.visible()) {
      this.valeurCategorieId = null;
      this.valeurImportance = 3;
      this.valeurPotentiel = 3;
    }
  });

  titre(): string {
    const n = this.posteIds().length;
    switch (this.champ()) {
      case 'CATEGORIE': return this.i18n.instant('poste.bulk.titreCategorie', { n });
      case 'IMPORTANCE': return this.i18n.instant('poste.bulk.titreImportance', { n });
      case 'POTENTIEL_OPTIMISATION': return this.i18n.instant('poste.bulk.titrePotentiel', { n });
    }
  }

  fermer(): void {
    this.visibleChange.emit(false);
  }

  appliquer(): void {
    const ids = this.posteIds();
    if (ids.length === 0) return;

    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const champ = this.champ();

    this.enregistrementEnCours = true;
    this.posteSvc.actionsGroupees(foyerId, scenarioId, {
      ids,
      champ,
      categorieId: champ === 'CATEGORIE' ? this.valeurCategorieId : undefined,
      importance: champ === 'IMPORTANCE' ? this.valeurImportance : undefined,
      potentielOptimisation: champ === 'POTENTIEL_OPTIMISATION' ? this.valeurPotentiel : undefined,
    }).subscribe({
      next: () => {
        this.enregistrementEnCours = false;
        notifierSucces(this.toast, this.i18n.instant('poste.bulk.succesMiseAJour', { n: ids.length }));
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
