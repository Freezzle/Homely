import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ProrataPartageMembreDto } from '../../../../core/models/api.models';
import { TagComponent } from '../../../../shared/components/tag/tag.component';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { formatTaux } from '../../../../shared/utils/format-taux.util';

/** Ligne affichée dans le tableau du drawer — écart en points de pourcentage entre le
 *  prorata moyen appliqué et le prorata théorique selon les revenus (positif = le
 *  membre paie plus que son poids de revenus, négatif = moins). */
interface LigneProrataPartage {
  membreId: string;
  nom: string;
  couleur: string;
  applique: number | null;
  theorique: number | null;
  ecart: number | null;
}

/**
 * Contenu du drawer pour l'indicateur "Prorata des postes partagés" : tableau par
 * membre comparant le prorata moyen réellement appliqué (pondéré par montant, sur les
 * postes CHARGE/RESERVE partagés) au prorata théorique selon le poids de ses revenus
 * dans le total du foyer sur la période — avec l'écart en points.
 */
@Component({
  selector: 'app-prorata-partage-drawer-content',
  standalone: true,
  imports: [CommonModule, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prorata-partage-drawer-content.component.html',
})
export class ProrataPartageDrawerContentComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  /** Convention `IndicatorDrawerService` : reçoit le payload transmis à `open({ data })`. */
  readonly data = input<ProrataPartageMembreDto[]>();

  protected readonly lignes = computed<LigneProrataPartage[]>(() =>
    (this.data() ?? []).map((dto) => ({
      membreId: dto.membreId,
      nom: dto.nomMembre ?? '',
      couleur: dto.couleurMembre ?? '#9CA3AF',
      applique: dto.prorataMoyenApplique != null ? dto.prorataMoyenApplique * 100 : null,
      theorique: dto.prorataTheoriqueRevenu != null ? dto.prorataTheoriqueRevenu * 100 : null,
      ecart: dto.prorataMoyenApplique != null && dto.prorataTheoriqueRevenu != null
        ? (dto.prorataMoyenApplique - dto.prorataTheoriqueRevenu) * 100
        : null,
    })),
  );

  protected formatTaux = formatTaux;
}
