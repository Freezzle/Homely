import { Injectable, signal, Type } from '@angular/core';

/** Options d'ouverture du drawer d'indicateur. */
export interface DrawerOpenOptions<TData = unknown> {
  /** Libellé de la section (badge au-dessus du titre du drawer). */
  sectionLabel: string;
  /** Titre du drawer (identique au titre de la carte cliquée). */
  title: string;
  /** Composant à rendre dans le body du drawer. */
  content: Type<unknown>;
  /**
   * Payload optionnel transmis au composant de contenu via son input `data` (convention :
   * le composant de contenu déclare `readonly data = input<TData>()`). Extension au guide
   * d'origine, nécessaire pour éviter que chaque contenu de drawer doive ré-interroger les
   * services métier alors que les données sont déjà résolues côté dashboard.
   */
  data?: TData;
}

/**
 * État du drawer d'indicateur partagé, monté une seule fois par dashboard. Cliquer une
 * carte appelle `open(...)` ; le drawer instancie dynamiquement le composant de contenu
 * via `NgComponentOutlet` et lui transmet `data()` comme input.
 */
@Injectable({ providedIn: 'root' })
export class IndicatorDrawerService {
  readonly isOpen = signal(false);
  readonly sectionLabel = signal('');
  readonly title = signal('');
  readonly content = signal<Type<unknown> | null>(null);
  readonly data = signal<unknown>(undefined);

  open<TData>(options: DrawerOpenOptions<TData>): void {
    this.sectionLabel.set(options.sectionLabel);
    this.title.set(options.title);
    this.content.set(options.content);
    this.data.set(options.data);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    // Différer la remise à null du contenu pour éviter le flash de fermeture (animation du drawer).
    setTimeout(() => {
      this.content.set(null);
      this.data.set(undefined);
    }, 300);
  }
}
