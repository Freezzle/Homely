import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { EcheancierAnnuelComponent } from './echeancier-annuel.component';
import { Groupe, IntensiteBulle, PosteEcheancier } from './echeancier.model';

interface Segment {
  /** Année civile rendue par `<app-echeancier-annuel>`. */
  readonly annee: number;
  /** Étiquette affichée au-dessus de la réglette. */
  readonly label: string;
  /** Faux pour la réglette centrale (régime permanent : pas d'embouts). */
  readonly marqueurs: boolean;
  /** Poste effectivement rendu (peut être neutralisé pour la boucle). */
  readonly poste: PosteEcheancier;
}

const ym = (iso: string): { annee: number; mois: number } => ({
  annee: +iso.slice(0, 4),
  mois: +iso.slice(5, 7),
});

/** ISO `yyyy-MM-dd` très en dehors pour forcer une réglette entièrement hors-validité. */
const HORS_ANNEE_COURANTE = '0001-01-01';

/**
 * Wrapper autour de `app-echeancier-annuel` qui affiche 1 à 3 réglettes selon
 * la fenêtre [debut, fin] du poste (voir plan.md v2) :
 *
 *  - ponctuel / seul debut / fin<debut / même année  → 1 réglette
 *  - années consécutives (Δ = 1)                     → 2 réglettes (debut, fin)
 *  - Δ > 1                                           → 3 réglettes (debut, boucle « N ans », fin)
 */
@Component({
  selector: 'app-echeancier-multi-annees',
  standalone: true,
  imports: [EcheancierAnnuelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-row items-end gap-3 flex-wrap">
      @for (s of segments(); track s.annee + '|' + s.label) {
        <div class="flex flex-col items-center gap-1">
          <span class="text-[11px] font-medium text-surface-500 tabular-nums">{{ s.label }}</span>
          <app-echeancier-annuel
            [poste]="s.poste"
            [annee]="s.annee"
            [largeur]="largeur()"
            [hauteur]="hauteur()"
            [groupe]="groupe()"
            [intensiteBulle]="intensiteBulle()"
            [marqueurs]="s.marqueurs"/>
        </div>
      }
    </div>
  `,
})
export class EcheancierMultiAnneesComponent {
  private readonly i18n = inject(I18nService);

  readonly poste = input<PosteEcheancier | null>(null);
  readonly largeur = input<number>(200);
  readonly hauteur = input<number>(34);
  readonly groupe = input<Groupe>(3);
  readonly intensiteBulle = input<IntensiteBulle>('accentuee');

  protected readonly segments = computed<Segment[]>(() => this.calculerSegments());

  private calculerSegments(): Segment[] {
    const p = this.poste();

    // Aucun poste (formulaire vide) → 1 réglette vide sur l'année courante.
    if (!p) {
      const anneeCourante = new Date().getFullYear();
      const vide: PosteEcheancier = {
        periodicite: 1,
        mode: 'MENSUALISE',
        moment: 'DEBUT_PERIODE',
        debut: HORS_ANNEE_COURANTE,
        fin: null,
      };
      return [{ annee: anneeCourante, label: String(anneeCourante), marqueurs: true, poste: vide }];
    }

    const debutY = ym(p.debut).annee;
    const finY = p.fin ? ym(p.fin).annee : null;

    // Ponctuel : R4 — année de la date de référence, un seul segment.
    if (p.periodicite === 0) {
      return [{ annee: debutY, label: String(debutY), marqueurs: true, poste: p }];
    }

    // Cas 1 : pas de fin, fin invalide (< debut) ou même année → 1 seul segment.
    if (finY === null || finY < debutY || finY === debutY) {
      return [{ annee: debutY, label: String(debutY), marqueurs: true, poste: p }];
    }

    const debutSeg: Segment = {
      annee: debutY, label: String(debutY), marqueurs: true, poste: p,
    };
    const finSeg: Segment = {
      annee: finY, label: String(finY), marqueurs: true, poste: p,
    };

    // Δ = 1 : deux réglettes contiguës.
    if (finY - debutY === 1) return [debutSeg, finSeg];

    // Δ > 1 : boucle centrale sur une année pivot strictement à l'intérieur.
    // Pivot = debutY + 1 (garanti < finY car finY − debutY > 1).
    // On neutralise la fenêtre (fin=null) pour que la réglette montre le régime permanent.
    const nAnneesIntermediaires = finY - debutY - 1;
    const pivotPoste: PosteEcheancier = { ...p, fin: null };
    const boucleSeg: Segment = {
      annee: debutY + 1,
      label: this.labelBoucle(nAnneesIntermediaires),
      marqueurs: false,
      poste: pivotPoste,
    };

    return [debutSeg, boucleSeg, finSeg];
  }

  private labelBoucle(n: number): string {
    return n <= 1
      ? this.i18n.instant('echeancierAnnuel.boucleLabelSingulier')
      : this.i18n.instant('echeancierAnnuel.boucleLabelPluriel', { n });
  }
}
