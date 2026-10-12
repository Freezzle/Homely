import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { MetricRingSegment } from '../metric-ring/metric-ring.component';
import { MetricBarComponent, MetricBarSegment } from '../metric-bar/metric-bar.component';
import { formatTaux } from '../../utils/format-taux.util';
import { TagComponent } from '../tag/tag.component';
import { couleurPleine, TonCarte } from '../indicateurs/tons';

/**
 * Tons des 3 montants de l'indicateur « Plaisirs vs Besoins ». **Identiques à ceux de la
 * carte** (`besoinsPlaisirsIndicator`) : une grandeur garde le même ton entre la carte et
 * son drawer. La zone (maîtrisée / élevée) n'est donc pas portée par les couleurs des
 * segments, mais par le tag d'en-tête et le message de conseil.
 */
const TON_BESOINS = couleurPleine('charge');
const TON_PLAISIRS = couleurPleine('argent-poche');
const TON_RESTE = couleurPleine('neutre');

/** Zone du taux, sur la part des charges **Besoins** dans le budget global (revenus
 *  totaux) — seuil {@link BesoinsPlaisirsCardComponent.SEUIL_ZONE_ELEVEE_BUDGET} (50 %,
 *  repère classique "besoins ≤ 50 % du budget"). Pilote le tag d'en-tête, le message et
 *  l'indicateur-card du dashboard (voir `besoinsPlaisirsIndicator`). C'est la lecture qui
 *  intéresse l'utilisateur : combien de place les charges de nécessité prennent-elles dans
 *  son budget, avant plaisirs et épargne ?
 *
 *  La zone ne teinte **aucun** segment : les couleurs des montants restent celles de la
 *  charte (voir `TON_BESOINS`/`TON_PLAISIRS`/`TON_RESTE`). */
export type BesoinsPlaisirsZone = 'ELEVE' | 'MAITRISE';

/** Un poste classé "Besoin" affiché dans le détail sous les stats de la carte — reprend
 *  directement la forme du DTO serveur ({@code BesoinsPlaisirsDto.postesBesoins}). */
export interface PosteBesoinCardItem {
  description: string;
  necessite: number;
  montant: number;
}

/** Données brutes d'entrée de la carte — le composant calcule lui-même les taux de
 *  plaisirs (charges et budget), les zones et l'espace budgétaire. Purement
 *  présentationnel : aucune injection de service métier, aucun accès store (même
 *  convention que `TauxEffortCardComponent`). */
export interface BesoinsPlaisirsCardData {
  /** Somme des charges de nécessité 4-5 (Besoins), pour la période affichée. */
  montantBesoins: number;
  /** Somme des charges de nécessité 1-3 (Plaisirs), pour la période affichée. */
  montantPlaisirs: number;
  /** Revenus totaux de la période (foyer ou membre selon le sujet affiché) — sert à
   *  visualiser l'espace que prennent les charges plaisirs dans le budget global. */
  revenusTotal: number;
  /** Devise base du foyer, pour le formatage des montants. */
  devise: string;
  /** Détail des postes "Besoin" de la période (déjà triés par montant décroissant côté
   *  serveur), affiché sous les stats du drawer. */
  postesBesoins: PosteBesoinCardItem[];
}

/**
 * Indicateur "Plaisirs vs Besoins" : répartit les charges d'une période entre Besoins
 * (nécessité 4-5) et Plaisirs (nécessité 1-3). Deux lectures complémentaires :
 * - le **taux charges** (plaisirs parmi besoins+plaisirs, seuil 28 %) alimente le donut ;
 * - le **taux budget** (Besoins parmi les revenus totaux, seuil 50 %) alimente le badge
 *   d'en-tête, le message, l'espace budget et correspond à l'info affichée sur
 *   l'indicateur-card du dashboard — c'est la lecture la plus parlante pour
 *   l'utilisateur ("quelle part de mon revenu part dans mes charges de nécessité ?").
 */
@Component({
  selector: 'app-besoins-plaisirs-card',
  standalone: true,
  imports: [CommonModule, CardModule, TagComponent, DividerModule, MontantPipe, MetricBarComponent],
  templateUrl: './besoins-plaisirs-card.component.html',
  styleUrl: './besoins-plaisirs-card.component.scss',
})
export class BesoinsPlaisirsCardComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();
  private readonly montantPipe = inject(MontantPipe);

  readonly data = input.required<BesoinsPlaisirsCardData>();

  /** Seuil (%) du taux "budget" (Besoins parmi les revenus totaux) au-delà duquel
   *  l'indicateur est jugé élevé — pilote le badge d'en-tête, le message et l'info de
   *  l'indicateur-card (voir `besoinsPlaisirsIndicator`). 50 % = repère classique
   *  "les charges de nécessité ne devraient pas dépasser la moitié du budget". */
  static readonly SEUIL_ZONE_ELEVEE_BUDGET = 50;

  readonly montantTotal = computed(() => this.data().montantBesoins + this.data().montantPlaisirs);

  /** Taux "charges" (0-100) : part des charges plaisirs parmi l'ensemble des charges
   *  nécessité connue (besoins + plaisirs). 0 si aucune charge n'est renseignée. */
  readonly tauxPlaisirsCharges = computed(() => {
    const total = this.montantTotal();
    return total > 0 ? (this.data().montantPlaisirs / total) * 100 : 0;
  });

  /** Taux "budget" (0-100+) : part des charges Besoins dans les revenus totaux de la
   *  période. C'est ce taux qui est repris tel quel par l'indicateur-card du dashboard. */
  readonly tauxBesoinsBudget = computed(() => {
    const revenus = this.data().revenusTotal;
    return revenus > 0 ? (this.data().montantBesoins / revenus) * 100 : 0;
  });

  /** Zone "budget" (Besoins vs revenus totaux) — pilote le badge d'en-tête et le
   *  message, cohérente avec l'indicateur-card affiché sur le dashboard. */
  readonly zoneBudget = computed<BesoinsPlaisirsZone>(() =>
    this.tauxBesoinsBudget() > BesoinsPlaisirsCardComponent.SEUIL_ZONE_ELEVEE_BUDGET ? 'ELEVE' : 'MAITRISE'
  );

  /** Ton du tag de zone — même échelle que `badgeTon` de l'indicateur-card. */
  readonly tonMap: Record<BesoinsPlaisirsZone, TonCarte> = {
    ELEVE: 'danger',
    MAITRISE: 'succes',
  };

  readonly labelMap = computed<Record<BesoinsPlaisirsZone, string>>(() => ({
    ELEVE: this.t.dashboard.besoinsPlaisirsZoneEleve,
    MAITRISE: this.t.dashboard.besoinsPlaisirsZoneMaitrise,
  }));

  readonly message = computed(() => {
    if (this.zoneBudget() !== 'ELEVE') return this.t.dashboard.besoinsPlaisirsMessageMaitrise;
    const montantFormate = this.montantPipe.transform(this.montantAReduirePour50(), this.data().devise);
    return this.t.dashboard.besoinsPlaisirsMessageEleve.replace('{{montant}}', montantFormate);
  });

  /** Montant à retrancher des charges Besoins pour ramener le taux "budget" (Besoins /
   *  revenus totaux) exactement à 50 % — n'a de sens que zone "budget" ELEVE (sinon 0). */
  readonly montantAReduirePour50 = computed(() =>
    Math.max(this.data().montantBesoins - this.data().revenusTotal * 0.5, 0)
  );

  /** Donut Besoins/Plaisirs — mêmes tons que la barre empilée de la carte (`charge` /
   *  `argent-poche`). La zone est portée par le tag d'en-tête, pas par ces couleurs. */
  readonly ringSegments = computed<MetricRingSegment[]>(() => [
    { value: this.data().montantBesoins, color: TON_BESOINS, label: this.t.dashboard.besoinsPlaisirsBesoins },
    { value: this.data().montantPlaisirs, color: TON_PLAISIRS, label: this.t.dashboard.besoinsPlaisirsPlaisirs },
  ]);

  readonly ringCenterValue = computed(() => `${formatTaux(this.tauxPlaisirsCharges())}%`);

  /** Espace pris par les charges (besoins ET plaisirs) dans le budget global (revenus
   *  totaux) — pas seulement le ratio entre charges, mais bien face à l'ensemble du
   *  revenu disponible, pour faire comprendre le poids réel de chaque catégorie dans le
   *  budget. Tons strictement alignés sur la barre empilée de l'indicateur-card. */
  readonly barSegments = computed<MetricBarSegment[]>(() => {
    const revenus = Math.max(this.data().revenusTotal, this.montantTotal());
    const besoins = this.data().montantBesoins;
    const plaisirs = this.data().montantPlaisirs;
    return [
      {
        label: this.t.dashboard.besoinsPlaisirsBesoins,
        value: besoins,
        color: TON_BESOINS,
      },
      {
        label: this.t.dashboard.besoinsPlaisirsMontantPlaisirs,
        value: plaisirs,
        color: TON_PLAISIRS,
      },
      {
        label: this.t.dashboard.besoinsPlaisirsResteBudget,
        value: Math.max(revenus - besoins - plaisirs, 0),
        color: TON_RESTE,
      },
    ];
  });
}
