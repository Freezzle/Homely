import { TauxEffortCardData, TauxEffortZone } from '../../../../shared/components/taux-effort-card/taux-effort-card.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';

/**
 * Vue prête à consommer par le template du drawer : 3 jauges (charges seules,
 * charges + réserves, charges + réserves + argent de poche) rendues chacune par une
 * `app-carte-info` + `app-indicateur-progression`, + éléments annexes (badge de zone
 * globale, message conseil). Zéro logique métier dans le template.
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
  /** Une jauge par carte empilée dans le drawer. */
  readonly jauges: readonly TauxEffortJaugeView[];
  /** Aria-label global du drawer (résumé accessible). */
  readonly ariaLabel: string;
  /** Ventilation textuelle affichée dans le bloc N/A. */
  readonly chargesTotal: number;
  readonly reservesTotal: number;
}

export interface TauxEffortJaugeView {
  readonly key: 'charges' | 'chargesReserves' | 'chargesReservesPoche';
  /** Titre de la carte (ex. « Taux d'effort (charges seules) »). */
  readonly titre: string;
  /** Taux formaté (ex. « 72 % »). */
  readonly tauxLabel: string;
  /** Montant cumulé consommé sur la période (part rouge de la barre). */
  readonly actuel: number;
  /** Revenus de la période (cible de la barre). */
  readonly cible: number;
  /** Part non consommée des revenus, bornée à 0 (part grise de la barre). */
  readonly reste: number;
  /** Texte affiché à droite quand les revenus sont entièrement absorbés. */
  readonly libelleAtteint: string;
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
  suffixeTitre: string,
  montant: number,
  revenus: number,
  t: AppTranslations,
): TauxEffortJaugeView {
  return {
    key,
    titre: `${t.projection.effortCardTitreSansNom} ${suffixeTitre}`,
    tauxLabel: formatTauxLabel(tauxDe(montant, revenus)),
    actuel: montant,
    cible: revenus,
    reste: Math.max(0, revenus - montant),
    libelleAtteint: t.projection.effortCardRevenusDepasses,
  };
}
export function buildTauxEffortDrawerView(
  data: TauxEffortCardData,
  t: AppTranslations,
): TauxEffortDrawerView {
  const indisponible = data.revenusTotal <= 0;
  const effortCharges = data.chargesTotal;
  const effortChargesReserves = data.chargesTotal + data.reservesTotal;
  const effortChargesReservesPoche = effortChargesReserves + data.argentPocheTotal;
  const tauxChargesReserves = tauxDe(effortChargesReserves, data.revenusTotal);
  const zoneGlobale = zoneDe(tauxChargesReserves);

  const jauges: TauxEffortJaugeView[] = indisponible ? [] : [
    construireJauge('charges', t.projection.effortCardTauxCharges, effortCharges, data.revenusTotal, t),
    construireJauge('chargesReserves', t.projection.effortCardTauxChargesReserves, effortChargesReserves, data.revenusTotal, t),
    construireJauge('chargesReservesPoche', t.projection.effortCardTauxChargesReservesPoche, effortChargesReservesPoche, data.revenusTotal, t),
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
