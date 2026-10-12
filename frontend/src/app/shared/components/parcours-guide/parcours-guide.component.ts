import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ButtonComponent } from '../button/button.component';
import { StepProgressComponent } from '../step-progress/step-progress.component';
import { EtapeParcours, LigneFiche, TonBadgeParcours } from './parcours-guide.model';

/**
 * Coquille d'un formulaire long présenté « une question par écran » : dialog,
 * barre d'étapes, colonne de question défilante, fiche récapitulative
 * permanente (tiroir sous 768 px) et pied d'actions contextuel.
 *
 * Purement présentationnelle : le parcours (validation, navigation,
 * enregistrement) reste piloté par le composant hôte, qui projette le contenu
 * de l'étape courante et reçoit les intentions via les sorties.
 */
@Component({
  selector: 'app-parcours-guide',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, DialogModule, ButtonComponent, StepProgressComponent],
  templateUrl: './parcours-guide.component.html',
  styleUrl: './parcours-guide.component.scss',
})
export class ParcoursGuideComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly visible = input<boolean>(false);
  readonly titre = input<string>('');
  readonly sousTitre = input<string>('');
  readonly badgeTexte = input<string>('');
  readonly badgeTon = input<TonBadgeParcours>('info');
  /** Largeur du dialog ; passe en plein écran sous 768 px. */
  readonly largeur = input<string>('58rem');

  readonly etapes = input.required<readonly EtapeParcours[]>();
  readonly etapeCourante = input.required<string>();

  readonly lignes = input<readonly LigneFiche[]>([]);
  readonly ficheTitre = input<string>('');
  readonly ficheSousTitre = input<string>('');
  /** Bloc « Impact » masqué tant que cette entrée est vide. */
  readonly impactPrincipal = input<string>('');
  readonly impactSecondaire = input<string>('');

  readonly modeEdition = input<boolean>(false);
  readonly peutAllerFin = input<boolean>(false);
  readonly enregistrementEnCours = input<boolean>(false);
  readonly avecEnregistrerEtNouveau = input<boolean>(false);

  readonly precedent = output<void>();
  readonly suivant = output<void>();
  readonly allerFin = output<void>();
  readonly naviguerFiche = output<string>();
  readonly enregistrer = output<void>();
  readonly enregistrerEtNouveau = output<void>();
  readonly fermer = output<void>();
  readonly ouvert = output<void>();

  /** Tiroir de la fiche (mobile uniquement). */
  protected readonly ficheOuverte = signal(false);

  private readonly colonneQuestion = viewChild<ElementRef<HTMLElement>>('colonneQuestion');

  protected readonly indexCourant = computed(() =>
    Math.max(this.etapes().findIndex(e => e.cle === this.etapeCourante()), 0),
  );

  protected readonly derniereEtape = computed(() => this.indexCourant() === this.etapes().length - 1);

  protected readonly titreEtape = computed(() => this.etapes()[this.indexCourant()]?.titre ?? '');

  protected readonly libelleProgression = computed(() =>
    this.t.commun.parcours.progression
      .replace('{{n}}', String(this.indexCourant() + 1))
      .replace('{{total}}', String(this.etapes().length)),
  );

  /** Ramène la colonne de question en haut : appelé par l'hôte à chaque changement d'étape. */
  defilerEnHaut(): void {
    this.ficheOuverte.set(false);
    queueMicrotask(() => this.colonneQuestion()?.nativeElement.scrollTo({ top: 0 }));
  }

  /**
   * Entrée dans un champ : continue, ou enregistre sur la dernière étape.
   * Ignorée quand un overlay est ouvert (liste de sélection, calendrier) : la
   * touche appartient alors au composant qui a le focus.
   */
  protected onEntree(event: Event): void {
    const cible = event.target as HTMLElement | null;
    if (!cible || cible.tagName !== 'INPUT') return;
    if (document.querySelector('.p-select-overlay, .p-datepicker-panel, .p-autocomplete-overlay')) return;
    event.preventDefault();
    if (this.derniereEtape()) this.enregistrer.emit();
    else this.suivant.emit();
  }

  protected onVisibleChange(v: boolean): void {
    if (!v) this.fermer.emit();
  }

  protected basculerFiche(): void {
    this.ficheOuverte.update(o => !o);
  }

  protected naviguer(cle: string): void {
    this.ficheOuverte.set(false);
    this.naviguerFiche.emit(cle);
  }
}
