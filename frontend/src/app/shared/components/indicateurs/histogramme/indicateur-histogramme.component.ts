import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { TonIndicateur, couleurDouce, couleurPleine } from '../tons';

interface Barre {
  index: number;
  libelle: string;
  hauteurPct: number;
  couleur: string;
  surlignee: boolean;
  infobulle: string;
}

/**
 * Mini-histogramme : une barre verticale par valeur (hauteur ∝ max, min 3 %), libellés
 * dessous. Composant d'affichage pur — à placer dans le corps d'un `app-carte-info`.
 */
@Component({
  selector: 'app-indicateur-histogramme',
  standalone: true,
  imports: [TooltipModule],
  templateUrl: './indicateur-histogramme.component.html',
  styleUrl: './indicateur-histogramme.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicateurHistogrammeComponent {
  readonly valeurs = input.required<number[]>();
  readonly libelles = input.required<string[]>();
  readonly indexSurligne = input<number | null>(null);
  readonly indicesNegatifs = input<number[]>([]);
  /** Ton des barres (version douce ; pleine pour la barre surlignée). */
  readonly ton = input<TonIndicateur>('info');
  readonly tonNegatif = input<TonIndicateur>('danger');
  readonly hauteur = input<string>('58px');
  readonly formateurInfobulle = input<((valeur: number, index: number) => string) | null>(null);
  /** Rend les barres focusables/cliquables et active `barreClick`. */
  readonly interactif = input<boolean>(false);

  readonly barreClick = output<number>();

  protected readonly barres = computed<Barre[]>(() => {
    const valeurs = this.valeurs();
    const libelles = this.libelles();
    const max = Math.max(0, ...valeurs.map((v) => Math.abs(v)));
    const surligne = this.indexSurligne();
    const negatifs = new Set(this.indicesNegatifs());
    const formateur = this.formateurInfobulle();
    const ton = this.ton();
    const tonNegatif = this.tonNegatif();

    return valeurs.map((valeur, index) => {
      const estSurlignee = index === surligne;
      const couleur = negatifs.has(index)
        ? couleurPleine(tonNegatif)
        : estSurlignee ? couleurPleine(ton) : couleurDouce(ton);
      const libelle = libelles[index] ?? '';
      const texte = formateur ? formateur(valeur, index) : String(valeur);
      return {
        index,
        libelle,
        hauteurPct: max > 0 ? Math.max(3, (Math.abs(valeur) / max) * 100) : 3,
        couleur,
        surlignee: estSurlignee,
        infobulle: libelle ? `${libelle} · ${texte}` : texte,
      };
    });
  });

  protected cliquer(index: number): void {
    if (this.interactif()) this.barreClick.emit(index);
  }
}
