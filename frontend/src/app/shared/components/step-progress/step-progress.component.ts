import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * Barre de progression d'un parcours en N étapes : chevron de retour, N segments
 * égaux remplis jusqu'à l'étape courante incluse, et compteur « n / N ».
 *
 * Le nombre de segments peut **varier** en cours de parcours (une étape peut
 * apparaître ou disparaître selon les réponses) : c'est voulu, le composant ne
 * mémorise rien.
 */
@Component({
  selector: 'app-step-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-3">
      @if (courante() > 0) {
        <button
          type="button"
          class="chevron"
          [attr.aria-label]="libelleRetour()"
          (click)="retour.emit()"
        >
          <i class="pi pi-chevron-left" aria-hidden="true"></i>
        </button>
      } @else {
        <span class="chevron-placeholder" aria-hidden="true"></span>
      }

      <div
        class="segments"
        role="progressbar"
        [attr.aria-valuemin]="1"
        [attr.aria-valuemax]="total()"
        [attr.aria-valuenow]="courante() + 1"
        [attr.aria-valuetext]="libelleProgression()"
        [style.grid-template-columns]="colonnes()"
      >
        @for (s of segments(); track s) {
          <span class="segment" [class.segment--fait]="s <= courante()"></span>
        }
      </div>

      <span class="compteur">{{ courante() + 1 }} / {{ total() }}</span>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .chevron,
    .chevron-placeholder {
      width: 44px;
      height: 44px;
      flex: 0 0 auto;
    }

    .chevron {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      border-radius: var(--app-radius-pill);
      color: var(--app-ink-muted);
      cursor: pointer;
    }

    .chevron:hover { background: var(--app-line-2); color: var(--app-ink); }

    .segments {
      display: grid;
      gap: 4px;
      flex: 1 1 auto;
      min-width: 0;
    }

    .segment {
      height: 6px;
      border-radius: var(--app-radius-pill);
      background: var(--app-line);
    }

    .segment--fait { background: var(--p-primary-color); }

    .compteur {
      flex: 0 0 auto;
      color: var(--app-ink-muted);
      font-variant-numeric: tabular-nums;
    }
  `],
})
export class StepProgressComponent {
  /** Nombre total d'étapes actuellement affichées. */
  readonly total = input.required<number>();
  /** Index 0-based de l'étape courante. */
  readonly courante = input.required<number>();
  /** Libellé accessible du chevron de retour. */
  readonly libelleRetour = input<string>('');
  /** Libellé accessible de la progression (« Étape 3 sur 6 »). */
  readonly libelleProgression = input<string>('');

  readonly retour = output<void>();

  protected readonly segments = computed(() =>
    Array.from({ length: Math.max(this.total(), 1) }, (_, i) => i),
  );

  protected readonly colonnes = computed(() => `repeat(${Math.max(this.total(), 1)}, 1fr)`);
}
