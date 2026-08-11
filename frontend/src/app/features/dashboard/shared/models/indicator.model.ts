import { Type } from '@angular/core';
import { IconColor } from './icon-color.type';

/** Teinte du pill compteur d'une section de dashboard. */
export type SectionCountColor = 'default' | 'warn' | 'pos' | 'info';

/**
 * Déclaration d'affichage d'un indicateur : uniquement sa structure de carte + une
 * référence au composant de contenu du drawer. Aucune donnée métier n'est portée par
 * cette interface — c'est aux fonctions `xxxIndicator(...)` de chaque indicateur
 * concret de la remplir à partir de données déjà résolues.
 */
export interface Indicator {
  /** Identifiant technique de l'indicateur (analytics, deep-link, tracking @for). */
  key: string;

  // ─── Ce qui va sur la carte ───
  icon: string;
  /** Teinte fixe de la pastille d'icône — représente le symbole de l'indicateur,
   *  indépendante de la valeur courante (voir `infoColor` pour teinter la valeur). */
  iconColor: IconColor;
  title: string;
  subtitle?: string;
  info?: string;
  /** Teinte du texte de l'info principale (ex. rouge si zone critique). */
  infoColor?: IconColor;
  infoSubtitle?: string;

  // ─── Ce qui va dans le drawer ───
  /** Composant Angular monté dans le body du drawer. */
  drawerContent: Type<unknown>;
}

/** Groupement thématique de plusieurs indicateurs, rendu par `DashboardSectionComponent`. */
export interface IndicatorSection {
  /** Titre de la section (question utilisateur). */
  title: string;
  /** Teinte du compteur affiché dans l'en-tête de section. */
  countColor?: SectionCountColor;
  /** Indicateurs listés dans cette section. */
  indicators: Indicator[];
}

/** Une structure de dashboard = liste ordonnée de sections. */
export type DashboardLayout = IndicatorSection[];
