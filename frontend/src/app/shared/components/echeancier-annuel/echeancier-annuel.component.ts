import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { CapsuleVue, Groupe, IntensiteBulle, MoisVue, PosteEcheancier } from './echeancier.model';
import { vueEcheancier } from './echeancier.util';

const REMPLISSAGE: Record<IntensiteBulle, number> = {
  discrete: 0.22, accentuee: 0.32, forte: 0.44,
};

@Component({
  selector: 'app-echeancier-annuel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-echeancier-annuel' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + largeur() + ' ' + hauteur()"
         [attr.width]="largeur()" [attr.height]="hauteur()"
         role="img" [attr.aria-label]="ariaLabel()">

      @for (c of vue().capsules; track $index) {
        <path class="capsule" [class.pointillee]="c.style === 'pointillee'"
              [attr.d]="chemin(c)"
              [attr.fill-opacity]="c.style === 'pleine' ? remplissage() : remplissage() * 0.55" />
      }

      @for (p of vue().perles; track p.mois) {
        @if (p.forme === 'perle') {
          <circle class="perle" [attr.cx]="centre(p.mois)" [attr.cy]="g().milieu" [attr.r]="g().rayon" />
        } @else {
          <polygon class="losange" [class.cerclee]="marqueurs()" [attr.points]="losange(p.mois)" />
        }
      }

      @for (m of vue().mois; track m.mois) {
        <text class="mois" [class]="'etat-' + m.etat" [class.gras]="m.gras"
              [attr.x]="centre(m.mois)" [attr.y]="g().baseline"
              [attr.font-size]="g().taillePolice" text-anchor="middle">{{ m.mois }}
          <title>{{ infobulle(m) }}</title>
        </text>
      }

      @if (marqueurs() && vue().debutMois !== null) {
        <line class="embout debut"
              [attr.x1]="bordGauche(vue().debutMois!)" [attr.x2]="bordGauche(vue().debutMois!)"
              [attr.y1]="g().hautEmbout" [attr.y2]="g().basEmbout" />
      }
      @if (marqueurs() && vue().finMois !== null) {
        <line class="embout fin"
              [attr.x1]="bordDroit(vue().finMois!)" [attr.x2]="bordDroit(vue().finMois!)"
              [attr.y1]="g().hautEmbout" [attr.y2]="g().basEmbout" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      line-height: 0;
      --app-echeance: var(--p-amber-500, #f59e0b);
      --app-inactif: var(--p-surface-300, #cbd5e1);
      --app-debut: var(--p-green-500, #22c55e);
      --app-fin: var(--p-red-500, #ef4444);
      --app-ponctuel: var(--p-surface-700, #3f3f46);
    }
    svg { display: block; overflow: visible; }

    .capsule { fill: var(--app-echeance); stroke: var(--app-echeance); stroke-width: .9; stroke-opacity: .5; }
    .capsule.pointillee { stroke-dasharray: 2.5 2; stroke-opacity: .6; }

    .perle { fill: var(--app-echeance); }
    .losange { fill: var(--app-echeance); }
    .losange.cerclee { stroke: var(--app-ponctuel); stroke-width: 1.4; }

    .mois {
      font-family: inherit;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
      fill: var(--p-text-muted-color, #64748b);
    }
    .mois.gras { font-weight: 700; }
    .etat-impute { fill: var(--app-echeance); font-weight: 600; }
    .etat-impute.gras { font-weight: 700; }
    .etat-hors-validite { fill: var(--app-inactif); opacity: .6; }

    .embout { stroke-width: 2.2; stroke-linecap: round; }
    .embout.debut { stroke: var(--app-debut); }
    .embout.fin { stroke: var(--app-fin); }
  `,
})
export class EcheancierAnnuelComponent {
  private readonly i18n = inject(I18nService);
  private readonly t = this.i18n.translations();

  readonly poste = input.required<PosteEcheancier>();
  readonly annee = input.required<number>();
  readonly largeur = input<number>(168);
  readonly hauteur = input<number>(26);
  readonly groupe = input<Groupe>(3);
  readonly intensiteBulle = input<IntensiteBulle>('accentuee');
  readonly marqueurs = input<boolean>(true);

  protected readonly vue = computed(() => vueEcheancier(this.poste(), this.annee(), this.groupe()));
  protected readonly remplissage = computed(() => REMPLISSAGE[this.intensiteBulle()]);

  /** Géométrie dérivée : la réglette occupe le tiers bas, les capsules le reste. */
  protected readonly g = computed(() => {
    const w = this.largeur(), h = this.hauteur(), bord = 3;
    const pas = (w - 2 * bord) / 12;
    const hauteurReglette = Math.min(7.6, h * 0.34);
    const hautReglette = h - hauteurReglette - 0.6;
    const milieu = (hautReglette - 1) / 2 + 0.5;
    const hauteurCapsule = Math.min(hautReglette - 5, 9.5);
    const taillePolice = Math.min(hauteurReglette * 0.98, pas * 0.86);
    return {
      bord, pas, milieu, hauteurCapsule, taillePolice,
      baseline: hautReglette + taillePolice * 0.86,
      rayon: Math.min(3.4, pas * 0.44),
      hautEmbout: milieu - hauteurCapsule / 2 - 2,
      basEmbout: hautReglette + hauteurReglette,
    };
  });

  protected centre = (mois: number): number => this.g().bord + (mois - 1) * this.g().pas + this.g().pas / 2;
  protected bordGauche = (mois: number): number => this.g().bord + (mois - 1) * this.g().pas;
  protected bordDroit = (mois: number): number => this.g().bord + mois * this.g().pas;

  /** R8 — chaque extrémité est arrondie ou droite indépendamment de l'autre. */
  protected chemin(c: CapsuleVue): string {
    const { milieu, hauteurCapsule: hc } = this.g();
    const x1 = this.bordGauche(c.du), x2 = this.bordDroit(c.au);
    const y = milieu - hc / 2, r = hc / 2;
    const gl = c.capDu === 'arrondi' ? r : 0;
    const dr = c.capAu === 'arrondi' ? r : 0;
    return [
      `M${x1 + gl},${y}`,
      `H${x2 - dr}`,
      dr ? `A${r},${r} 0 0 1 ${x2 - dr},${y + hc}` : `V${y + hc}`,
      `H${x1 + gl}`,
      gl ? `A${r},${r} 0 0 1 ${x1 + gl},${y}` : `V${y}`,
      'Z',
    ].join(' ');
  }

  protected losange(mois: number): string {
    const cx = this.centre(mois), cy = this.g().milieu, z = this.g().hauteurCapsule / 2 + 0.8;
    return `${cx},${cy - z} ${cx + z},${cy} ${cx},${cy + z} ${cx - z},${cy}`;
  }

  /** Sans montant, l'infobulle décrit un statut, pas une somme. */
  protected infobulle(m: MoisVue): string {
    const nomMois = this.t.mois[m.mois - 1];
    const lignes: string[] = [`${nomMois} ${this.annee()}`];
    const infob = this.t.echeancierAnnuel.infobulle;
    if (m.repere === 'ponctuel') { lignes.push(infob.ponctuel); return lignes.join('\n'); }
    if (m.etat === 'hors-validite') { lignes.push(infob.horsValidite); return lignes.join('\n'); }
    lignes.push(
      m.echeance ? infob.echeanceDatee
        : m.impute ? infob.imputeSansEcheance
          : infob.aucuneImputation,
    );
    if (m.repere === 'debut') lignes.push(infob.debutValidite);
    if (m.repere === 'fin') lignes.push(infob.finValidite);
    return lignes.join('\n');
  }

  protected readonly ariaLabel = computed(() => {
    const v = this.vue();
    const actifs = v.mois.filter((m) => m.etat !== 'hors-validite').length;
    if (actifs === 0) {
      return this.i18n.instant('echeancierAnnuel.ariaInactif', { annee: this.annee() });
    }
    const n = v.perles.length;
    return n === 0
      ? this.i18n.instant('echeancierAnnuel.ariaSansEcheance', { annee: this.annee(), actifs })
      : this.i18n.instant('echeancierAnnuel.ariaAvecEcheances', {
        annee: this.annee(),
        n,
        mois: v.perles.map((p) => p.mois).join(', '),
      });
  });
}
