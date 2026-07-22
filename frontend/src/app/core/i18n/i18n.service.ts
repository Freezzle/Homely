import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { InterpolationParameters } from '@ngx-translate/core';
import { AppTranslations } from './i18n.types';

/** Langues disponibles dans l'application. */
export const LANGUES_DISPONIBLES = ['fr', 'en'] as const;
export type Langue = (typeof LANGUES_DISPONIBLES)[number];

/**
 * Clé de persistance de la langue choisie par l'utilisateur (préférence UI pure,
 * pas de donnée métier — au même titre qu'un thème clair/sombre). Exportée pour
 * être lue par `app.config.ts` au bootstrap, avant que l'injection de dépendances
 * ne soit disponible.
 */
const LANG_STORAGE_KEY = 'homely-lang';

/** Lit la langue précédemment choisie (localStorage), ou 'fr' par défaut. */
export function langueInitiale(): Langue {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(LANG_STORAGE_KEY) : null;
  return LANGUES_DISPONIBLES.includes(stored as Langue) ? (stored as Langue) : 'fr';
}

/**
 * Point d'entrée unique pour la gestion de la langue de l'application.
 * Fine couche au-dessus de TranslateService (ngx-translate).
 *
 * Note d'architecture : les composants exposent leurs traductions via un
 * instantané non réactif (`readonly t = this.i18n.translations();`), pris une
 * fois à la construction — cohérent avec le pattern déjà en place lors de la
 * migration initiale. Changer de langue en cours de session ne rafraîchit donc
 * pas le texte déjà affiché : `setLanguage()` persiste le choix puis recharge
 * la page, ce qui reconstruit tous les composants avec la bonne langue sans
 * avoir à rendre chaque `t.x.y` réactif dans toute l'application.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly translate = inject(TranslateService);

  /** Langues proposées dans le sélecteur de langue. */
  readonly availableLangs = LANGUES_DISPONIBLES;

  /** Langue courante (signal), ex. 'fr'. */
  readonly currentLang = this.translate.currentLang;

  /** Change la langue active de l'application (chargement immédiat du JSON). */
  use(lang: string) {
    return this.translate.use(lang);
  }

  /**
   * Change durablement la langue de l'utilisateur : persiste son choix puis
   * recharge la page pour que tous les composants (menus, options, libellés
   * calculés une seule fois à la construction) repartent avec les bonnes
   * traductions.
   */
  setLanguage(lang: Langue) {
    if (lang === this.translate.currentLang()) {
      return;
    }
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    location.reload();
  }

  /**
   * Instantané complet des traductions chargées pour une langue (par défaut la
   * langue courante). Équivalent de l'ancien objet `FR` : permet aux composants
   * de faire `t.nav.xxx` sans multiplier les appels `| translate` pour des clés
   * statiques (le contenu vient toujours du JSON, pas du code).
   */
  translations(lang?: string): AppTranslations {
    return this.translate.getTranslations(lang ?? this.translate.currentLang() ?? 'fr') as AppTranslations;
  }

  /**
   * Traduction instantanée d'une clé avec interpolation de paramètres
   * (ex. `instant('foyer.onboarding.defaults.membreNomTemplate', { index: 2 })`
   * → « Membre 2 »). Remplace l'ancien helper maison `format()`.
   */
  instant(key: string, params?: InterpolationParameters): string {
    return this.translate.instant(key, params);
  }
}
