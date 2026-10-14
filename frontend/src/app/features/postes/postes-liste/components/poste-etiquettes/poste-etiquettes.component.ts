import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { TagComponent } from '../../../../../shared/components/tag/tag.component';
import { EtiquettePoste, PosteAffiche } from '../../poste-affiche.model';

/** Valeur neutre des trois échelles d'analyse : on n'affiche l'étiquette que hors de cette valeur. */
const VALEUR_NEUTRE = 3;

/**
 * Pied d'étiquettes d'une carte de poste : tout ce qui qualifie le poste sans faire
 * partie de la ligne principale (comptes, catégorie, estimation, mensualisation,
 * révisions, échelles d'analyse). Ne rend rien si aucune étiquette n'est à afficher.
 *
 * Composant de présentation pur : toutes les valeurs sensibles au référentiel
 * (libellés de compte, de catégorie, texte de nature) sont fournies déjà résolues par
 * `PostesListeComponent`.
 */
@Component({
  selector: 'app-poste-etiquettes',
  standalone: true,
  imports: [TagComponent, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './poste-etiquettes.component.html',
  styleUrl: './poste-etiquettes.component.scss',
})
export class PosteEtiquettesComponent {
  private readonly i18n = inject(I18nService);

  readonly poste = input.required<PosteAffiche>();
  /** Option « Cacher les détails » : masque comptes, catégorie et échelles d'analyse. */
  readonly cacherDetails = input(false);
  /** Libellé de catégorie, déjà vidé par le parent quand la liste est groupée par catégorie. */
  readonly categorie = input('');
  /** Étiquettes de comptes (une par membre si les comptes diffèrent), construites par le parent. */
  readonly comptes = input<EtiquettePoste[]>([]);
  /** Texte de nature (« ± 10 % »), dépendant de la locale donc résolu par le parent. */
  readonly natureTexte = input('');
  /** Résumé du maillon suivant masqué (« → 210,00 CHF dès le 01.2027 »), ou `null`. */
  readonly successeurTexte = input<string | null>(null);

  protected readonly etiquettes = computed<EtiquettePoste[]>(() => {
    const p = this.poste();
    const dense = this.cacherDetails();
    const liste: EtiquettePoste[] = [];

    if (!dense) liste.push(...this.comptes());

    if (!dense && this.categorie()) {
      liste.push({ cle: 'categorie', texte: this.categorie(), severity: 'secondary' });
    }

    if (p.nature === 'ESTIMATION') {
      liste.push({ cle: 'estimation', texte: this.natureTexte(), severity: 'warn' });
    }

    if (p.periodiciteMois > 1 && p.mode === 'MENSUALISE') {
      liste.push({
        cle: 'mensualise',
        texte: this.i18n.instant('poste.liste.mensualise'),
        severity: 'secondary',
        tooltip: this.i18n.instant('poste.montantMensualiseTooltip'),
      });
    }

    if (p.posteOrigineId) {
      liste.push({
        cle: 'revision',
        texte: this.i18n.instant('poste.revisionTag'),
        severity: 'info',
        tooltip: this.i18n.instant('poste.revisionTagTooltip'),
      });
    }

    const successeur = this.successeurTexte();
    if (successeur) {
      liste.push({ cle: 'successeur', texte: successeur, severity: 'info' });
    }

    if (p._nbMasquesAvant) {
      liste.push({
        cle: 'masques-avant',
        texte: this.i18n.instant('poste.liste.revisionsMasqueesAvant', { n: p._nbMasquesAvant }),
        severity: 'secondary',
        icone: 'pi pi-angle-up',
      });
    }

    if (p._nbMasquesApres) {
      liste.push({
        cle: 'masques-apres',
        texte: this.i18n.instant('poste.liste.revisionsMasqueesApres', { n: p._nbMasquesApres }),
        severity: 'secondary',
        icone: 'pi pi-angle-down',
      });
    }

    if (!dense) {
      this.ajouterEchelle(liste, 'importance', p.importance, 'poste.importanceValeur');
      this.ajouterEchelle(liste, 'optimisation', p.potentielOptimisation, 'poste.potentielOptimisationValeur');
      this.ajouterEchelle(liste, 'derive', p.deriveExterne, 'poste.deriveExterneValeur', true);
    }

    return liste;
  });

  /** Une échelle d'analyse n'est montrée qu'en dehors de sa valeur neutre (3). */
  private ajouterEchelle(
    liste: EtiquettePoste[], cle: string, valeur: number | undefined, cleI18n: string, avecFleche = false,
  ): void {
    if (!valeur || valeur === VALEUR_NEUTRE) return;
    liste.push({
      cle,
      texte: this.i18n.instant(cleI18n, { n: valeur }),
      severity: 'secondary',
      icone: avecFleche ? (valeur > VALEUR_NEUTRE ? 'pi pi-arrow-up' : 'pi pi-arrow-down') : undefined,
    });
  }
}
