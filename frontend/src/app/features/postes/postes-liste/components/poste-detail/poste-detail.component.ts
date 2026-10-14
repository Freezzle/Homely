import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { IndicateurNiveauComponent } from '../../../../../shared/components/indicateurs';
import { PosteApercuPeriodiciteComponent } from '../../../../../shared/components/echeancier-annuel/poste-apercu-periodicite/poste-apercu-periodicite.component';
import { DetailListeComponent } from '../../../../../shared/components/liste';
import { TonIndicateur } from '../../../../../shared/components/indicateurs/tons';
import { ApercuPeriodicitePoste, LigneDetailPoste } from '../../poste-affiche.model';

/** Note d'analyse affichée en lecture seule dans la colonne de droite. */
export interface AnalysePoste {
  cle: string;
  libelle: string;
  valeur: number;
  ton: TonIndicateur;
}

/**
 * Contenu du détail déplié d'une carte de poste : les paires libellé / valeur et la
 * rangée d'actions sont rendues par `app-detail-liste` (partagé avec les autres listes) ;
 * ce composant n'ajoute que les blocs propres aux postes — notes d'analyse en lecture
 * seule et aperçu du rythme sur 12 mois.
 *
 * Composant de présentation pur : les lignes arrivent déjà formatées et les actions
 * sont les `MenuItem` construits par `PostesListeComponent.actionItemsFor` (mêmes
 * conditions d'affichage, mêmes `command`).
 */
@Component({
  selector: 'app-poste-detail',
  standalone: true,
  imports: [IndicateurNiveauComponent, PosteApercuPeriodiciteComponent, DetailListeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './poste-detail.component.html',
  styleUrl: './poste-detail.component.scss',
})
export class PosteDetailComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly lignes = input<LigneDetailPoste[]>([]);
  readonly analyses = input<AnalysePoste[]>([]);
  /** Rythme du poste sur 12 mois ; `null` quand le poste n'a pas de date de début. */
  readonly apercu = input<ApercuPeriodicitePoste | null>(null);
  readonly actions = input<MenuItem[]>([]);
}
