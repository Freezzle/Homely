import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { Router } from '@angular/router';
import { ContexteService } from '../../core/services/contexte.service';
import { FoyerService } from '../../core/services/referentiel.service';
import { FR } from '../../core/i18n/fr';

/** T10.2 — Paramètres du foyer (OWNER) */
@Component({
  selector: 'app-parametres',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule,
    CardModule, ButtonModule, InputTextModule, SelectModule,
    ConfirmDialogModule,
  ],
  template: `
    <p-confirmdialog />
    <div class="max-w-xl flex flex-col gap-6">
      <h1 class="text-2xl font-bold">{{ t.parametres.titre }}</h1>

      <p-card>
        <form [formGroup]="form" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.parametres.nom }} *</label>
            <input pInputText formControlName="nom" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t.parametres.deviseBase }}</label>
            <p-select appendTo="body" formControlName="deviseBase" [options]="devises" styleClass="w-full" />
          </div>
          <div class="flex justify-end">
            <p-button [label]="t.parametres.enregistrer" icon="pi pi-save"
                      (click)="enregistrer()" [disabled]="form.invalid || !contexte.estOwner()"
                      [loading]="sauvegarde()" />
          </div>
        </form>
      </p-card>

      @if (contexte.estOwner()) {
        <p-card styleClass="border border-red-200">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-semibold text-red-600">Zone dangereuse</div>
              <div class="text-sm text-surface-500 mt-1">{{ t.parametres.confirmerSuppression }}</div>
            </div>
            <p-button [label]="t.parametres.supprimer" icon="pi pi-trash" severity="danger"
                      (click)="supprimerFoyer()" />
          </div>
        </p-card>
      }
    </div>
  `,
})
export class ParametresComponent implements OnInit {
  readonly t = FR;
  contexte = inject(ContexteService);
  private foyerSvc = inject(FoyerService);
  private confirm = inject(ConfirmationService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  sauvegarde = signal(false);
  devises = ['CHF', 'EUR', 'USD', 'GBP', 'CAD'];

  form = this.fb.group({
    nom: ['', Validators.required],
    deviseBase: ['CHF', Validators.required],
  });

  ngOnInit(): void {
    const foyer = this.contexte.foyerCourant();
    if (foyer) {
      this.form.patchValue({ nom: foyer.nom, deviseBase: foyer.deviseBase });
    }
  }

  enregistrer(): void {
    const foyerId = this.contexte.foyerId();
    if (!foyerId) return;
    this.sauvegarde.set(true);
    const v = this.form.value;
    this.foyerSvc.modifier(foyerId, { nom: v.nom!, deviseBase: v.deviseBase! }).subscribe({
      next: foyer => {
        this.contexte.setFoyer(foyer);
        this.sauvegarde.set(false);
      },
      error: () => this.sauvegarde.set(false),
    });
  }

  supprimerFoyer(): void {
    this.confirm.confirm({
      message: FR.parametres.confirmerSuppression,
      accept: () => {
        const foyerId = this.contexte.foyerId()!;
        this.foyerSvc.supprimer(foyerId).subscribe({
          next: () => {
            this.contexte.setFoyer(null);
            this.router.navigate(['/foyers']);
          },
          error: () => this.sauvegarde.set(false),
        });
      },
    });
  }
}

