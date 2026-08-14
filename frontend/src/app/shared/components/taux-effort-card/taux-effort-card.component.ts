import { CommonModule } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TagComponent } from '../tag/tag.component';

/** Zones du taux d'effort — bornes 60/75/90 (cf. spec indicateur 04). */
export type TauxEffortZone = 'CONFORTABLE' | 'CORRECT' | 'TENDU' | 'SATURE';

/** Données brutes d'entrée de la carte — le composant calcule lui-même le taux
 *  d'effort, le pire cas, le reste libre et la zone. Purement présentationnel :
 *  aucune injection de service métier, aucun accès store. */
export interface TauxEffortCardData {
  /** Le membre concerné. Sert au titre et au data-binding. */
  membre: {
    id: string;
    /** Prénom affiché dans le titre. */
    nom: string;
    /** Hex — optionnel, non utilisé aujourd'hui mais fourni pour cohérence avec les autres KPI. */
    couleur?: string;
  };
  /** Revenus totaux du membre pour le mois de référence, devise base. */
  revenusTotal: number;
  /** Somme des charges (CHARGE) du membre, mensualisées, devise base. */
  chargesTotal: number;
  /** Somme des réserves (RESERVE) du membre, mensualisées, devise base. */
  reservesTotal: number;
  /** Taux d'effort en pire cas : recalcul avec chaque poste ESTIMATION appliqué
   *  à sa variation maximale. Toujours ≥ tauxEffort ; égal si aucun poste ESTIMATION. */
  chargesTotalPireCas: number;
  reservesTotalPireCas: number;
  /** Argent de poche résolu pour ce membre (n'est pas un poste, absent de
   *  chargesTotal/reservesTotal) — alimente la 3ᵉ jauge "charges + réserves + argent
   *  de poche", une vision plus complète de l'effort réel. */
  argentPocheTotal: number;
  argentPocheTotalPireCas: number;
}

/**
 * Indicateur 04 — Taux d'effort du membre : jauge à 4 zones (Confortable/Correct/
 * Tendu/Saturé) avec marqueur "pire cas" (postes ESTIMATION à leur variation max).
 * Composant strictement isolé : reçoit ses données par `@Input` uniquement,
 * réutilisable partout dans l'app (dashboard, détail scénario, comparaison).
 */
@Component({
  selector: 'app-taux-effort-card',
  standalone: true,
  imports: [CommonModule, CardModule, TagModule, DividerModule, MontantPipe, TagComponent],
  templateUrl: './taux-effort-card.component.html',
  styleUrl: './taux-effort-card.component.scss',
})
export class TauxEffortCardComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly data = input.required<TauxEffortCardData>();

  /** Affiche le nom du membre dans le titre ("Taux d'effort du membre {nom}"). À
   *  désactiver (`false`) quand la carte est déjà contextualisée par le membre affiché
   *  (ex. dashboard mensuel d'un membre) — titre réduit à "Taux d'effort". L'aria-label
   *  continue de mentionner le membre dans tous les cas (accessibilité). */
  readonly afficherNom = input<boolean>(true);

  /** Taux d'effort "charges seules" (hors réserves) — vision minimale de l'effort
   *  contractuel/récurrent, sans les mises de côté volontaires. */
  readonly tauxEffortCharges = computed(() => {
    const d = this.data();
    if (d.revenusTotal <= 0) return 0;
    return (d.chargesTotal / d.revenusTotal) * 100;
  });

  /** Pire cas du taux d'effort "charges seules". */
  readonly tauxEffortChargesPireCas = computed(() => {
    const d = this.data();
    if (d.revenusTotal <= 0) return 0;
    return (d.chargesTotalPireCas / d.revenusTotal) * 100;
  });

  /** Largeur/position visuelles plafonnées à 100 % pour la jauge "charges seules". */
  readonly tauxEffortChargesAffiche = computed(() => Math.min(this.tauxEffortCharges(), 100));
  readonly tauxEffortChargesPireCasAffiche = computed(() => Math.min(this.tauxEffortChargesPireCas(), 100));

  /** Taux d'effort courant, charges + réserves (0-100+, non plafonné pour l'affichage du libellé numérique). */
  readonly tauxEffort = computed(() => {
    const d = this.data();
    if (d.revenusTotal <= 0) return 0;
    return ((d.chargesTotal + d.reservesTotal) / d.revenusTotal) * 100;
  });

  /** Taux d'effort "pire cas" (postes ESTIMATION majorés), charges + réserves. */
  readonly tauxEffortPireCas = computed(() => {
    const d = this.data();
    if (d.revenusTotal <= 0) return 0;
    return ((d.chargesTotalPireCas + d.reservesTotalPireCas) / d.revenusTotal) * 100;
  });

  /** Largeur visuelle de la jauge de remplissage, plafonnée à 100 %. */
  readonly tauxEffortAffiche = computed(() => Math.min(this.tauxEffort(), 100));
  /** Position visuelle du marqueur pire cas, plafonnée à 100 %. */
  readonly tauxEffortPireCasAffiche = computed(() => Math.min(this.tauxEffortPireCas(), 100));

  /** Taux d'effort "charges + réserves + argent de poche" — vision la plus complète de
   *  l'effort réel du membre, incluant l'argent de poche qui n'est pas un poste. */
  readonly tauxEffortAvecPoche = computed(() => {
    const d = this.data();
    if (d.revenusTotal <= 0) return 0;
    return ((d.chargesTotal + d.reservesTotal + d.argentPocheTotal) / d.revenusTotal) * 100;
  });

  /** Pire cas du taux d'effort "charges + réserves + argent de poche". */
  readonly tauxEffortAvecPochePireCas = computed(() => {
    const d = this.data();
    if (d.revenusTotal <= 0) return 0;
    return ((d.chargesTotalPireCas + d.reservesTotalPireCas + d.argentPocheTotalPireCas) / d.revenusTotal) * 100;
  });

  /** Largeur/position visuelles plafonnées à 100 % pour la jauge "charges + réserves + argent de poche". */
  readonly tauxEffortAvecPocheAffiche = computed(() => Math.min(this.tauxEffortAvecPoche(), 100));
  readonly tauxEffortAvecPochePireCasAffiche = computed(() => Math.min(this.tauxEffortAvecPochePireCas(), 100));

  /** Zone de la jauge "charges + réserves" — sert aussi au badge de la carte et à l'aria-label. */
  readonly zone = computed<TauxEffortZone>(() => TauxEffortCardComponent.zoneDe(this.tauxEffort()));

  /** Zone de la jauge "charges seules" — indépendante de `zone`, propre à cette barre. */
  readonly zoneCharges = computed<TauxEffortZone>(() => TauxEffortCardComponent.zoneDe(this.tauxEffortCharges()));

  private static zoneDe(t: number): TauxEffortZone {
    if (t < 75) return 'CONFORTABLE';
    if (t < 90) return 'CORRECT';
    if (t < 95) return 'TENDU';
    return 'SATURE';
  }

  readonly severityMap: Record<TauxEffortZone, 'success' | 'info' | 'warn' | 'danger'> = {
    CONFORTABLE: 'success',
    CORRECT: 'info',
    TENDU: 'warn',
    SATURE: 'danger',
  };

  readonly labelMap = computed<Record<TauxEffortZone, string>>(() => ({
    CONFORTABLE: this.t.projection.effortCardZoneConfortable,
    CORRECT: this.t.projection.effortCardZoneCorrect,
    TENDU: this.t.projection.effortCardZoneTendu,
    SATURE: this.t.projection.effortCardZoneSature,
  }));

  /** Texte d'information/conseil affiché en bas de carte selon la zone (charges +
   *  réserves). Pas de message pour CONFORTABLE — rien à signaler. */
  readonly messageMap = computed<Record<TauxEffortZone, string | null>>(() => ({
    CONFORTABLE: null,
    CORRECT: null,
    TENDU: this.t.projection.effortCardMessageTendu,
    SATURE: this.t.projection.effortCardMessageSature,
  }));

  readonly message = computed(() => this.messageMap()[this.zone()]);

  readonly ariaLabel = computed(() => {
    const d = this.data();
    const nom = d.membre.nom;
    if (d.revenusTotal <= 0) {
      return `${this.t.projection.effortCardTitrePrefixe} ${nom} : ${this.t.projection.effortCardZoneNA}.`;
    }
    return this.t.projection.effortCardAriaLabel
      .replace('{{nom}}', nom)
      .replace('{{taux}}', this.tauxEffort().toFixed(0))
      .replace('{{zone}}', this.labelMap()[this.zone()])
      .replace('{{tauxPireCas}}', this.tauxEffortPireCas().toFixed(0));
  });
}
