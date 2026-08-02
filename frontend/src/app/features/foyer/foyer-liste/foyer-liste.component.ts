import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { FoyerService } from '../../../core/services/referentiel.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { FoyerDto } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';

@Component({
  selector: 'app-foyer-liste',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule],
  templateUrl: './foyer-liste.component.html',
})
export class FoyerListeComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
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
    // Ne pas appeler contexte.setFoyer() ici : ShellComponent est l'unique responsable
    // du chargement du contexte foyer (foyer + membres + scénario), déclenché par la
    // navigation, sans risque de course avec une réponse réseau tardive.
    this.router.navigate(['/f', foyer.id, 'dashboard']);
  }

  ouvrirCreation(): void {
    this.router.navigate(['/foyers/nouveau']);
  }
}
