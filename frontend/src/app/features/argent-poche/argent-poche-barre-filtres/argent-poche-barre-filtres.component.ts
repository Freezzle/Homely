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
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { CheckboxComponent, RadioButtonComponent } from '../../../shared/components/form-fields';
import { AppTranslations } from '../../../core/i18n/i18n.types';
import { ViewportService } from '../../../core/services/viewport.service';
import { MembreDto } from '../../../core/models/api.models';
import { TypeArgentPoche } from '../argent-poche.component';

/** Regroupement disponible pour la liste unique (politiques + allocations). */
export type RegroupementArgentPoche = 'MEMBRE' | 'TYPE' | 'MOIS_DEBUT';

/** Menu ouvert par la barre : pilote le contenu affiché dans le popover/drawer actif. */
type MenuActif = 'AUCUN' | 'REGROUPER' | 'FILTRES';

/**
 * Barre unique recherche + "Regrouper par" + "Filtres" pour l'écran Argent de
 * poche, sur le modèle de {@code PostesBarreFiltresComponent} (voir
 * `postes-liste/postes-barre-filtres`) : hauteur fixe, popover ancré sur
 * desktop, feuille du bas sur mobile (`ViewportService`). Composant purement
 * présentationnel : reçoit l'état courant (regroupement/filtres/recherche) et
 * émet les changements au parent (`argent-poche.component.ts`), seul
 * propriétaire de l'état.
 */
@Component({
  selector: 'app-argent-poche-barre-filtres',
  standalone: true,
  imports: [CommonModule, FormsModule, PopoverModule, DrawerModule, OverlayBadgeModule,
            IconFieldModule, InputIconModule, InputTextModule,
            ButtonComponent, CheckboxComponent, RadioButtonComponent],
  templateUrl: './argent-poche-barre-filtres.component.html',
})
export class ArgentPocheBarreFiltresComponent {
  readonly viewport = inject(ViewportService);
  readonly t = input.required<AppTranslations>();
  readonly String = String; // Exposition pour le template (interpolation des compteurs i18n)

  readonly regroupement = input.required<RegroupementArgentPoche>();
  readonly filtreTypes = input<TypeArgentPoche[]>([]);
  readonly filtreMembreIds = input<string[]>([]);
  readonly membres = input<MembreDto[]>([]);
  readonly recherche = input<string>('');
  readonly nbResultats = input<number>(0);

  readonly regroupementChange = output<RegroupementArgentPoche>();
  readonly filtreTypesChange = output<TypeArgentPoche[]>();
  readonly filtreMembreIdsChange = output<string[]>();
  readonly rechercheChange = output<string>();

  readonly regroupementOptions = () => [
    { label: this.t().argentPoche.regroupementOptions.MEMBRE, value: 'MEMBRE' as RegroupementArgentPoche },
    { label: this.t().argentPoche.regroupementOptions.TYPE, value: 'TYPE' as RegroupementArgentPoche },
    { label: this.t().argentPoche.regroupementOptions.MOIS_DEBUT, value: 'MOIS_DEBUT' as RegroupementArgentPoche },
  ];

  readonly typeOptions = () => [
    { label: this.t().argentPoche.typeOptions.POLITIQUE, value: 'POLITIQUE' as TypeArgentPoche },
    { label: this.t().argentPoche.typeOptions.ALLOCATION, value: 'ALLOCATION' as TypeArgentPoche },
  ];

  readonly nbFiltresActifs = () => this.filtreTypes().length + this.filtreMembreIds().length;

  /** Menu actuellement ouvert (desktop : popover ancré ; mobile : feuille du bas). */
  menuActif = signal<MenuActif>('AUCUN');

  /** Copie locale de la recherche, avec temporisation avant d'émettre le changement. */
  rechercheLocale = signal<string>('');
  private readonly _rechercheSync = effect(() => this.rechercheLocale.set(this.recherche()));

  constructor() {
    toObservable(this.rechercheLocale)
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(recherche => {
        if (recherche !== this.recherche()) this.rechercheChange.emit(recherche);
      });
  }

  effacerRecherche(): void {
    this.rechercheLocale.set('');
  }

  asRegroupement(value: string): RegroupementArgentPoche { return value as RegroupementArgentPoche; }
  asTypeArgentPoche(value: string): TypeArgentPoche { return value as TypeArgentPoche; }

  changerRegroupement(regrouperPar: RegroupementArgentPoche): void {
    this.regroupementChange.emit(regrouperPar);
  }

  private toggleDansListe<T>(liste: T[], valeur: T): T[] {
    return liste.includes(valeur) ? liste.filter(v => v !== valeur) : [...liste, valeur];
  }

  toggleType(valeur: TypeArgentPoche): void {
    this.filtreTypesChange.emit(this.toggleDansListe(this.filtreTypes(), valeur));
  }

  toggleMembre(id: string): void {
    this.filtreMembreIdsChange.emit(this.toggleDansListe(this.filtreMembreIds(), id));
  }

  effacerTousLesFiltres(): void {
    this.filtreTypesChange.emit([]);
    this.filtreMembreIdsChange.emit([]);
  }

  /** Élément qui a ouvert le menu actif : restaure le focus dessus à la fermeture. */
  private _elementDeclencheur: HTMLElement | null = null;

  ouvrirMenu(menu: MenuActif, event: Event, popoverRegrouper: { toggle: (e: Event) => void }, popoverFiltres: { toggle: (e: Event) => void }): void {
    this._elementDeclencheur = event.currentTarget as HTMLElement;
    if (this.viewport.estMobile()) {
      this.menuActif.set(menu);
      return;
    }
    this.menuActif.set(menu);
    if (menu === 'REGROUPER') popoverRegrouper.toggle(event);
    if (menu === 'FILTRES') popoverFiltres.toggle(event);
  }

  /** Restaure le focus sur le bouton déclencheur à la fermeture du popover/drawer. */
  private restaurerFocusDeclencheur(): void {
    this._elementDeclencheur?.focus();
    this._elementDeclencheur = null;
  }

  onPopoverHide(): void {
    this.menuActif.set('AUCUN');
    this.restaurerFocusDeclencheur();
  }

  fermerDrawerMobile(): void {
    this.menuActif.set('AUCUN');
    this.restaurerFocusDeclencheur();
  }
}
