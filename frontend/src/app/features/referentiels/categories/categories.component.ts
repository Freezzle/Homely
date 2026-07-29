import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {FormBuilder, Validators, ReactiveFormsModule, FormsModule} from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { CategorieService } from '../../../core/services/referentiel.service';
import { CategorieDto, TypeCategorie } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { DialogSuppressionComponent } from '../../../shared/components/dialog-suppression/dialog-suppression.component';
import { creerCrudReferentiel } from '../../../core/utils/crud-referentiel.util';
import { notifierSucces, notifierErreur } from '../../../core/utils/toast.util';

/** T10.2 — CRUD Catégories */
@Component({
  selector: 'app-categories',
  standalone: true,
             imports: [
               CommonModule, ReactiveFormsModule,
               TableModule, ButtonModule, DialogModule, TagModule, MessageModule,
               InputTextModule, InputNumberModule, SelectModule, FormsModule,
               DialogSuppressionComponent,
             ],
  templateUrl: './categories.component.html',
})
export class CategoriesComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private categorieSvc = inject(CategorieService);
  private toast = inject(MessageService);
  private fb = inject(FormBuilder);

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

  typeOptions: { label: string; value: TypeCategorie }[] = [
    { label: this.t.referentiels.categorie.typeOptions.REVENU, value: 'REVENU' },
    { label: this.t.referentiels.categorie.typeOptions.CHARGE, value: 'CHARGE' },
    { label: this.t.referentiels.categorie.typeOptions.RESERVE, value: 'RESERVE' },
    { label: this.t.referentiels.categorie.typeOptions.PROJET, value: 'PROJET' },
  ];

  form = this.fb.group({
    libelle: ['', Validators.required],
    typePoste: ['REVENU' as TypeCategorie, Validators.required],
  });

  charger(): void {
    this._crud.charger();
  }

  ouvrirCreation(): void {
    this.categorieEnEdition = null;
    this.form.reset({ libelle: '', typePoste: 'REVENU' });
    this.dialogVisible = true;
  }

  ouvrirEdition(c: CategorieDto): void {
    this.categorieEnEdition = c;
    this.form.patchValue({ libelle: c.libelle, typePoste: c.typePoste });
    this.dialogVisible = true;
  }

  enregistrer(): void {
    const v = this.form.value;
    const req = { libelle: v.libelle!, typePoste: v.typePoste as TypeCategorie };
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
