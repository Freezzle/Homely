import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { MembreService } from '../../../core/services/referentiel.service';
import { MembreDto } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';

/** T10.2 — CRUD Membres */
@Component({
  selector: 'app-membres',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule,
    TableModule, ButtonModule, DialogModule,
    InputTextModule, InputNumberModule, ColorPickerModule,
    ConfirmDialogModule,
  ],
  templateUrl: './membres.component.html',
})
export class MembresComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private membreSvc = inject(MembreService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  membres = signal<MembreDto[]>([]);
  chargement = signal(false);
  dialogVisible = false;
  membreEnEdition: MembreDto | null = null;

  form = this.fb.group({
    nom: ['', Validators.required],
    couleur: ['#6366f1'],
  });

  // effect() en initialiseur de champ = contexte d'injection valide ✓
  private readonly _chargerEffect = effect(() => {
    if (this.contexte.foyerId()) this.charger();
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.chargement.set(true);
    this.membreSvc.lister(foyerId).subscribe({
      next: m => { this.membres.set(m); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  ouvrirCreation(): void {
    this.membreEnEdition = null;
    this.form.reset({ nom: '', couleur: '#6366f1' });
    this.dialogVisible = true;
  }

  ouvrirEdition(m: MembreDto): void {
    this.membreEnEdition = m;
    this.form.patchValue({ nom: m.nom, couleur: m.couleur });
    this.dialogVisible = true;
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId()!;
    const v = this.form.value;
    // p-colorpicker format hex retourne parfois sans '#' → normalisation défensive
    const raw = v.couleur ?? '6366f1';
    const couleur = raw.startsWith('#') ? raw : '#' + raw;
    const req = { nom: v.nom!, couleur };
    const obs = this.membreEnEdition
      ? this.membreSvc.modifier(foyerId, this.membreEnEdition.id, req)
      : this.membreSvc.creer(foyerId, req);
    obs.subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: this.t.commun.succes });
        this.dialogVisible = false;
        this.charger();
      },
      error: (e) => this.toast.add({ severity: 'error', summary: this.t.commun.erreur, detail: e?.error?.message }),
    });
  }

  supprimer(m: MembreDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this.membreSvc.supprimer(this.contexte.foyerId()!, m.id).subscribe({
        next: () => { this.toast.add({ severity: 'success', summary: this.t.commun.succes }); this.charger(); },
        error: () => this.toast.add({ severity: 'error', summary: this.t.commun.suppressionImpossible }),
      }),
    });
  }
}
