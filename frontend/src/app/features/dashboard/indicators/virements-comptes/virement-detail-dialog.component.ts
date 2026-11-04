import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { MontantPipe } from '../../../../core/pipes/format.pipes';
import { VirementDetailLigneDto } from '../../../../core/models/api.models';

/** Ligne prête à afficher : libellé résolu (poche/comblement traduits) + classe de montant. */
interface LigneAffichee {
  cle: string;
  libelle: string;
  categorie: string;
  montant: number;
  classeMontant: string;
}

/**
 * Popin de composition d'un virement inter-comptes : « de quoi est fait ce virement »
 * — une ligne par poste (libellé, catégorie, montant), plus les lignes résiduelles
 * « argent de poche » et « comblement de trésorerie ». Strictement présentationnel :
 * le parent (shell du dashboard) fournit les données déjà chargées par le facade.
 */
@Component({
  selector: 'app-virement-detail-dialog',
  standalone: true,
  imports: [DialogModule, SkeletonModule, TableModule, MontantPipe],
  templateUrl: './virement-detail-dialog.component.html',
  styleUrl: './virement-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VirementDetailDialogComponent {
  protected readonly t = inject(I18nService).translations();

  readonly visible = input<boolean>(false);
  readonly lignes = input<readonly VirementDetailLigneDto[]>([]);
  readonly chargement = input<boolean>(false);
  readonly libelleSource = input<string>('');
  readonly libelleDestination = input<string>('');
  readonly montantTotal = input<number>(0);
  readonly devise = input<string>('CHF');

  readonly fermer = output<void>();

  protected readonly titre = computed(
    () => `${this.libelleSource()} → ${this.libelleDestination()}`,
  );

  protected readonly lignesAffichees = computed<LigneAffichee[]>(() =>
    this.lignes().map((l, index) => ({
      cle: `${l.origine}-${l.posteId ?? index}`,
      libelle: this.libelleLigne(l),
      categorie: l.categorieNom ?? '',
      montant: l.montant,
      classeMontant: this.classeMontant(l),
    })),
  );

  /** Les lignes sans poste portent un libellé i18n dédié (le backend les renvoie à `null`). */
  private libelleLigne(l: VirementDetailLigneDto): string {
    switch (l.origine) {
      case 'ARGENT_POCHE':
        return this.t.dashboard.virementDetailArgentPoche;
      case 'COMBLEMENT_TRESORERIE':
        return this.t.dashboard.virementDetailComblement;
      default:
        return l.libelle ?? '';
    }
  }

  /** Le type de poste prime sur le signe (voir conventions de `_base.css`). */
  private classeMontant(l: VirementDetailLigneDto): string {
    if (l.origine === 'ARGENT_POCHE') return 'montant-argent-poche';
    if (l.origine === 'COMBLEMENT_TRESORERIE') return 'montant-neutre';
    switch (l.type) {
      case 'REVENU': return 'montant-revenu';
      case 'RESERVE': return 'montant-reserve';
      default: return 'montant-charge';
    }
  }
}
