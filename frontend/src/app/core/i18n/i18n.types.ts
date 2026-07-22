// `import type` : uniquement utilisé pour dériver le type ci-dessous via `typeof`,
// aucune trace de cet import ne subsiste dans le JS émis (pas de duplication du JSON
// dans le bundle). Le JSON (assets/i18n/fr.json) reste la seule source de vérité en
// exécution, chargée à runtime par ngx-translate (TranslateHttpLoader).
import type frTranslations from '../../../assets/i18n/fr.json';

/**
 * Type de l'arbre de traductions chargé par ngx-translate, dérivé de
 * `assets/i18n/fr.json`. Donne l'autocomplétion/typage exact de
 * `I18nService.translations()` (ex. `t.nav.dashboardAnnuel`), sans dupliquer
 * la structure à la main comme le faisait l'ancien `type I18n = typeof FR`.
 */
export type AppTranslations = typeof frTranslations;
