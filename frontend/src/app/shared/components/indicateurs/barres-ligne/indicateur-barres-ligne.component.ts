import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../../core/i18n/locale.util';
import {
  EchelleDepuisZero,
  abscisseBarrePourcent,
  abscissePourcent,
  echelleDepuisZero,
  largeurBarrePourcent,
  ordonneeDepuisZero,
} from '../courbes.util';
import { OPACITE_SURFACE_SEGMENT, TonIndicateur, couleurPleine, couleurSurface, tonCategorie } from '../tons';

/** Nombre de segments au-delà duquel les tranches deviennent illisibles (voir docs/03 §7.2). */
export const NB_MAX_SEGMENTS_BARRES_LIGNE = 5;

/** Un segment empilé de `app-indicateur-barres-ligne`, du bas vers le haut. */
export interface SegmentBarresLigne {
  cle: string;
  libelle: string;
  /** Un montant par point. **Les valeurs négatives sont ramenées à 0.** */
  valeurs: number[];
  /** Couleur du segment. Défaut : ton de la palette catégorielle selon l'ordre d'affichage. */
  ton?: TonIndicateur;
  /**
   * Intensité de la surface en % du ton. Défaut : `OPACITE_SURFACE_SEGMENT`. Une valeur
   * plus basse distingue une sous-catégorie d'un même thème.
   */
  intensite?: number;
}

/** Ligne de référence tracée par-dessus les barres, sur la même échelle. */
export interface LigneBarresLigne {
  libelle: string;
  valeurs: number[];
  /** Défaut : ton neutre. Ne doit pas reprendre le ton d'un segment (voir docs/03 §7.2). */
  ton?: TonIndicateur;
  /** `stroke-dasharray`, ex. `'5 4'` : valeur fixée à l'avance (budget, objectif). */
  tiret?: string;
  /** Épaisseur du trait en px (constante quelle que soit la largeur). Défaut 2.2. */
  epaisseur?: number;
}

interface SegmentRendu {
  cle: string;
  libelle: string;
  couleur: string;
}

interface RectangleRendu {
  cle: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  couleur: string;
  opacite: number;
}

interface GraduationRendue {
  cle: string;
  y: number;
  texte: string;
  pointillee: boolean;
}

interface PointAbscisse {
  index: number;
  libelle: string;
  infobulle: string;
  surligne: boolean;
  prevision: boolean;
}

/** Opacité d'une barre de prévision (feature #23 §7). */
const OPACITE_PREVISION = 0.45;

/**
 * Barres empilées (1 à 5 segments) surmontées d'**une seule ligne de référence**, sur une
 * échelle commune partant toujours de 0. On lit d'un coup d'œil la composition de chaque
 * point et sa position par rapport à la ligne ; aucun dépassement n'est signalé, la
 * comparaison reste à la charge du lecteur.
 *
 * Composant d'affichage pur — à placer dans le corps d'un `app-carte-info`.
 */
@Component({
  selector: 'app-indicateur-barres-ligne',
  standalone: true,
  imports: [TooltipModule],
  templateUrl: './indicateur-barres-ligne.component.html',
  styleUrl: './indicateur-barres-ligne.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurBarresLigneComponent {
  private readonly i18n = inject(I18nService);

  /** Segments empilés, du bas vers le haut. Au-delà de 5, les suivants sont ignorés. */
  readonly segments = input.required<SegmentBarresLigne[]>();
  readonly ligne = input.required<LigneBarresLigne>();
  /** Libellés courts d'abscisse, un par point (ex. « J », « F »…). */
  readonly libelles = input.required<string[]>();
  /** Libellés longs utilisés dans les infobulles. Repli sur `libelles`. */
  readonly libellesComplets = input<string[]>([]);
  /** Point mis en avant : libellé d'abscisse en gras. Défaut : aucun. */
  readonly indexSurligne = input<number | null>(null);
  /** Index des points prévus : barre atténuée, libellé en italique, infobulle suffixée. */
  readonly indicesPrevision = input<number[]>([]);
  readonly hauteur = input<string>('150px');
  readonly afficherLegende = input<boolean>(true);
  /** Nombre d'intervalles visé sur l'axe Y (le pas est ensuite arrondi). */
  readonly nbGraduations = input<number>(3);
  /** Formate les graduations de l'axe Y et les infobulles par défaut. */
  readonly formateurValeur = input<((valeur: number) => string) | null>(null);
  /** Texte de l'infobulle d'un point. Défaut : `libellé · segments · ligne`. */
  readonly formateurInfobulle = input<((index: number) => string) | null>(null);

  protected readonly nbPoints = computed(() =>
    Math.max(
      this.libelles().length,
      this.ligne().valeurs.length,
      ...this.segments().map((segment) => segment.valeurs.length),
      0,
    ),
  );

  /** Segments retenus (plafonnés ; ceux sans aucune valeur strictement positive sont écartés). */
  private readonly segmentsRetenus = computed<SegmentBarresLigne[]>(() =>
    this.segments()
      .filter((segment) => segment.valeurs.some((v) => Number.isFinite(v) && v > 0))
      .slice(0, NB_MAX_SEGMENTS_BARRES_LIGNE),
  );

  /** Valeurs empilables : non finies et négatives ramenées à 0 (feature #23 §7). */
  private readonly valeursEmpilees = computed<number[][]>(() => {
    const n = this.nbPoints();
    return this.segmentsRetenus().map((segment) =>
      Array.from({ length: n }, (_, i) =>
        Number.isFinite(segment.valeurs[i]) ? Math.max(0, segment.valeurs[i]) : 0,
      ),
    );
  });

  private readonly totaux = computed<number[]>(() => {
    const valeurs = this.valeursEmpilees();
    return Array.from({ length: this.nbPoints() }, (_, i) =>
      valeurs.reduce((somme, valeursSegment) => somme + valeursSegment[i], 0),
    );
  });

  private readonly echelle = computed<EchelleDepuisZero>(() =>
    echelleDepuisZero([...this.totaux(), ...this.ligne().valeurs], this.nbGraduations()),
  );

  private readonly previsions = computed(() => new Set(this.indicesPrevision()));

  protected readonly entreesSegments = computed<SegmentRendu[]>(() =>
    this.segmentsRetenus().map((segment, rang) => ({
      cle: segment.cle,
      libelle: segment.libelle,
      couleur: this.couleurSegment(segment, rang),
    })),
  );

  /** Rectangles empilés, dans l'ordre de tracé (bas vers le haut, point par point). */
  protected readonly rectangles = computed<RectangleRendu[]>(() => {
    const echelle = this.echelle();
    const n = this.nbPoints();
    const valeurs = this.valeursEmpilees();
    const entrees = this.entreesSegments();
    const largeur = largeurBarrePourcent(n);
    const previsions = this.previsions();
    const rectangles: RectangleRendu[] = [];

    for (let i = 0; i < n; i++) {
      const x = abscisseBarrePourcent(i, n);
      const opacite = previsions.has(i) ? OPACITE_PREVISION : 1;
      let cumul = 0;
      valeurs.forEach((valeursSegment, k) => {
        const valeur = valeursSegment[i];
        if (valeur <= 0) return;
        const sommet = ordonneeDepuisZero(cumul + valeur, echelle);
        rectangles.push({
          cle: `${entrees[k].cle}-${i}`,
          x,
          y: sommet,
          largeur,
          hauteur: ordonneeDepuisZero(cumul, echelle) - sommet,
          couleur: entrees[k].couleur,
          opacite,
        });
        cumul += valeur;
      });
    }
    return rectangles;
  });

  protected readonly cheminLigne = computed(() => {
    const echelle = this.echelle();
    const n = this.nbPoints();
    const valeurs = this.ligne().valeurs;
    let chemin = '';
    for (let index = 0; index < n; index++) {
      const valeur = valeurs[index];
      if (!Number.isFinite(valeur)) continue;
      const x = abscissePourcent(index, n).toFixed(3);
      const y = ordonneeDepuisZero(valeur, echelle).toFixed(3);
      chemin += `${chemin ? ' L' : 'M'}${x} ${y}`;
    }
    return chemin;
  });

  protected readonly couleurLigne = computed(() => couleurPleine(this.ligne().ton ?? 'neutre'));

  protected readonly epaisseurLigne = computed(() => this.ligne().epaisseur ?? 2.2);

  /** Pastille de légende de la ligne : hachurée quand le trait est en pointillés. */
  protected readonly fondLegendeLigne = computed(() => {
    const couleur = this.couleurLigne();
    return this.ligne().tiret
      ? `repeating-linear-gradient(90deg, ${couleur} 0 4px, transparent 4px 7px)`
      : couleur;
  });

  protected readonly graduations = computed<GraduationRendue[]>(() => {
    const echelle = this.echelle();
    return echelle.graduations.map((valeur) => ({
      cle: `g${valeur}`,
      y: ordonneeDepuisZero(valeur, echelle),
      texte: this.formater(valeur),
      pointillee: valeur !== 0,
    }));
  });

  protected readonly abscisses = computed<PointAbscisse[]>(() => {
    const libelles = this.libelles();
    const complets = this.libellesComplets();
    const surligne = this.indexSurligne();
    const previsions = this.previsions();
    return Array.from({ length: this.nbPoints() }, (_, index) => ({
      index,
      libelle: libelles[index] ?? '',
      infobulle: this.infobulle(index, complets[index] ?? libelles[index] ?? ''),
      surligne: index === surligne,
      prevision: previsions.has(index),
    }));
  });

  protected readonly descriptionAccessible = computed(() =>
    this.i18n.instant('indicateurs.barresLigne', {
      segments: this.segmentsRetenus().map((segment) => segment.libelle).join(', '),
      ligne: this.ligne().libelle,
    }),
  );

  /**
   * Fond du segment : surface du ton, dans la même famille de couleurs que l'entonnoir
   * « Répartition » mais plus soutenue (`OPACITE_SURFACE_SEGMENT`), les tranches empilées
   * devant rester distinctes ; la ligne de référence, en couleur pleine, reste le trait
   * le plus contrasté.
   */
  private couleurSegment(segment: SegmentBarresLigne, rang: number): string {
    const ton = segment.ton ?? tonCategorie(rang);
    return couleurSurface(ton, segment.intensite ?? OPACITE_SURFACE_SEGMENT);
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

    const valeurs = this.valeursEmpilees();
    const ligne = this.ligne();
    const valeurLigne = ligne.valeurs[index];
    const parties = [
      ...this.segmentsRetenus().map((segment, k) => `${segment.libelle}: ${this.formater(valeurs[k][index])}`),
      `${ligne.libelle}: ${this.formater(Number.isFinite(valeurLigne) ? valeurLigne : 0)}`,
    ];
    if (libelleComplet) {
      const prevision = this.previsions().has(index)
        ? ` (${this.i18n.instant('indicateurs.prevision')})`
        : '';
      parties.unshift(`${libelleComplet}${prevision}`);
    }
    return parties.join(' · ');
  }
}
