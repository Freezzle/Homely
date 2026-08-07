import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { Router } from '@angular/router';
import { ContexteService } from '../../core/services/contexte.service';
import { FoyerService } from '../../core/services/referentiel.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { DEFAULT_BASE_CURRENCY, SUPPORTED_FOYER_BASE_CURRENCIES } from '../../core/constants/devises.constants';
import { InputTextComponent, SelectComponent } from '../../shared/components/form-fields';

/** T10.2 — Paramètres du foyer (OWNER) */
@Component({
  selector: 'app-parametres',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, ReactiveFormsModule,
    CardModule, ButtonModule, InputTextComponent, SelectComponent,
    ConfirmDialogModule,
  ],
  templateUrl: './parametres.component.html',
})
export class ParametresComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private foyerSvc = inject(FoyerService);
  private confirm = inject(ConfirmationService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  sauvegarde = signal(false);
  devises = SUPPORTED_FOYER_BASE_CURRENCIES;

  form = this.fb.group({
    nom: ['', Validators.required],
    deviseBase: [DEFAULT_BASE_CURRENCY, Validators.required],
  });

  /**
   * Le formulaire doit toujours refléter le foyer courant : si l'utilisateur
   * change de foyer via le sélecteur du shell sans quitter cet écran, il ne
   * doit pas pouvoir enregistrer les valeurs de l'ancien foyer sur le nouveau.
   * `effect()` repatch le formulaire (et mémorise le foyer ciblé par
   * `enregistrer()`) à chaque changement de `foyerCourant()`.
   */
  private foyerCibleId: string | null = null;

  private readonly _syncFoyerEffect = effect(() => {
    const foyer = this.contexte.foyerCourant();
    this.foyerCibleId = foyer?.id ?? null;
    if (foyer) {
      this.form.patchValue({ nom: foyer.nom, deviseBase: foyer.deviseBase });
    } else {
      this.form.reset({ nom: '', deviseBase: DEFAULT_BASE_CURRENCY });
    }
  });

  enregistrer(): void {
    const foyerId = this.foyerCibleId;
    if (!foyerId || foyerId !== this.contexte.foyerId()) return;
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
