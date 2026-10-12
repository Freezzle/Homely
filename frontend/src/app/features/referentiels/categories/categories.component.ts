import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { CategorieService } from '../../../core/services/referentiel.service';
import { CategorieDto } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { DialogSuppressionComponent } from '../../../shared/components/dialog-suppression/dialog-suppression.component';
import { SelectComponent } from '../../../shared/components/form-fields';
import { TagComponent } from '../../../shared/components/tag/tag.component';
import { creerCrudReferentiel } from '../../../core/utils/crud-referentiel.util';
import { notifierSucces, notifierErreur } from '../../../core/utils/toast.util';
import { CategorieFormDialogComponent, CategorieFormRequest } from './categorie-form-dialog/categorie-form-dialog.component';

/** T10.2 — CRUD Catégories */
@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [
    CommonModule, TableModule, ButtonComponent, TagComponent, MessageModule,
    SelectComponent, FormsModule,
    DialogSuppressionComponent, CategorieFormDialogComponent,
  ],
  templateUrl: './categories.component.html',
})
export class CategoriesComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private categorieSvc = inject(CategorieService);
  private toast = inject(MessageService);

  private readonly _crud = creerCrudReferentiel(this.contexte, this.categorieSvc, this.toast, {
    succes: this.t.commun.succes,
    erreur: this.t.commun.erreur,
    suppressionImpossible: this.t.commun.suppressionImpossible,
  });

  categories = this._crud.items;
  chargement = this._crud.chargement;
  suppressionEnCours = signal(false);

  // Dialog création/édition
  dialogVisible = false;
  categorieEnEdition: CategorieDto | null = null;

  // Dialog suppression
  suppressionDialogVisible = false;
  categorieASupprimer: CategorieDto | null = null;
  migrerVersCategorieId: string | null = null;

  /** Catégories disponibles pour la migration (même typePoste, hors catégorie à supprimer) */
  categoriesMigration = signal<CategorieDto[]>([]);

  charger(): void {
    this._crud.charger();
  }

  ouvrirCreation(): void {
    this.categorieEnEdition = null;
    this.dialogVisible = true;
  }

  ouvrirEdition(c: CategorieDto): void {
    this.categorieEnEdition = c;
    this.dialogVisible = true;
  }

  /** La popin a validé sa saisie : il ne reste qu'à persister et refermer. */
  enregistrer(req: CategorieFormRequest): void {
    this._crud.enregistrer(this.categorieEnEdition?.id ?? null, req, () => { this.dialogVisible = false; });
  }

  ouvrirSuppression(c: CategorieDto): void {
    this.categorieASupprimer = c;
    this.migrerVersCategorieId = null;
    // Proposer uniquement les catégories du même typePoste (hors celle à supprimer)
    this.categoriesMigration.set(
      this.categories().filter(cat => cat.typePoste === c.typePoste && cat.id !== c.id)
    );
    this.suppressionDialogVisible = true;
  }

  confirmerSuppression(): void {
    const foyerId = this.contexte.foyerId()!;
    const c = this.categorieASupprimer!;
    this.suppressionEnCours.set(true);
    this.categorieSvc
      .supprimer(foyerId, c.id, this.migrerVersCategorieId ?? undefined)
      .subscribe({
        next: () => {
          notifierSucces(this.toast, this.t.commun.succes);
          this.suppressionDialogVisible = false;
          this.suppressionEnCours.set(false);
          this.charger();
        },
        error: () => {
          notifierErreur(this.toast, this.t.commun.suppressionImpossible);
          this.suppressionEnCours.set(false);
        },
      });
  }
}
