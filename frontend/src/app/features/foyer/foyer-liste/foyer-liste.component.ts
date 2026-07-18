import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { FoyerService } from '../../../core/services/referentiel.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { FoyerDto } from '../../../core/models/api.models';
import { FR } from '../../../core/i18n/fr';

@Component({
  selector: 'app-foyer-liste',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule],
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
            <p>{{ t.foyer.aucun }} {{ t.foyer.creerPremier }}</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class FoyerListeComponent implements OnInit {
  readonly t = FR;
  contexte = inject(ContexteService);
  private foyerSvc = inject(FoyerService);
  private router = inject(Router);

  foyers = signal<FoyerDto[]>([]);
  chargement = signal(false);

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
    this.router.navigate(['/foyers/nouveau']);
  }
}
