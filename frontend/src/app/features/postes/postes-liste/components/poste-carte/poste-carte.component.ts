import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { MontantPipe, PeriodicitePipe } from '../../../../../core/pipes/format.pipes';
import { TypePoste } from '../../../../../core/models/api.models';
import { CheckboxComponent } from '../../../../../shared/components/form-fields';
import { CarteListeComponent } from '../../../../../shared/components/liste';
import { EtiquettePoste, PosteAffiche } from '../../poste-affiche.model';
import { PosteEtiquettesComponent } from '../poste-etiquettes/poste-etiquettes.component';
import { estMontantApproche, estPonctuel, montantParMois } from '../../postes-affichage.util';

/** Classe de couleur du montant selon le type de la liste (charte : montant typé). */
const CLASSE_MONTANT: Record<TypePoste, string> = {
  REVENU: 'montant-revenu',
  CHARGE: 'montant-charge',
  RESERVE: 'montant-reserve',
};

/**
 * Carte d'un poste dans la liste : tête sur deux lignes (libellé / montant par mois,
 * puis dates / périodicité), pied d'étiquettes, et détail dépliable projeté par le
 * parent via `ng-content`.
 *
 * La tête est un vrai `<button>` (ou un `<label>` en mode sélection) : tout le bloc est
 * cliquable, avec `aria-expanded`/`aria-controls` corrects.
 */
@Component({
  selector: 'app-poste-carte',
  standalone: true,
  imports: [FormsModule, MontantPipe, PeriodicitePipe, CheckboxComponent, PosteEtiquettesComponent, CarteListeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './poste-carte.component.html',
  styleUrl: './poste-carte.component.scss',
  host: {
    '[class.carte--suite-chaine]': 'poste()._estChaine && !poste()._premierDuBloc',
  },
})
export class PosteCarteComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly poste = input.required<PosteAffiche>();
  readonly type = input.required<TypePoste>();
  /** Description déjà surlignée (`<mark>`) par la recherche courante. */
  readonly descriptionHtml = input('');
  /** Fenêtre de validité condensée (« Depuis le 01.2025 »). */
  readonly texteDates = input('');
  readonly deplie = input(false);
  readonly modeSelection = input(false);
  readonly selectionne = input(false);
  readonly enSurbrillance = input(false);
  readonly cacherDetails = input(false);
  readonly categorie = input('');
  readonly comptes = input<EtiquettePoste[]>([]);
  readonly natureTexte = input('');
  readonly successeurTexte = input<string | null>(null);

  /** Demande d'ouverture / fermeture du détail (le parent arbitre : un seul déplié). */
  readonly basculer = output<void>();
  readonly selectionChange = output<void>();

  protected readonly ponctuel = computed(() => estPonctuel(this.poste()));
  protected readonly approche = computed(() => estMontantApproche(this.poste()));
  protected readonly montantMois = computed(() => montantParMois(this.poste()));
  protected readonly classeMontant = computed(() => CLASSE_MONTANT[this.type()]); 
  protected readonly idDetail = computed(() => `detail-poste-${this.poste().id}`);

  protected readonly libelleBascule = computed(() =>
    this.i18n.instant(this.deplie() ? 'poste.liste.replier' : 'poste.liste.deplier', {
      nom: this.poste().description,
    }),
  );
}
