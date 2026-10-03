import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ViewportService } from '../../../core/services/viewport.service';

export interface DashboardView {
  key: 'apercu' | 'comptes' | 'postes' | 'membres';
  label: string;
  icon: string;
  badge?: number;
}

type DashboardViewKey = DashboardView['key'];

interface DashboardIconPaths {
  secondary: string;
  primary: string;
}

// Inline bichrome SVGs keep the "icon sprite name" contract from the spec without adding a global icon registry.
const VIEW_SWITCHER_ICONS: Record<DashboardViewKey, DashboardIconPaths> = {
  apercu: {
    secondary: 'M6 17.5a6 6 0 0 1 12 0Z',
    primary: 'M12 5.5A11.5 11.5 0 0 0 .5 17a1 1 0 0 0 1 1h3.2a1 1 0 0 0 0-2H2.55a9.5 9.5 0 0 1 18.9 0h-2.15a1 1 0 1 0 0 2h3.2a1 1 0 0 0 1-1A11.5 11.5 0 0 0 12 5.5Zm4.9 4.9-4.3 4.1a2.1 2.1 0 1 0 1.6 1.6l4.1-4.3a1 1 0 0 0-1.4-1.4Z',
  },
  comptes: {
    secondary: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H18a3 3 0 0 1 3 3v2.25h-3a2.75 2.75 0 0 0 0 5.5h3V17a3 3 0 0 1-3 3H5.5A2.5 2.5 0 0 1 3 17.5v-10Z',
    primary: 'M5.5 4A3.5 3.5 0 0 0 2 7.5v10A3.5 3.5 0 0 0 5.5 21H18a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4H5.5Zm0 2H18a2 2 0 0 1 2 2v1.25h-2a3.75 3.75 0 0 0 0 7.5h2V17a2 2 0 0 1-2 2H5.5A1.5 1.5 0 0 1 4 17.5v-10A1.5 1.5 0 0 1 5.5 6Zm12.5 5.25a1.75 1.75 0 0 0 0 3.5h3v-3.5h-3Zm-.25 1.75a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Z',
  },
  postes: {
    secondary: 'M4 5.75A1.75 1.75 0 0 1 5.75 4h12.5A1.75 1.75 0 0 1 20 5.75v3.5A1.75 1.75 0 0 1 18.25 11H5.75A1.75 1.75 0 0 1 4 9.25v-3.5Zm0 9A1.75 1.75 0 0 1 5.75 13h5.5A1.75 1.75 0 0 1 13 14.75v3.5A1.75 1.75 0 0 1 11.25 20h-5.5A1.75 1.75 0 0 1 4 18.25v-3.5Z',
    primary: 'M5.75 3A2.75 2.75 0 0 0 3 5.75v3.5A2.75 2.75 0 0 0 5.75 12h12.5A2.75 2.75 0 0 0 21 9.25v-3.5A2.75 2.75 0 0 0 18.25 3H5.75Zm0 2h12.5c.41 0 .75.34.75.75v3.5a.75.75 0 0 1-.75.75H5.75A.75.75 0 0 1 5 9.25v-3.5c0-.41.34-.75.75-.75ZM15.5 14a1 1 0 0 1 1.18-.98 6.01 6.01 0 0 1 4.8 4.8 1 1 0 0 1-1.96.39 4.01 4.01 0 0 0-3.23-3.23A1 1 0 0 1 15.5 14Zm-9.75-1A2.75 2.75 0 0 0 3 15.75v2.5A2.75 2.75 0 0 0 5.75 21h5.5A2.75 2.75 0 0 0 14 18.25v-2.5A2.75 2.75 0 0 0 11.25 13h-5.5Zm0 2h5.5c.41 0 .75.34.75.75v2.5a.75.75 0 0 1-.75.75h-5.5a.75.75 0 0 1-.75-.75v-2.5c0-.41.34-.75.75-.75Z',
  },
  membres: {
    secondary: 'M7.5 11a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm9 1a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM2.75 19a4.75 4.75 0 0 1 9.5 0v1h-9.5v-1Zm10.5 1v-.75a4.6 4.6 0 0 0-1.2-3.08A4.23 4.23 0 0 1 20.5 19v1h-7.25Z',
    primary: 'M7.5 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm9-1a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM7.5 13A5.75 5.75 0 0 0 1.75 18.75V20A2 2 0 0 0 3.75 22h7.5a2 2 0 0 0 2-2v-1.25A5.75 5.75 0 0 0 7.5 13Zm0 2a3.75 3.75 0 0 1 3.75 3.75V20h-7.5v-1.25A3.75 3.75 0 0 1 7.5 15Zm8.75-1a5.72 5.72 0 0 0-3.02.86 6.72 6.72 0 0 1 2.02 4.89V22h5a2 2 0 0 0 2-2v-.75A5.25 5.25 0 0 0 16.25 14Zm0 2a3.25 3.25 0 0 1 4 3.17V20h-3v-.25a8.67 8.67 0 0 0-1.16-4.31c.06-.02.11-.04.16-.06Z',
  },
};

@Component({
  selector: 'hly-view-switcher',
  standalone: true,
  imports: [TooltipModule],
  templateUrl: './view-switcher.component.html',
  styleUrl: './view-switcher.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewSwitcherComponent {
  protected readonly i18n = inject(I18nService);
  private readonly viewport = inject(ViewportService);

  readonly views = input.required<DashboardView[]>();
  readonly active = input.required<DashboardViewKey>();
  readonly activeChange = output<DashboardViewKey>();

  protected readonly afficheLibelle = computed(() => !this.viewport.estMobile());

  protected readonly toolbarLabel = computed(() => this.views().map((view) => view.label).join(' • '));

  protected select(key: DashboardViewKey): void {
    if (key === this.active()) {
      return;
    }
    this.activeChange.emit(key);
  }

  protected isActive(key: DashboardViewKey): boolean {
    return this.active() === key;
  }

  protected iconFor(view: DashboardView): DashboardIconPaths {
    return VIEW_SWITCHER_ICONS[this.resolveIconKey(view)];
  }

  protected hasBadge(badge: number | undefined): boolean {
    return badge != null && badge > 0;
  }

  protected badgeLabel(badge: number | undefined): string {
    if (!this.hasBadge(badge)) {
      return '';
    }
    return badge! > 99 ? '99+' : `${badge!}`;
  }

  private resolveIconKey(view: DashboardView): DashboardViewKey {
    const key = view.icon as DashboardViewKey;
    return key in VIEW_SWITCHER_ICONS ? key : view.key;
  }
}
