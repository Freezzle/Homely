import { Type } from '@angular/core';
import { TonCarte, TonIndicateur } from '../../../../shared/components/indicateurs/tons';
import { SegmentBarreEmpilee } from '../../../../shared/components/indicateurs/barre-empilee/indicateur-barre-empilee.component';
import { EtapeEntonnoir } from '../../../../shared/components/indicateurs/entonnoir/indicateur-entonnoir.component';
import { SegmentGaufre } from '../../../../shared/components/indicateurs/gaufre/indicateur-gaufre.component';
import { CelluleHeatmap, EntreeLegendeHeatmap } from '../../../../shared/components/indicateurs/heatmap/indicateur-heatmap.component';

/**
 * Visuel affiché dans le corps de la carte d'un indicateur — union discriminée vers les
 * indicateurs partagés `app-indicateur-*` (voir `CarteIndicateurComponent`). Toutes les
 * valeurs sont déjà calculées/formatées par la fonction `xxxIndicator(...)`.
 */
export type VisuelIndicateur =
  | { type: 'heatmap'; cellules: CelluleHeatmap[]; legende: EntreeLegendeHeatmap[] }
  | { type: 'barre-empilee'; segments: SegmentBarreEmpilee[] }
  /** Plusieurs barres empilées libellées, comparables entre elles (ex. appliqué vs théorique). */
  | { type: 'barres-empilees'; barres: { libelle: string; segments: SegmentBarreEmpilee[] }[] }
  | { type: 'gaufre'; segments: SegmentGaufre[]; total: number }
  /** Barre `actuel / cible` : part consommée (`ton`) sur une piste représentant le reste (`tonPiste`). */
  | {
      type: 'progression';
      actuel: number;
      cible: number;
      ton: TonIndicateur;
      /** Ton une fois la cible atteinte (défaut `succes` côté composant). */
      tonAtteint?: TonIndicateur;
      /** Ton de la piste, c.-à-d. de la part restante (défaut `neutre`). */
      tonPiste?: TonIndicateur;
      actuelAffiche: string;
      cibleAffichee: string;
      resteAffiche: string;
      libelleAtteint?: string;
    }
  | { type: 'entonnoir'; etapes: EtapeEntonnoir[] }
  | { type: 'sparkline'; serie: number[]; valeur: string; delta: number; ton?: TonIndicateur }
  /** Valeur clé + badge de variation vs période précédente (`delta` null = pas de référence). */
  | {
      type: 'nombre-tendance';
      valeur: string;
      unite?: string;
      delta: number | null;
      libelleComparaison?: string;
      deltaNeutre?: boolean;
      formateurDelta?: (delta: number) => string;
    }
  /** Aucune donnée exploitable sur la période : message atténué à la place du visuel. */
  | { type: 'vide'; message: string };

/**
 * Déclaration d'affichage d'un indicateur : structure de sa carte (`app-carte-info` +
 * visuel) + une référence au composant de contenu du drawer. Aucune donnée métier n'est
 * portée par cette interface — c'est aux fonctions `xxxIndicator(...)` de chaque
 * indicateur concret de la remplir à partir de données déjà résolues.
 */
export interface Indicator {
  /** Identifiant technique de l'indicateur (analytics, deep-link, tracking @for). */
  key: string;

  // ─── Ce qui va sur la carte ───
  title: string;
  /** Texte de l'infobulle d'aide de la carte. */
  subtitle?: string;
  /** Valeur clé affichée en badge dans l'en-tête de la carte. */
  badgeTexte?: string;
  /** Couleur du badge (ex. `danger` si zone critique). Absent = texte atténué. */
  badgeTon?: TonCarte;
  visuel: VisuelIndicateur;

  // ─── Ce qui va dans le drawer ───
  /** Composant Angular monté dans le body du drawer. */
  drawerContent: Type<unknown>;
}

/** Couple indicateur + payload transmis au drawer à l'ouverture. */
export interface IndicatorItem {
  indicator: Indicator;
  data: unknown;
}
