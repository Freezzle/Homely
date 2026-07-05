import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { FoyerService } from '../../../core/services/referentiel.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { FoyerDto } from '../../../core/models/api.models';
import { FR } from '../../../core/i18n/fr';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-foyer-liste',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule, ButtonModule, DialogModule, InputTextModule, SelectModule],
  template: `
    <div class="max-w-2xl mx-auto py-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">{{ t.foyer.choisir }}</h1>
        <p-button icon="pi pi-plus" [label]="t.foyer.nouveau" (click)="ouvrirCreation()" />
      </div>

      <div class="grid grid-cols-1 gap-4">
        @for (foyer of foyers(); track foyer.id) {
          <p-card
            styleClass="cursor-pointer hover:shadow-lg transition-shadow border-2"
            [ngClass]="{'border-primary': foyer.id === contexte.foyerId()}"
            (click)="selectionner(foyer)"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="font-semibold text-lg">{{ foyer.nom }}</div>
                <div class="text-sm text-surface-500">{{ foyer.deviseBase }} · {{ foyer.monRole }}</div>
              </div>
              <i class="pi pi-chevron-right text-surface-400"></i>
            </div>
          </p-card>
        }
        @if (foyers().length === 0 && !chargement()) {
          <div class="text-center py-12 text-surface-400">
            <i class="pi pi-home text-4xl mb-4 block"></i>
            <p>Aucun foyer. Créez le premier !</p>
          </div>
        }
      </div>
    </div>

    <!-- Dialog création foyer -->
    <p-dialog [(visible)]="dialogVisible" [header]="t.foyer.nouveau" [modal]="true" styleClass="w-96">
      <div class="flex flex-col gap-4 pt-2">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.foyer.nom }}</label>
          <input pInputText [(ngModel)]="nouveauNom" class="w-full" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t.foyer.deviseBase }}</label>
          <p-select appendTo="body" [(ngModel)]="nouvelleDevise" [options]="devises" styleClass="w-full" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button [label]="t.commun.annuler" severity="secondary" (click)="dialogVisible = false" />
        <p-button [label]="t.commun.creer" (click)="creer()" [disabled]="!nouveauNom" />
      </ng-template>
    </p-dialog>
  `,
})
export class FoyerListeComponent implements OnInit {
  readonly t = FR;
  contexte = inject(ContexteService);
  private foyerSvc = inject(FoyerService);
  private router = inject(Router);
  private toast = inject(MessageService);

  foyers = signal<FoyerDto[]>([]);
  chargement = signal(false);
  dialogVisible = false;
  nouveauNom = '';
  nouvelleDevise = 'CHF';
  devises = ['CHF', 'EUR', 'USD', 'GBP', 'CAD'];

  ngOnInit(): void {
    this.chargement.set(true);
    this.foyerSvc.lister().subscribe({
      next: f => { this.foyers.set(f); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  selectionner(foyer: FoyerDto): void {
    this.contexte.setFoyer(foyer);
    this.router.navigate(['/f', foyer.id, 'dashboard-annuel']);
  }

  ouvrirCreation(): void {
    this.nouveauNom = '';
    this.nouvelleDevise = 'CHF';
    this.dialogVisible = true;
  }

  creer(): void {
    this.foyerSvc.creer({ nom: this.nouveauNom, deviseBase: this.nouvelleDevise }).subscribe({
      next: foyer => {
        this.foyers.update(f => [...f, foyer]);
        this.dialogVisible = false;
        this.selectionner(foyer);
      },
      error: () => this.toast.add({ severity: 'error', summary: FR.commun.erreur }),
    });
  }
}
