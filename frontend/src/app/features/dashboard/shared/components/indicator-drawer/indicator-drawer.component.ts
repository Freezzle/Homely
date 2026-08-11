import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { IndicatorDrawerService } from '../../services/indicator-drawer.service';

/**
 * Drawer latéral partagé, monté une seule fois par dashboard. Réutilise `p-drawer` pour
 * la mécanique d'ouverture/accessibilité/animation ; habille l'intérieur avec un en-tête
 * (libellé de section + titre) et un pied propres à l'app. Le contenu est un composant
 * dynamique injecté via `NgComponentOutlet`, alimenté par `IndicatorDrawerService`.
 */
@Component({
  selector: 'app-indicator-drawer',
  standalone: true,
  imports: [DrawerModule, ButtonModule, NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './indicator-drawer.component.html',
  styleUrl: './indicator-drawer.component.scss',
})
export class IndicatorDrawerComponent {
  protected readonly drawer = inject(IndicatorDrawerService);

  /** Inputs transmis au composant de contenu dynamique (convention : input `data`). */
  protected readonly contentInputs = computed(() => ({ data: this.drawer.data() }));

  onVisibleChange(visible: boolean): void {
    if (!visible) this.drawer.close();
  }
}
