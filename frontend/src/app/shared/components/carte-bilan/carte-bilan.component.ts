import { Component, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { DividerModule } from 'primeng/divider';
import { MeterGroupModule } from 'primeng/metergroup';
import { I18nService } from '../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../core/i18n/locale.util';
import { TagComponent } from '../tag/tag.component';

/** Tag membre (nom + couleur) affiché sur une ligne de décomposition « Compte » (co-titulaires). */
export interface MembreTagInfo { membreId: string; label: string; couleur: string; couleurTexte: string; }

/** Une ligne de décomposition (revenu/charge/réserve, catégorie, type de poste ou compte). */
export interface LigneDecomposition {
  id: string; libelle: string; montantAbs: number; signe: 1 | -1;
  /** Type de poste d'origine — permet un style dédié (ex. réserve affichée en bleu,
   *  argent de poche affiché en or). */
  type?: 'REVENU' | 'CHARGE' | 'RESERVE' | 'ARGENT_POCHE';
  tags?: MembreTagInfo[];
}

/**
 * Carte « bilan » réutilisable (membre ou foyer) : montant principal (reste à vivre du
 * mois / solde disponible de l'année), décomposition détaillée et taux d'effort optionnel.
 * Utilisée par `DashboardComponent` (vues année/mois unifiées).
 */
@Component({
  selector: 'app-carte-bilan',
  standalone: true,
  imports: [CommonModule, CardModule, AvatarModule, DividerModule, MeterGroupModule, TagComponent],
  templateUrl: './carte-bilan.component.html',
})
export class CarteBilanComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();

  /** 'membre' : avatar coloré par membre. 'foyer' : avatar aux couleurs du thème primaire. */
  readonly variante = input<'membre' | 'foyer'>('membre');
  readonly nom = input.required<string>();
  readonly sousTitre = input.required<string>();
  /** Couleur du membre (hex) — ignorée quand `variante` = 'foyer'. */
  readonly couleur = input<string>('var(--p-secondary-color)');
  readonly initiales = input.required<string>();
  readonly montantPrincipal = input.required<number>();
  readonly devise = input.required<string>();
  readonly lignes = input.required<LigneDecomposition[]>();
  /** Taux d'effort (0-100) — footer masqué si non fourni. */
  readonly tauxEffort = input<number | undefined>(undefined);
  /** Prorata / quote-part attribué (0-100) pour la période affichée — barre neutre en footer. */
  readonly prorataPct = input<number | undefined>(undefined);

  /** Montant sans le symbole de devise — utilisé pour le chiffre principal des cartes. */
  formatMontantSansDevise(v: number): string {
    return Intl.NumberFormat(localeDeLangue(this.i18n.currentLang()), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }
}
