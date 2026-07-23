import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject, LOCALE_ID } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Theme from '@primeuix/themes/aura';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { dateInterceptor } from './core/interceptors/date.interceptor';
import { registerLocaleData } from '@angular/common';
import localeFrCH from '@angular/common/locales/fr-CH';
import localeFrCHExtra from '@angular/common/locales/extra/fr-CH';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { firstValueFrom } from 'rxjs';
import { langueInitiale } from './core/i18n/i18n.service';

registerLocaleData(localeFrCH, 'fr-CH', localeFrCHExtra);

// Langue choisie par l'utilisateur lors d'une session précédente (préférence UI
// persistée en localStorage), ou 'fr' par défaut — voir I18nService.setLanguage().
const langueDemarrage = langueInitiale();

const semantic = Theme.semantic ?? {};
const colorScheme = semantic.colorScheme ?? {};
const light = colorScheme.light ?? {};
const dark = colorScheme.dark ?? {};

const SohoPreset = {
  ...Theme,
  semantic: {
    ...semantic,
    colorScheme: {
      ...colorScheme,
      // Surface Soho (gris neutres) pour rester cohérent avec les utilitaires bg-surface-*.
      light: {
        ...light,
        surface: {
          0: '#ffffff',
          50: '#f7f7f7',
          100: '#efefef',
          200: '#e2e2e2',
          300: '#d0d0d0',
          400: '#b7b7b7',
          500: '#8f8f8f',
          600: '#6b6b6b',
          700: '#4f4f4f',
          800: '#3a3a3a',
          900: '#262626',
          950: '#141414',
        },
      },
      dark: {
        ...dark,
        surface: {
          0: '#ffffff',
          50: '#f5f5f5',
          100: '#e6e6e6',
          200: '#d1d1d1',
          300: '#b3b3b3',
          400: '#8c8c8c',
          500: '#6b6b6b',
          600: '#4f4f4f',
          700: '#3a3a3a',
          800: '#2b2b2b',
          900: '#1f1f1f',
          950: '#141414',
        },
      },
    },
  },
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    // dateInterceptor en premier : les intercepteurs suivants (jwt, etc.) voient
    // le body déjà normalisé (Date → ISO wall-clock local marqué UTC).
    provideHttpClient(withInterceptors([dateInterceptor, jwtInterceptor])),
    provideAnimationsAsync(),
    { provide: LOCALE_ID, useValue: 'fr-CH' },
    // i18n : traductions chargées depuis assets/i18n/<lang>.json (ngx-translate).
    // FR par défaut/fallback ; démarre sur la langue persistée si l'utilisateur en a choisi une.
    provideTranslateService({
      lang: langueDemarrage,
      fallbackLang: 'fr',
      loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' }),
    }),
    // Attend le chargement des traductions avant le premier rendu (évite un flash de clés brutes).
    provideAppInitializer(() => firstValueFrom(inject(TranslateService).use(langueDemarrage))),
    providePrimeNG({
      license: 'eyJpZCI6IjY0ODZiNDE2LWIwYmEtNGQwNC05MzJiLTExNGRlMjk5N2I4OCIsInByb2R1Y3QiOiJwcmltZXVpIiwidGllciI6ImNvbW11bml0eSIsInR5cGUiOiJkZXYiLCJpYXQiOjE3ODQ0NzU4MTIsImV4cCI6MTgxNjAxMTgxMn0.wIoIS_g63WBgx6HVxpqchtgndwzbltV-IAwPQ0tp_Zb3qnf0p0MKwJXs0CeSX7HXzKRzYIUbzucYcLIt2VDjBA',
      theme: {
        preset: SohoPreset,
        options: {
          darkModeSelector: '.dark',
          cssLayer: {
            name: 'primeng',
            // Ordre aligné sur styles.css :
            // base (reset Tailwind) → primeng (composants) → utilities (utilitaires Tailwind)
            order: 'theme, base, primeng, components, utilities',
          },
        },
      },
      ripple: true,
    }),
  ],
};
