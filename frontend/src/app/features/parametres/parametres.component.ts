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
import { I18nService } from '../../core/i18n/i18n.service';

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
  templateUrl: './parametres.component.html',
})
export class ParametresComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
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
        this.contexte.notifierRefresh();
        this.sauvegarde.set(false);
      },
      error: () => this.sauvegarde.set(false),
    });
  }

  supprimerFoyer(): void {
    this.confirm.confirm({
      message: this.t.parametres.confirmerSuppression,
      accept: () => {
        const foyerId = this.contexte.foyerId()!;
        this.foyerSvc.supprimer(foyerId).subscribe({
          next: () => {
            this.contexte.setFoyer(null);
            this.contexte.notifierRefresh();
            this.router.navigate(['/foyers']);
          },
          error: () => this.sauvegarde.set(false),
        });
      },
    });
  }
}

