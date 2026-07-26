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

  userMenuItems: MenuItem[] = [
    { label: this.t.auth.logout, icon: 'pi pi-sign-out', command: () => this.auth.deconnecter() },
  ];

  ngOnInit(): void {
    // Chargement des foyers/scénarios délégué à FoyerScenarioSwitcherComponent.
  }

  basculerLangue(): void {
    const prochaine = this.i18n.currentLang() === 'en' ? 'fr' : 'en';
    this.i18n.setLanguage(prochaine);
  }
}
