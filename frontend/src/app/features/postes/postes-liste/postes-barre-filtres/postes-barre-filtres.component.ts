import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { PopoverModule } from 'primeng/popover';
import { DrawerModule } from 'primeng/drawer';
import { OverlayBadgeModule } from 'primeng/overlaybadge';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CheckboxComponent, RadioButtonComponent } from '../../../../shared/components/form-fields';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { AppTranslations } from '../../../../core/i18n/i18n.types';
import { ViewportService } from '../../../../core/services/viewport.service';
import { NaturePoste } from '../../../../core/models/api.models';
import {
  EtatFiltresPostes, CritereTri, CritereRegroupement, FiltreEtatPoste,
  OptionFacette, compterFiltresActifs, triDesactive, triImposeParRegroupement,
} from '../etat-filtres-postes.model';

/** Menu ouvert par la barre : pilote le contenu affiché dans le popover/drawer actif. */
type MenuActif = 'AUCUN' | 'TRIER' | 'FILTRES';

/**
 * Barre unique filtres/tri (recherche + bouton Trier + bouton Filtres), hauteur fixe
 * qui ne grandit jamais quel que soit le nombre de filtres actifs (voir
 * docs/features/feature_3.md). Composant purement présentationnel : reçoit l'état
 * courant et les facettes déjà calculées, émet les changements au parent
 * (`postes-liste.component.ts`) qui reste seul propriétaire de l'état et de la
 * synchronisation URL/localStorage.
 */
@Component({
  selector: 'app-postes-barre-filtres',
  standalone: true,
  imports: [CommonModule, FormsModule, PopoverModule, DrawerModule, OverlayBadgeModule,
            IconFieldModule, InputIconModule, InputTextModule,
            ButtonComponent, CheckboxComponent, RadioButtonComponent],
  templateUrl: './postes-barre-filtres.component.html',
})
export class PostesBarreFiltresComponent {
  readonly i18n = inject(I18nService);
  readonly viewport = inject(ViewportService);
  readonly t = input.required<AppTranslations>();
  readonly String = String; // Exposition pour le template (interpolation des compteurs i18n)

  asEtatPoste(id: string): FiltreEtatPoste { return id as FiltreEtatPoste; }
  asNaturePoste(id: string): NaturePoste { return id as NaturePoste; }
  asCritereTri(id: string): CritereTri { return id as CritereTri; }
  asCritereRegroupement(id: string): CritereRegroupement { return id as CritereRegroupement; }

  readonly etat = input.required<EtatFiltresPostes>();
  readonly nbResultats = input<number>(0);

  readonly optionsEtat = input<OptionFacette[]>([]);
  readonly optionsNature = input<OptionFacette[]>([]);
  readonly optionsCategorie = input<OptionFacette[]>([]);
  readonly optionsCompte = input<OptionFacette[]>([]);
  readonly optionsMembre = input<OptionFacette[]>([]);

  readonly etatChange = output<EtatFiltresPostes>();

  readonly nbFiltresActifs = () => compterFiltresActifs(this.etat());

  /**
   * Options du critère de tri (§5) : un critère est désactivé s'il est redondant
   * avec le regroupement actuel, ou si celui-ci impose de toute façon un ordre
   * chronologique unique (voir `triDesactive`, couplage tri/regroupement).
   */
  readonly triCritereOptions = () => {
    const regrouperPar = this.etat().regrouperPar;
    return (['DATE', 'CATEGORIE', 'DESCRIPTION'] as CritereTri[]).map(value => ({
      label: this.t().poste.triOptions[value],
      value,
      disabled: triDesactive(value, regrouperPar),
    }));
  };

  readonly regroupementOptions = () => [
    { label: this.t().poste.barreFiltres.regrouperOptions.DATE, value: 'DATE' as CritereRegroupement },
    { label: this.t().poste.barreFiltres.regrouperOptions.CATEGORIE, value: 'CATEGORIE' as CritereRegroupement },
    { label: this.t().poste.barreFiltres.regrouperOptions.DESCRIPTION, value: 'DESCRIPTION' as CritereRegroupement },
    { label: this.t().poste.barreFiltres.regrouperAucun, value: 'AUCUN' as CritereRegroupement },
  ];

  /** Menu actuellement ouvert (desktop : popover ancré ; mobile : feuille du bas). */
  menuActif = signal<MenuActif>('AUCUN');

  /** Copie locale de la recherche, avec temporisation avant d'émettre le changement. */
  rechercheLocale = signal<string>('');
  private readonly _rechercheSync = effect(() => this.rechercheLocale.set(this.etat().recherche));

  constructor() {
    toObservable(this.rechercheLocale)
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(recherche => {
        if (recherche !== this.etat().recherche) this.emettre({ recherche });
      });
  }

  private emettre(patch: Partial<EtatFiltresPostes>): void {
    this.etatChange.emit({ ...this.etat(), ...patch });
  }

  effacerRecherche(): void {
    this.rechercheLocale.set('');
  }

  changerTri(tri: CritereTri): void { this.emettre({ tri }); }

  /**
   * Changement de regroupement : impose le critère de tri par défaut associé (§5,
   * couplage tri/regroupement — voir `triImposeParRegroupement`), car le critère
   * précédemment sélectionné peut devenir redondant/désactivé avec ce regroupement.
   */
  changerRegroupement(regrouperPar: CritereRegroupement): void {
    const triImpose = triImposeParRegroupement(regrouperPar);
    this.emettre({ regrouperPar, ...(triImpose ? { tri: triImpose } : {}) });
  }

  private toggleDansListe<T>(liste: T[], valeur: T): T[] {
    return liste.includes(valeur) ? liste.filter(v => v !== valeur) : [...liste, valeur];
  }

  toggleEtat(valeur: FiltreEtatPoste): void {
    this.emettre({ filtreEtat: this.toggleDansListe(this.etat().filtreEtat, valeur) });
  }

  toggleNature(valeur: NaturePoste): void {
    this.emettre({ filtreNature: this.toggleDansListe(this.etat().filtreNature, valeur) });
  }

  toggleCategorie(id: string): void {
    this.emettre({ filtreCategorieIds: this.toggleDansListe(this.etat().filtreCategorieIds, id) });
  }

  toggleCompte(id: string): void {
    this.emettre({ filtreCompteIds: this.toggleDansListe(this.etat().filtreCompteIds, id) });
  }

  toggleMembre(id: string): void {
    this.emettre({ filtreMembreIds: this.toggleDansListe(this.etat().filtreMembreIds, id) });
  }

  effacerTousLesFiltres(): void {
    this.emettre({ filtreEtat: [], filtreNature: [], filtreCategorieIds: [], filtreCompteIds: [], filtreMembreIds: [] });
  }

  /** Élément qui a ouvert le menu actif : restaure le focus dessus à la fermeture (§11). */
  private _elementDeclencheur: HTMLElement | null = null;

  ouvrirMenu(menu: MenuActif, event: Event, popoverTri: { toggle: (e: Event) => void }, popoverFiltres: { toggle: (e: Event) => void }): void {
    this._elementDeclencheur = event.currentTarget as HTMLElement;
    if (this.viewport.estMobile()) {
      this.menuActif.set(menu);
      return;
    }
    this.menuActif.set(menu);
    if (menu === 'TRIER') popoverTri.toggle(event);
    if (menu === 'FILTRES') popoverFiltres.toggle(event);
  }

  /** Restaure le focus sur le bouton déclencheur à la fermeture du popover/drawer (§11). */
  restaurerFocusDeclencheur(): void {
    this._elementDeclencheur?.focus();
    this._elementDeclencheur = null;
  }

  /** Fermeture d'un popover desktop (clic extérieur, Échap, ou nouveau `.toggle()`). */
  onPopoverHide(): void {
    this.menuActif.set('AUCUN');
    this.restaurerFocusDeclencheur();
  }

  fermerDrawerMobile(): void {
    this.menuActif.set('AUCUN');
    this.restaurerFocusDeclencheur();
  }
}
