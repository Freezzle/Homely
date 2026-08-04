import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { MenuModule } from 'primeng/menu';
import { SidebarModule } from 'primeng/sidebar';
import { MenuItem } from 'primeng/api';
import { ContexteService } from '../../core/services/contexte.service';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { FoyerScenarioSwitcherComponent } from '../foyer-scenario-switcher/foyer-scenario-switcher.component';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, AvatarModule, MenuModule, SidebarModule, FoyerScenarioSwitcherComponent],
  templateUrl: './topbar.component.html',
})
export class TopbarComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private auth = inject(AuthService);

  // Visibilité de la dialogue de sélection foyer/scénario.
  readonly switcherVisible = signal(false);

  // Libellé texte affiché à la place des anciens selects : "Foyer · Scénario".
  readonly libelleContexte = computed(() => {
    const foyer = this.contexte.foyerCourant();
    const scenario = this.contexte.scenarioCourant();
    if (!foyer) {
      return '';
    }
    return scenario ? `${foyer.nom} · ${scenario.nom}` : foyer.nom;
  });

  // Icône radio (pi-check) toujours présente pour aligner les libellés entre items
  // sélectionné/non sélectionné ; seule sa visibilité (iconClass) est togglée, car
  // PrimeNG ne rend le <span> icône que si `item.icon` est renseigné.
  private static readonly ICONE_RADIO = 'pi pi-check';
  private static readonly ICONE_RADIO_MASQUEE = 'invisible';

  private static classeIconeRadio(selectionne: boolean): string | undefined {
    return selectionne ? undefined : TopbarComponent.ICONE_RADIO_MASQUEE;
  }

  // Références directes aux items pour pouvoir togguer leur icône dans les commands
  // (le modèle est muté en place plutôt que recalculé, cf. plan).
  private readonly itemLangueFr: MenuItem = {
    label: this.t.commun.langueFrancais,
    icon: TopbarComponent.ICONE_RADIO,
    iconClass: TopbarComponent.classeIconeRadio(this.i18n.currentLang() === 'fr'),
    command: () => this.choisirLangue('fr'),
  };
  private readonly itemLangueEn: MenuItem = {
    label: this.t.commun.langueAnglais,
    icon: TopbarComponent.ICONE_RADIO,
    iconClass: TopbarComponent.classeIconeRadio(this.i18n.currentLang() === 'en'),
    command: () => this.choisirLangue('en'),
  };
  private readonly itemModeLumineux: MenuItem = {
    label: this.t.commun.modeLumineux,
    icon: TopbarComponent.ICONE_RADIO,
    iconClass: TopbarComponent.classeIconeRadio(!this.contexte.isDark()),
    command: () => this.choisirMode(false),
  };
  private readonly itemModeSombre: MenuItem = {
    label: this.t.commun.modeSombre,
    icon: TopbarComponent.ICONE_RADIO,
    iconClass: TopbarComponent.classeIconeRadio(this.contexte.isDark()),
    command: () => this.choisirMode(true),
  };

  userMenuItems: MenuItem[] = [
    { label: this.t.commun.groupeLangue, items: [this.itemLangueFr, this.itemLangueEn] },
    { separator: true },
    { label: this.t.commun.groupeMode, items: [this.itemModeLumineux, this.itemModeSombre] },
    { separator: true },
    { label: this.t.auth.logout, icon: 'pi pi-sign-out', command: () => this.auth.deconnecter() },
  ];

  ngOnInit(): void {
    // Chargement des foyers/scénarios délégué à FoyerScenarioSwitcherComponent.
  }

  /** Sélectionne la langue et met à jour l'icône radio (persist + reload géré par I18nService). */
  private choisirLangue(langue: 'fr' | 'en'): void {
    this.itemLangueFr.iconClass = TopbarComponent.classeIconeRadio(langue === 'fr');
    this.itemLangueEn.iconClass = TopbarComponent.classeIconeRadio(langue === 'en');
    this.i18n.setLanguage(langue);
  }

  /** Bascule le thème clair/sombre et met à jour l'icône radio des deux items. */
  private choisirMode(dark: boolean): void {
    if (dark !== this.contexte.isDark()) {
      this.contexte.toggleDark();
    }
    this.itemModeLumineux.iconClass = TopbarComponent.classeIconeRadio(!dark);
    this.itemModeSombre.iconClass = TopbarComponent.classeIconeRadio(dark);
  }
}
