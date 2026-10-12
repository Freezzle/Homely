import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PosteEcheancier } from '../../../../../shared/components/echeancier-annuel/echeancier.model';
import { estActif, imputations } from '../../../../../shared/components/echeancier-annuel/echeancier.util';

/** Une colonne de l'aperçu : un mois, sa hauteur de barre et son éventuelle échéance. */
interface MoisApercu {
  readonly initiale: string;
  readonly hauteur: number;
  readonly pleine: boolean;
  readonly echeance: boolean;
  readonly horsValidite: boolean;
}

/** Hauteurs relatives des barres (en %) selon ce que le mois représente. */
const HAUTEUR_VIDE = 14;
const HAUTEUR_MOYENNE = 52;
const HAUTEUR_PLEINE = 100;

/**
 * Aperçu sur 12 mois à partir du mois de début du poste : traduit visuellement
 * le couple (moment, mode) choisi. Les règles d'imputation ne sont pas
 * réécrites ici : elles viennent de `echeancier.util.ts` (R3 à R5), déjà testé.
 */
@Component({
  selector: 'app-poste-apercu-periodicite',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-baseline justify-between gap-3">
      <span class="entete">{{ entete() }}</span>
    </div>

    <div class="barres" aria-hidden="true">
      @for (m of mois(); track $index) {
        <div class="colonne" [class.colonne--hors]="m.horsValidite">
          <span class="point" [class.point--visible]="m.echeance"></span>
          <span class="piste">
            <span
              class="barre"
              [class.barre--pleine]="m.pleine"
              [style.height.%]="m.hauteur"
            ></span>
          </span>
          <span class="initiale">{{ m.initiale }}</span>
        </div>
      }
    </div>

    <p class="legende">{{ legende() }}</p>
  `,
  styles: [`
    :host {
      display: block;
      padding: var(--app-space-3);
      background: var(--app-bg);
      border: 1px solid var(--app-line);
      border-radius: var(--app-radius-card);
    }

    .entete {
      font-size: var(--app-text-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--app-ink-muted);
    }

    .barres {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: var(--app-space-1);
      margin: var(--app-space-2) 0;
    }

    .colonne { display: flex; flex-direction: column; align-items: center; gap: var(--app-space-0-5); }

    .colonne--hors { opacity: 0.35; }

    .point {
      width: 6px;
      height: 6px;
      border-radius: var(--app-radius-pill);
      background: transparent;
    }

    .point--visible { background: var(--p-primary-color); }

    .piste {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      width: 100%;
      height: 48px;
    }

    .barre {
      width: 100%;
      border-radius: var(--app-radius-item);
      background: var(--app-primary-doux);
      min-height: 3px;
    }

    .barre--pleine { background: var(--p-primary-color); }

    .initiale {
      font-size: var(--app-text-xs);
      color: var(--app-ink-muted);
      text-transform: uppercase;
    }

    .legende { font-size: var(--app-text-xs); color: var(--app-ink-muted); }
  `],
})
export class PosteApercuPeriodiciteComponent {
  readonly poste = input<PosteEcheancier | null>(null);
  /** Locale ICU (déjà résolue par le conteneur) pour l'initiale des mois. */
  readonly locale = input<string>('fr-CH');
  /** En-tête déjà traduit, ex. « Aperçu dès nov. 2026 ». */
  readonly entete = input<string>('');
  /** Légende d'une ligne déjà traduite et adaptée au cas courant. */
  readonly legende = input<string>('');

  protected readonly mois = computed<MoisApercu[]>(() => {
    const p = this.poste();
    if (!p) return [];

    const anneeDebut = +p.debut.slice(0, 4);
    const moisDebut = +p.debut.slice(5, 7);

    // Deux années consécutives suffisent à couvrir une fenêtre de 12 mois glissante.
    const parAnnee = new Map<number, ReturnType<typeof imputations>>([
      [anneeDebut, imputations(p, anneeDebut)],
      [anneeDebut + 1, imputations(p, anneeDebut + 1)],
    ]);

    const formatMois = new Intl.DateTimeFormat(this.locale(), { month: 'narrow' });
    const out: MoisApercu[] = [];

    for (let i = 0; i < 12; i++) {
      const absolu = (anneeDebut * 12 + moisDebut - 1) + i;
      const annee = Math.floor(absolu / 12);
      const m = (absolu % 12) + 1;
      const calcul = parAnnee.get(annee)!;

      const actif = estActif(p, annee, m);
      const impute = actif && calcul.impute[m - 1];
      const echeance = actif && calcul.echeance[m - 1];

      out.push({
        initiale: formatMois.format(new Date(annee, m - 1, 1)),
        ...this.gabarit(p, impute, echeance),
        horsValidite: !actif,
        echeance: echeance && p.periodicite > 1 && p.moment !== 'INCONNU',
      });
    }
    return out;
  });

  /**
   * Traduit l'imputation d'un mois en hauteur de barre : un mois « plein » est
   * un mois où le montant entier tombe, un mois « moyen » une part lissée.
   */
  private gabarit(
    p: PosteEcheancier,
    impute: boolean,
    echeance: boolean,
  ): Pick<MoisApercu, 'hauteur' | 'pleine'> {
    if (!impute) return { hauteur: HAUTEUR_VIDE, pleine: false };
    if (p.periodicite <= 1) return { hauteur: HAUTEUR_PLEINE, pleine: true };
    if (p.moment === 'INCONNU') return { hauteur: HAUTEUR_MOYENNE, pleine: false };
    if (p.mode === 'PERIODIQUE') return { hauteur: HAUTEUR_PLEINE, pleine: true };
    return echeance
      ? { hauteur: HAUTEUR_MOYENNE, pleine: true }
      : { hauteur: HAUTEUR_MOYENNE, pleine: false };
  }
}
