import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawerModule } from 'primeng/drawer';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AppTranslations } from '../../../core/i18n/i18n.types';

/**
 * Vue-modèle d'un maillon de la chaîne de révisions, déjà entièrement formaté par le
 * composant parent (`postes-liste.component.ts`) — ce drawer est purement présentationnel
 * et ne dépend d'aucun helper de formatage privé du parent.
 */
export interface MaillonHistorique {
  posteId: string;
  /** Période déjà formatée (ex. « janv. 2026 – déc. 2026 » ou « janv. 2026 – en cours »). */
  periode: string;
  montant: number;
  devise?: string;
  /** Libellé d'écart déjà formaté/traduit, ou `null` pour le tout premier maillon (montant d'origine). */
  ecartLabel: string | null;
  ecartPositif: boolean | null;
}

/**
 * Drawer (lecture seule) affichant l'historique de la chaîne de révisions d'un poste.
 * Extrait de `postes-liste.component.ts` : la navigation vers un maillon (scroll +
 * surbrillance dans la liste principale) reste de la responsabilité du parent, qui reçoit
 * l'id du poste via l'output `navigerVersPoste`.
 */
@Component({
  selector: 'app-poste-historique-drawer',
  standalone: true,
  imports: [CommonModule, DrawerModule, MontantPipe],
  templateUrl: './poste-historique-drawer.component.html',
})
export class PosteHistoriqueDrawerComponent {
  readonly i18n = inject(I18nService);
  readonly t = input.required<AppTranslations>();
  readonly visible = input<boolean>(false);
  readonly posteDescription = input<string>('');
  readonly maillons = input<MaillonHistorique[]>([]);
  readonly evolutionGlobale = input<{ signe: string; pct: string } | null>(null);

  readonly visibleChange = output<boolean>();
  readonly navigerVersPoste = output<string>();
}
