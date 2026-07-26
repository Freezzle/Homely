import { Component, inject, signal, OnInit, effect } from '@angular/core';
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

/** T10.2 — CRUD Catégories */
@Component({
  selector: 'app-categories',
  standalone: true,
             imports: [
               CommonModule, ReactiveFormsModule,
               TableModule, ButtonModule, DialogModule, TagModule, MessageModule,
               InputTextModule, InputNumberModule, SelectModule, FormsModule
             ],
  templateUrl: './categories.component.html',
})
export class CategoriesComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private categorieSvc = inject(CategorieService);
  private toast = inject(MessageService);
  private fb = inject(FormBuilder);

  categories = signal<CategorieDto[]>([]);
  chargement = signal(false);
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

  private readonly _chargerEffect = effect(() => {
    if (this.contexte.foyerId()) this.charger();
  });

  typeOptions: { label: string; value: TypeCategorie }[] = [
    { label: this.t.referentiels.categorie.typeOptions.REVENU, value: 'REVENU' },
    { label: this.t.referentiels.categorie.typeOptions.CHARGE, value: 'CHARGE' },
    { label: this.t.referentiels.categorie.typeOptions.RESERVE, value: 'RESERVE' },
    { label: this.t.referentiels.categorie.typeOptions.PROJET, value: 'PROJET' },
  ];

  form = this.fb.group({
    libelle: ['', Validators.required],
    typePoste: ['REVENU' as TypeCategorie, Validators.required],
    ordre: [1, Validators.required],
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.chargement.set(true);
    this.categorieSvc.lister(foyerId).subscribe({
      next: c => { this.categories.set(c); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  ouvrirCreation(): void {
    this.categorieEnEdition = null;
    const ordre = this.categories().length + 1;
    this.form.reset({ libelle: '', typePoste: 'REVENU', ordre });
    this.dialogVisible = true;
  }

  ouvrirEdition(c: CategorieDto): void {
    this.categorieEnEdition = c;
    this.form.patchValue({ libelle: c.libelle, typePoste: c.typePoste, ordre: c.ordre });
    this.dialogVisible = true;
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const v = this.form.value;
    const req = { libelle: v.libelle!, typePoste: v.typePoste as TypeCategorie, ordre: v.ordre! };
    const obs = this.categorieEnEdition
      ? this.categorieSvc.modifier(foyerId, this.categorieEnEdition.id, req)
      : this.categorieSvc.creer(foyerId, req);
    obs.subscribe({
      next: () => { this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.dialogVisible = false; this.charger(); },
      error: (e) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: e?.error?.message }),
    });
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
          this.toast.add({ severity: 'success', summary: this.t.commun.succes });
          this.suppressionDialogVisible = false;
          this.suppressionEnCours.set(false);
          this.charger();
        },
        error: () => {
          this.toast.add({ severity: 'error', summary: this.t.commun.suppressionImpossible });
          this.suppressionEnCours.set(false);
        },
      });
  }
}
