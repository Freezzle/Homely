import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../../core/i18n/locale.util';
import { EchelleCourbes, abscissePourcent, echelleAvecMarge, ordonneePourcent } from '../courbes.util';
import { TonIndicateur, couleurPleine, couleurSurface, tonCategorie } from '../tons';

/** Nombre de séries au-delà duquel les courbes deviennent illisibles (voir docs/03 §7.2). */
export const NB_MAX_SERIES_COURBES = 5;

/** Une série tracée par `app-indicateur-courbes-multiples`. */
export interface SerieCourbe {
  cle: string;
  libelle: string;
  /** Une valeur par point ; les valeurs non finies sont ignorées (trou dans la courbe). */
  valeurs: number[];
  /** Couleur du trait. Défaut : ton de la palette catégorielle selon l'ordre d'affichage. */
  ton?: TonIndicateur;
  /** Épaisseur du trait en px (constante quelle que soit la largeur). Défaut 2.2. */
  epaisseur?: number;
  /** `stroke-dasharray`, ex. `'4 3'` (série de détail), `'2 3'` (seuil). */
  tiret?: string;
  /** Opacité du trait (0-1). `0.35` pour une série d'arrière-plan. Défaut 1. */
  opacite?: number;
  /** Masque la pastille posée sur le point mis en avant (séries secondaires, seuils). */
  sansPoint?: boolean;
  /** Affiche la pastille de légende en pointillés (cohérent avec `tiret`). */
  legendeTiret?: boolean;
}

interface CourbeRendue {
  cle: string;
  libelle: string;
  couleur: string;
  chemin: string;
  epaisseur: number;
  tiret: string | null;
  opacite: number;
  point: { x: number; y: number } | null;
  fondLegende: string;
  opaciteLegende: number;
}

interface PolygoneZone {
  cle: string;
  points: string;
  couleur: string;
}

interface GraduationRendue {
  cle: string;
  y: number;
  texte: string;
  pointille: boolean;
}

interface PointAbscisse {
  index: number;
  libelle: string;
  infobulle: string;
  surligne: boolean;
  signale: boolean;
}

interface EntreeLegendeZone {
  libelle: string;
  couleur: string;
}

/**
 * Courbes multiples (1 à 5 séries) sur une échelle commune, avec une **zone d'écart**
 * remplie entre deux séries : positive (verte) quand la première passe au-dessus de la
 * seconde, négative (rouge) quand elle passe en dessous. La bascule de couleur se fait
 * exactement au point de croisement, l'intervalle concerné étant découpé en deux triangles.
 *
 * Composant d'affichage pur — à placer dans le corps d'un `app-carte-info`.
 */
@Component({
  selector: 'app-indicateur-courbes-multiples',
  standalone: true,
  imports: [TooltipModule],
  templateUrl: './indicateur-courbes-multiples.component.html',
  styleUrl: './indicateur-courbes-multiples.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurCourbesMultiplesComponent {
  private readonly i18n = inject(I18nService);

  /** Séries tracées, dans l'ordre d'affichage. Au-delà de 5, les suivantes sont ignorées. */
  readonly series = input.required<SerieCourbe[]>();
  /** Libellés courts d'abscisse, un par point (ex. « J », « F »…). */
  readonly libelles = input.required<string[]>();
  /** Libellés longs utilisés dans les infobulles. Repli sur `libelles`. */
  readonly libellesComplets = input<string[]>([]);
  /** `entre` : zone entre les deux séries de `paire` ; `zero` : zone sous la 1re série. */
  readonly remplissage = input<'entre' | 'zero' | null>('entre');
  /** Index des deux séries comparées : la zone est positive quand `[0]` est au-dessus de `[1]`. */
  readonly paire = input<[number, number]>([0, 1]);
  /** Libellés de légende de la zone (positif, négatif). Défaut : clés i18n. */
  readonly libellesZone = input<[string, string] | null>(null);
  readonly tonZonePositive = input<TonIndicateur>('succes');
  readonly tonZoneNegative = input<TonIndicateur>('danger');
  /** Point mis en avant : pastille sur chaque courbe et libellé d'abscisse en gras. */
  readonly indexSurligne = input<number | null>(null);
  /** Index dont le libellé d'abscisse est signalé (rouge) — ex. mois en déficit. */
  readonly indicesSignales = input<number[]>([]);
  /** Force l'échelle à contenir 0 et trace la ligne 0 en trait plein. */
  readonly inclureZero = input<boolean>(false);
  readonly hauteur = input<string>('130px');
  readonly afficherLegende = input<boolean>(true);
  /** Formate les graduations de l'axe Y et les infobulles par défaut. */
  readonly formateurValeur = input<((valeur: number) => string) | null>(null);
  /** Texte de l'infobulle d'un point. Défaut : `libellé · série: valeur` par série. */
  readonly formateurInfobulle = input<((index: number) => string) | null>(null);

  private readonly t = computed(() => this.i18n.translations().indicateurs);

  /** Séries retenues (plafonnées ; celles sans aucune valeur finie sont écartées). */
  private readonly seriesRetenues = computed<SerieCourbe[]>(() =>
    this.series()
      .filter((serie) => serie.valeurs.some((v) => Number.isFinite(v)))
      .slice(0, NB_MAX_SERIES_COURBES),
  );

  protected readonly nbPoints = computed(() =>
    Math.max(this.libelles().length, ...this.seriesRetenues().map((s) => s.valeurs.length), 0),
  );

  private readonly echelle = computed<EchelleCourbes>(() =>
    echelleAvecMarge(this.seriesRetenues().map((s) => s.valeurs), this.inclureZero()),
  );

  /** Les deux séries de la zone d'écart, si la configuration est exploitable. */
  private readonly seriesZone = computed<{ a: SerieCourbe; b: SerieCourbe } | null>(() => {
    if (this.remplissage() !== 'entre') return null;
    const series = this.seriesRetenues();
    const [ia, ib] = this.paire();
    const a = series[ia];
    const b = series[ib];
    return a && b && a !== b ? { a, b } : null;
  });

  protected readonly courbes = computed<CourbeRendue[]>(() => {
    const echelle = this.echelle();
    const n = this.nbPoints();
    const surligne = this.indexSurligne();

    return this.seriesRetenues().map((serie, rang) => {
      const couleur = couleurPleine(serie.ton ?? tonCategorie(rang));
      const opacite = serie.opacite ?? 1;
      const valeurSurlignee = surligne !== null ? serie.valeurs[surligne] : undefined;
      return {
        cle: serie.cle,
        libelle: serie.libelle,
        couleur,
        chemin: this.chemin(serie.valeurs, echelle, n),
        epaisseur: serie.epaisseur ?? 2.2,
        tiret: serie.tiret ?? null,
        opacite,
        point: !serie.sansPoint && surligne !== null && Number.isFinite(valeurSurlignee)
          ? { x: abscissePourcent(surligne, n), y: ordonneePourcent(valeurSurlignee as number, echelle) }
          : null,
        fondLegende: serie.legendeTiret
          ? `repeating-linear-gradient(90deg, ${couleur} 0 3px, transparent 3px 5px)`
          : couleur,
        // Une pastille trop pâle deviendrait invisible dans la légende.
        opaciteLegende: Math.max(opacite, 0.5),
      };
    });
  });

  /**
   * Zone d'écart découpée intervalle par intervalle : quand les deux séries se croisent,
   * l'intervalle est scindé en deux triangles au point de croisement, si bien que la
   * couleur bascule exactement là où les courbes se coupent. Les polygones sont tracés
   * sans contour, sinon des traits verticaux apparaîtraient à leurs jointures.
   */
  protected readonly polygonesZone = computed<PolygoneZone[]>(() => {
    const echelle = this.echelle();
    const n = this.nbPoints();

    if (this.remplissage() === 'zero') {
      return this.polygoneVersZero(echelle, n);
    }

    const paire = this.seriesZone();
    if (!paire) return [];
    const { a, b } = paire;
    const couleurPositive = this.melange(this.tonZonePositive(), 16);
    const couleurNegative = this.melange(this.tonZoneNegative(), 22);
    const polygones: PolygoneZone[] = [];

    for (let i = 0; i < n - 1; i++) {
      const a0 = a.valeurs[i];
      const a1 = a.valeurs[i + 1];
      const b0 = b.valeurs[i];
      const b1 = b.valeurs[i + 1];
      if (![a0, a1, b0, b1].every((v) => Number.isFinite(v))) continue;

      const d0 = a0 - b0;
      const d1 = a1 - b1;
      const x0 = abscissePourcent(i, n);
      const x1 = abscissePourcent(i + 1, n);
      const ya0 = ordonneePourcent(a0, echelle);
      const ya1 = ordonneePourcent(a1, echelle);
      const yb0 = ordonneePourcent(b0, echelle);
      const yb1 = ordonneePourcent(b1, echelle);

      if (d0 * d1 < 0) {
        // Signes opposés : `d0 - d1` ne peut pas être nul, pas de division par zéro.
        const t = d0 / (d0 - d1);
        const xm = x0 + (x1 - x0) * t;
        const ym = ordonneePourcent(a0 + (a1 - a0) * t, echelle);
        polygones.push(this.polygone(`${i}-a`, [[x0, ya0], [xm, ym], [x0, yb0]], d0 > 0 ? couleurPositive : couleurNegative));
        polygones.push(this.polygone(`${i}-b`, [[xm, ym], [x1, ya1], [x1, yb1]], d1 > 0 ? couleurPositive : couleurNegative));
      } else {
        polygones.push(this.polygone(
          `${i}`,
          [[x0, ya0], [x1, ya1], [x1, yb1], [x0, yb0]],
          d0 + d1 >= 0 ? couleurPositive : couleurNegative,
        ));
      }
    }
    return polygones;
  });

  /** Graduations : valeurs réellement atteintes (pas les bornes élargies), plus 0 si demandé. */
  protected readonly graduations = computed<GraduationRendue[]>(() => {
    const echelle = this.echelle();
    if (!this.seriesRetenues().length) return [];
    const valeurs: number[] = [echelle.max];
    if (echelle.min !== echelle.max) valeurs.push(echelle.min);
    if (this.inclureZero() && echelle.min < 0 && echelle.max > 0) valeurs.push(0);
    return valeurs.map((valeur) => ({
      cle: `g${valeur}`,
      y: ordonneePourcent(valeur, echelle),
      texte: this.formater(valeur),
      pointille: valeur !== 0,
    }));
  });

  protected readonly abscisses = computed<PointAbscisse[]>(() => {
    const libelles = this.libelles();
    const complets = this.libellesComplets();
    const surligne = this.indexSurligne();
    const signales = new Set(this.indicesSignales());
    return Array.from({ length: this.nbPoints() }, (_, index) => ({
      index,
      libelle: libelles[index] ?? '',
      infobulle: this.infobulle(index, complets[index] ?? libelles[index] ?? ''),
      surligne: index === surligne,
      signale: signales.has(index),
    }));
  });

  protected readonly legendeZone = computed<EntreeLegendeZone[]>(() => {
    if (!this.seriesZone()) return [];
    const libelles = this.libellesZone();
    return [
      { libelle: libelles?.[0] ?? this.t().zonePositive, couleur: this.melange(this.tonZonePositive(), 30) },
      { libelle: libelles?.[1] ?? this.t().zoneNegative, couleur: this.melange(this.tonZoneNegative(), 35) },
    ];
  });

  protected readonly descriptionAccessible = computed(() =>
    this.i18n.instant('indicateurs.courbesMultiples', {
      series: this.seriesRetenues().map((s) => s.libelle).join(', '),
    }),
  );

  private polygoneVersZero(echelle: EchelleCourbes, n: number): PolygoneZone[] {
    const serie = this.seriesRetenues()[0];
    if (!serie) return [];
    const points = serie.valeurs
      .map((valeur, index) => ({ valeur, index }))
      .filter(({ valeur }) => Number.isFinite(valeur));
    if (points.length < 2) return [];
    const yZero = ordonneePourcent(0, echelle);
    const sommets: [number, number][] = [
      [abscissePourcent(points[0].index, n), yZero],
      ...points.map<[number, number]>((p) => [abscissePourcent(p.index, n), ordonneePourcent(p.valeur, echelle)]),
      [abscissePourcent(points[points.length - 1].index, n), yZero],
    ];
    return [this.polygone('zero', sommets, this.melange(serie.ton ?? tonCategorie(0), 14))];
  }

  private chemin(valeurs: number[], echelle: EchelleCourbes, n: number): string {
    let chemin = '';
    for (let index = 0; index < n; index++) {
      const valeur = valeurs[index];
      if (!Number.isFinite(valeur)) continue;
      const x = abscissePourcent(index, n).toFixed(3);
      const y = ordonneePourcent(valeur, echelle).toFixed(3);
      chemin += `${chemin ? ' L' : 'M'}${x} ${y}`;
    }
    return chemin;
  }

  private polygone(cle: string, sommets: [number, number][], couleur: string): PolygoneZone {
    return { cle, points: sommets.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' '), couleur };
  }

  /** Teinte translucide dérivée d'un ton, pour les surfaces de zone. */
  private melange(ton: TonIndicateur, pourcent: number): string {
    return couleurSurface(ton, pourcent);
  }

  private formater(valeur: number): string {
    const formateur = this.formateurValeur();
    if (formateur) return formateur(valeur);
    const abs = Math.abs(valeur);
    const signe = valeur < 0 ? '−' : '';
    const locale = localeDeLangue(this.i18n.currentLang());
    return abs >= 10000
      ? `${signe}${(Math.round(abs / 100) / 10).toLocaleString(locale)}k`
      : `${signe}${Math.round(abs).toLocaleString(locale)}`;
  }

  private infobulle(index: number, libelleComplet: string): string {
    const formateur = this.formateurInfobulle();
    if (formateur) return formateur(index);
    const details = this.seriesRetenues()
      .filter((serie) => Number.isFinite(serie.valeurs[index]))
      .map((serie) => `${serie.libelle}: ${this.formater(serie.valeurs[index])}`)
      .join(' · ');
    return libelleComplet ? `${libelleComplet} · ${details}` : details;
  }
}
