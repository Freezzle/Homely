import {
  IndicatorMarker,
  IndicatorSegment,
  IndicatorTick,
} from '../../../../shared/components/indicator-bar/indicator-bar.model';
import { TauxEffortCardData, TauxEffortZone } from '../../../../shared/components/taux-effort-card/taux-effort-card.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';

/**
 * Vue prête à consommer par le template du drawer : 3 jauges (charges seules,
 * charges + réserves, charges + réserves + argent de poche) + éléments annexes
 * (badge de zone globale, message conseil). Zéro logique métier dans le template.
 *
 * NB : cible fonctionnelle identique à `TauxEffortCardComponent` (mêmes seuils
 * hardcodés 75/90/95 pour rester iso-comportement — le composant historique
 * reste en place tant qu'on n'a pas confirmé la parité).
 */
export interface TauxEffortDrawerView {
  /** True si `revenusTotal <= 0` : le template affiche alors le bloc N/A. */
  readonly indisponible: boolean;
  readonly membre: TauxEffortCardData['membre'];
  /** Zone du taux d'effort principal (charges + réserves) — pilote le badge et le message. */
  readonly zoneGlobale: TauxEffortZone;
  readonly zoneGlobaleLabel: string;
  readonly zoneGlobaleSeverity: 'success' | 'info' | 'warn' | 'danger';
  /** Conseil affiché sous les 3 cartes (null pour CONFORTABLE et CORRECT). */
  readonly message: string | null;
  /** Une jauge par card empilée dans le drawer. */
  readonly jauges: readonly TauxEffortJaugeView[];
  /** Aria-label global du drawer (résumé accessible). */
  readonly ariaLabel: string;
  /** Ventilation textuelle affichée dans le bloc N/A. */
  readonly chargesTotal: number;
  readonly reservesTotal: number;
}

export interface TauxEffortJaugeView {
  readonly key: 'charges' | 'chargesReserves' | 'chargesReservesPoche';
  readonly titre: string;
  readonly sousTitre: string;
  /** Taux formaté (ex. « 72 % »). */
  readonly tauxLabel: string;
  readonly segments: IndicatorSegment[];
  readonly ticks: IndicatorTick[];
  readonly markers: IndicatorMarker[];
  readonly ariaLabel: string;
}

/** Seuils de zone (points de %) — alignés sur `TauxEffortCardComponent` historique. */
const SEUIL_CORRECT = 75;
const SEUIL_TENDU = 90;
const SEUIL_SATURE = 95;

const SEVERITY_PAR_ZONE: Record<TauxEffortZone, 'success' | 'info' | 'warn' | 'danger'> = {
  CONFORTABLE: 'success',
  CORRECT: 'info',
  TENDU: 'warn',
  SATURE: 'danger',
};

/** Couleurs des marqueurs (bulle + tige) par zone — alignées sur la couleur du
 *  segment de fond de la même zone (matching visuel strict). */
const COULEUR_MARQUEUR_PAR_ZONE: Record<TauxEffortZone, string> = {
  CONFORTABLE: 'var(--p-green-500)',
  CORRECT: 'var(--app-warning)',
  TENDU: 'var(--app-alert)',
  SATURE: 'var(--app-danger)',
};

/** Segments de fond communs aux 3 barres (mêmes teintes que la carte historique,
 *  saturation portée à 80 % pour meilleure lisibilité — la barre de remplissage
 *  historique n'existe plus, donc le fond n'a plus besoin d'être effacé). */
const SEGMENTS_ZONES: IndicatorSegment[] = [
  { widthPercent: SEUIL_CORRECT, color: 'color-mix(in srgb, var(--p-green-400) 80%, transparent)' },
  { widthPercent: SEUIL_TENDU - SEUIL_CORRECT, color: 'color-mix(in srgb, var(--app-warning) 80%, transparent)' },
  { widthPercent: SEUIL_SATURE - SEUIL_TENDU, color: 'color-mix(in srgb, var(--app-alert) 80%, transparent)' },
  { widthPercent: 100 - SEUIL_SATURE, color: 'color-mix(in srgb, var(--app-danger) 80%, transparent)' },
];

/** Ticks communs. Le CSS responsive masque les intermédiaires sur mobile. */
const TICKS_ZONES: IndicatorTick[] = [
  { positionPercent: 0, label: '0' },
  { positionPercent: SEUIL_CORRECT, label: String(SEUIL_CORRECT) },
  { positionPercent: SEUIL_TENDU, label: String(SEUIL_TENDU) },
  { positionPercent: SEUIL_SATURE, label: String(SEUIL_SATURE) },
  { positionPercent: 100, label: '100' },
];

function zoneDe(taux: number): TauxEffortZone {
  if (taux < SEUIL_CORRECT) return 'CONFORTABLE';
  if (taux < SEUIL_TENDU) return 'CORRECT';
  if (taux < SEUIL_SATURE) return 'TENDU';
  return 'SATURE';
}

function tauxDe(numerateur: number, revenus: number): number {
  if (revenus <= 0) return 0;
  return (numerateur / revenus) * 100;
}

function formatTauxLabel(taux: number): string {
  return `${taux.toFixed(0)} %`;
}

function libelleZone(zone: TauxEffortZone, t: AppTranslations): string {
  switch (zone) {
    case 'CONFORTABLE': return t.projection.effortCardZoneConfortable;
    case 'CORRECT': return t.projection.effortCardZoneCorrect;
    case 'TENDU': return t.projection.effortCardZoneTendu;
    case 'SATURE': return t.projection.effortCardZoneSature;
  }
}

function messageZone(zone: TauxEffortZone, t: AppTranslations): string | null {
  switch (zone) {
    case 'TENDU': return t.projection.effortCardMessageTendu;
    case 'SATURE': return t.projection.effortCardMessageSature;
    default: return null;
  }
}

function construireJauge(
  key: TauxEffortJaugeView['key'],
  titre: string,
  sousTitre: string,
  taux: number,
  ariaLabel: string,
): TauxEffortJaugeView {
  const zone = zoneDe(taux);
  const position = Math.min(100, Math.max(0, taux));
  const label = formatTauxLabel(taux);
  const markers: IndicatorMarker[] = [{
    positionPercent: position,
    label,
    kind: 'primary',
    color: COULEUR_MARQUEUR_PAR_ZONE[zone],
    a11yLabel: ariaLabel,
  }];
  return {
    key,
    titre,
    sousTitre,
    tauxLabel: label,
    segments: SEGMENTS_ZONES,
    ticks: TICKS_ZONES,
    markers,
    ariaLabel,
  };
}

export function buildTauxEffortDrawerView(
  data: TauxEffortCardData,
  t: AppTranslations,
): TauxEffortDrawerView {
  const indisponible = data.revenusTotal <= 0;
  const tauxCharges = tauxDe(data.chargesTotal, data.revenusTotal);
  const tauxChargesReserves = tauxDe(data.chargesTotal + data.reservesTotal, data.revenusTotal);
  const tauxChargesReservesPoche = tauxDe(
    data.chargesTotal + data.reservesTotal + data.argentPocheTotal,
    data.revenusTotal,
  );
  const zoneGlobale = zoneDe(tauxChargesReserves);

  const jauges: TauxEffortJaugeView[] = indisponible ? [] : [
    construireJauge(
      'charges',
      t.projection.effortCardTauxCharges,
      formatTauxLabel(tauxCharges),
      tauxCharges,
      `${t.projection.effortCardTauxCharges} : ${formatTauxLabel(tauxCharges)}`,
    ),
    construireJauge(
      'chargesReserves',
      t.projection.effortCardTauxChargesReserves,
      formatTauxLabel(tauxChargesReserves),
      tauxChargesReserves,
      `${t.projection.effortCardTauxChargesReserves} : ${formatTauxLabel(tauxChargesReserves)}`,
    ),
    construireJauge(
      'chargesReservesPoche',
      t.projection.effortCardTauxChargesReservesPoche,
      formatTauxLabel(tauxChargesReservesPoche),
      tauxChargesReservesPoche,
      `${t.projection.effortCardTauxChargesReservesPoche} : ${formatTauxLabel(tauxChargesReservesPoche)}`,
    ),
  ];

  const ariaLabel = indisponible
    ? `${t.projection.effortCardTitrePrefixe} ${data.membre.nom} : ${t.projection.effortCardZoneNA}.`
    : (t.projection.effortCardAriaLabel
        .replace('{{nom}}', data.membre.nom)
        .replace('{{taux}}', tauxChargesReserves.toFixed(0))
        .replace('{{zone}}', libelleZone(zoneGlobale, t))
        // On n'affiche plus le pire cas ; on garde la structure de la clé i18n en
        // reprenant la valeur courante pour ne pas casser l'existant.
        .replace('{{tauxPireCas}}', tauxChargesReserves.toFixed(0)));

  return {
    indisponible,
    membre: data.membre,
    zoneGlobale,
    zoneGlobaleLabel: libelleZone(zoneGlobale, t),
    zoneGlobaleSeverity: SEVERITY_PAR_ZONE[zoneGlobale],
    message: messageZone(zoneGlobale, t),
    jauges,
    ariaLabel,
    chargesTotal: data.chargesTotal,
    reservesTotal: data.reservesTotal,
  };
}
