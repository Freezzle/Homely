import { Component, computed, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { DividerModule } from 'primeng/divider';
import { MeterGroupModule } from 'primeng/metergroup';
import { TagModule } from 'primeng/tag';
import { I18nService } from '../../../core/i18n/i18n.service';

/** Tag membre (nom + couleur) affiché sur une ligne de décomposition « Compte » (co-titulaires). */
export interface MembreTagInfo { membreId: string; label: string; couleur: string; couleurTexte: string; }

/** Une ligne de décomposition (revenu/charge/réserve, catégorie, type de poste ou compte). */
export interface LigneDecomposition {
  id: string; libelle: string; montantAbs: number; signe: 1 | -1;
  tags?: MembreTagInfo[];
}

/**
 * Carte « bilan » réutilisable (membre ou foyer) : montant principal (reste à vivre du
 * mois / solde disponible de l'année), décomposition détaillée et taux d'effort optionnel.
 * Utilisée par `dashboard-mensuel` et `dashboard-annuel`.
 */
@Component({
  selector: 'app-carte-bilan',
  standalone: true,
  imports: [CommonModule, CardModule, AvatarModule, DividerModule, MeterGroupModule, TagModule],
  template: `
    <p-card [style.border-top]="'4px solid ' + couleurEffective()" class="overflow-hidden">
      <ng-template #title>
        <div class="flex items-center gap-3">
          @if (variante() === 'foyer') {
            <p-avatar [label]="initiales()" shape="circle" size="large"
                      class="bg-primary text-primary-contrast font-semibold shrink-0"/>
          } @else {
            <p-avatar [label]="initiales()" shape="circle" size="large"
                      [style.background-color]="couleur()" class="text-white font-semibold shrink-0"/>
          }
          <span class="font-bold text-base">{{ nom() }}</span>
        </div>
      </ng-template>
      
      <div class="mb-3">
        <div class="text-xs text-surface-700 uppercase tracking-wide">{{ montantPrincipalLabel() }}</div>
        <div class="flex items-baseline gap-1.5 mt-1">
          <span class="text-3xl font-extrabold tabular-nums"
                [class.text-emerald-600]="montantPrincipal() >= 0"
                [class.text-red-500]="montantPrincipal() < 0">
            {{ formatMontantSansDevise(montantPrincipal()) }}
          </span>
          <span class="text-sm text-surface-400">{{ devise() }}</span>
        </div>
      </div>

      <p-divider class="my-2"/>

      <div class="flex flex-col">
        @for (row of lignes(); track row.id) {
          <div class="flex flex-col gap-1 py-1 border-b border-surface-100 dark:border-surface-800 last:border-0">
            <div class="flex justify-between items-center text-sm">
              <span class="truncate mr-3 text-surface-700 dark:text-surface-200">
                {{ row.libelle }}
                @if (row.tags?.length) {
                  @for (tag of row.tags; track tag.membreId) {
                    <p-tag [value]="tag.label"
                           [style]="{ 'background-color': tag.couleur, color: tag.couleurTexte }"
                           class="text-xs py-0.5 me-1 px-2 border-none max-w-full"/>
                  }
                }
              </span>
              <span class="font-semibold shrink-0 tabular-nums"
                    [class.text-green-600]="row.signe > 0">
                {{ row.signe > 0 ? '+' : '−' }}&nbsp;{{ formatMontantSansDevise(row.montantAbs) }}
              </span>
            </div>
          </div>
        }
      </div>

      @if (tauxEffort(); as taux) {
        <ng-template #footer>
          <p-metergroup [value]="[{ label: t.projection.tauxEffort, value: taux, color: couleurEffective() }]"/>
        </ng-template>
      }
    </p-card>
  `,
})
export class CarteBilanComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();

  /** 'membre' : avatar coloré par membre. 'foyer' : avatar aux couleurs du thème primaire. */
  readonly variante = input<'membre' | 'foyer'>('membre');
  readonly nom = input.required<string>();
  readonly sousTitre = input.required<string>();
  /** Couleur du membre (hex) — ignorée quand `variante` = 'foyer'. */
  readonly couleur = input<string>('#64748b');
  readonly initiales = input.required<string>();
  readonly montantPrincipalLabel = input.required<string>();
  readonly montantPrincipal = input.required<number>();
  readonly devise = input.required<string>();
  readonly lignes = input.required<LigneDecomposition[]>();
  /** Taux d'effort (0-100) — footer masqué si non fourni. */
  readonly tauxEffort = input<number | undefined>(undefined);

  readonly couleurEffective = computed(() =>
    this.variante() === 'foyer' ? 'var(--p-primary-color)' : this.couleur()
  );

  /** Montant sans le symbole de devise — utilisé pour le chiffre principal des cartes. */
  formatMontantSansDevise(v: number): string {
    return Intl.NumberFormat('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }
}
