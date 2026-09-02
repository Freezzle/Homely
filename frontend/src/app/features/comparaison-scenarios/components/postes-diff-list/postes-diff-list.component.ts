import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageModule } from 'primeng/message';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TagComponent, TagSeverity } from '../../../../shared/components/tag/tag.component';
import { SelectButtonComponent } from '../../../../shared/components/form-fields';
import {
  FiltrePostesDiff, PosteDiffRow, StatutDiffPoste,
} from '../../data/comparaison-scenarios.models';
import { compterParStatut, filtrerPostesDiff, trierPostesDiff } from '../../data/comparaison-scenarios.util';
import { estNul, formatMontant, formatMontantSigne, signeEcart, TIRET_NUL } from '../../data/format-montant.util';
import { localeDeLangue } from '../../../../core/i18n/locale.util';

const SEVERITE_PAR_STATUT: Record<StatutDiffPoste, TagSeverity> = {
  AJOUTE: 'success',
  SUPPRIME: 'danger',
  MODIFIE: 'warn',
  INCHANGE: 'secondary',
};

const ICONE_PAR_STATUT: Record<StatutDiffPoste, string> = {
  AJOUTE: 'pi-plus',
  SUPPRIME: 'pi-minus',
  MODIFIE: 'pi-pencil',
  INCHANGE: 'pi-minus',
};

const COULEUR_BORDURE_STATUT: Record<StatutDiffPoste, string> = {
  AJOUTE: 'var(--p-primary-500)',
  SUPPRIME: 'var(--p-red-500)',
  MODIFIE: 'var(--p-amber-500)',
  INCHANGE: 'var(--app-line)',
};

/**
 * Diff poste à poste (docs/features/feature_5_bis §9).
 *
 * En-tête : `<p-selectbutton>` de filtre (Changements / Ajoutés / Supprimés /
 * Modifiés / Tout) + compteur textuel « N ajouté(s) · N supprimé(s) · N
 * modifié(s) · N inchangé(s) » calculé **avant** filtrage.
 *
 * Une ligne = 3 colonnes (`1.75rem / 1fr / auto`), bordure gauche colorée
 * selon le statut, badge icône, description en gras, tag statut, tag
 * « révision » si `posteOrigineId` renseigné, métadonnées catégorie/périodicité/
 * dates/estimation, montants alignés à droite (ancien barré + nouveau gras +
 * effet net « / an » ou « sans effet »).
 */
@Component({
  selector: 'app-postes-diff-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MessageModule, TagComponent, SelectButtonComponent],
  templateUrl: './postes-diff-list.component.html',
  styleUrl: './postes-diff-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostesDiffListComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();

  readonly lignes = input.required<PosteDiffRow[]>();
  readonly devise = input<string>('CHF');

  protected readonly filtre = signal<FiltrePostesDiff>('CHANGES');

  protected readonly filtreOptions = computed(() => [
    { label: this.t.comparaisonScenarios.postesDiff.filtreChangements, value: 'CHANGES' as FiltrePostesDiff },
    { label: this.t.comparaisonScenarios.postesDiff.filtreAjoutes, value: 'AJOUT' as FiltrePostesDiff },
    { label: this.t.comparaisonScenarios.postesDiff.filtreSupprimes, value: 'SUPPR' as FiltrePostesDiff },
    { label: this.t.comparaisonScenarios.postesDiff.filtreModifies, value: 'MODIF' as FiltrePostesDiff },
    { label: this.t.comparaisonScenarios.postesDiff.filtreTout, value: 'TOUS' as FiltrePostesDiff },
  ]);

  protected readonly compteur = computed(() => compterParStatut(this.lignes()));

  protected readonly compteurTexte = computed(() => {
    const c = this.compteur();
    const d = this.t.comparaisonScenarios.postesDiff;
    return d.compteur
      .replace('{ajoute}', String(c.AJOUTE))
      .replace('{supprime}', String(c.SUPPRIME))
      .replace('{modifie}', String(c.MODIFIE))
      .replace('{inchange}', String(c.INCHANGE))
      .replace('{mAjoute}', c.AJOUTE > 1 ? d.mAjoutePluriel : d.mAjouteSingulier)
      .replace('{mSupprime}', c.SUPPRIME > 1 ? d.mSupprimePluriel : d.mSupprimeSingulier)
      .replace('{mModifie}', c.MODIFIE > 1 ? d.mModifiePluriel : d.mModifieSingulier)
      .replace('{mInchange}', c.INCHANGE > 1 ? d.mInchangePluriel : d.mInchangeSingulier);
  });

  protected readonly lignesFiltrees = computed(() =>
    trierPostesDiff(filtrerPostesDiff(this.lignes(), this.filtre())));

  protected severite(statut: StatutDiffPoste): TagSeverity {
    return SEVERITE_PAR_STATUT[statut];
  }

  protected icone(statut: StatutDiffPoste): string {
    return ICONE_PAR_STATUT[statut];
  }

  protected couleurBordure(statut: StatutDiffPoste): string {
    return COULEUR_BORDURE_STATUT[statut];
  }

  protected libelleStatut(statut: StatutDiffPoste): string {
    switch (statut) {
      case 'AJOUTE': return this.t.comparaisonScenarios.postesDiff.statutAjoute;
      case 'SUPPRIME': return this.t.comparaisonScenarios.postesDiff.statutSupprime;
      case 'MODIFIE': return this.t.comparaisonScenarios.postesDiff.statutModifie;
      case 'INCHANGE': return this.t.comparaisonScenarios.postesDiff.statutInchange;
    }
  }

  protected montant(v: number | null | undefined): string {
    if (v == null) return TIRET_NUL;
    return formatMontant(v, this.i18n.currentLang());
  }

  protected effetTexte(ligne: PosteDiffRow): string {
    if (estNul(ligne.effetNet)) return this.t.comparaisonScenarios.postesDiff.sansEffet;
    return `${formatMontantSigne(ligne.effetNet, this.i18n.currentLang())} ${this.t.comparaisonScenarios.postesDiff.effetAn}`;
  }

  protected couleurEffet(ligne: PosteDiffRow): string {
    const s = signeEcart(ligne.effetNet);
    if (s === 'positif') return 'var(--app-positif)';
    if (s === 'negatif') return 'var(--app-negatif)';
    return 'var(--app-ink-muted)';
  }

  /** Ligne de métadonnées (feature_5_bis §9) : Catégorie · périodicité[· dès X]
   *  [· jusqu'au Y][· estimation]. */
  protected metadonnees(ligne: PosteDiffRow): string {
    const parts: string[] = [];
    if (ligne.categorieLibelle) parts.push(ligne.categorieLibelle);
    parts.push(this.periodiciteTexte(ligne));
    if (ligne.debut) parts.push(this.t.comparaisonScenarios.postesDiff.des.replace('{date}', this.dateFr(ligne.debut)));
    if (ligne.fin) parts.push(this.t.comparaisonScenarios.postesDiff.jusquAu.replace('{date}', this.dateFr(ligne.fin)));
    if (ligne.nature === 'ESTIMATION') parts.push(this.t.comparaisonScenarios.postesDiff.estimation);
    return parts.join(' · ');
  }

  protected suffixeModif(ligne: PosteDiffRow): string {
    if (ligne.statut !== 'MODIFIE' || ligne.montantAvant == null || ligne.montantApres == null) return '';
    if (ligne.montantAvant === ligne.montantApres) return '';
    return ' · ' + this.t.comparaisonScenarios.postesDiff.montantChange
      .replace('{ancien}', formatMontant(ligne.montantAvant, this.i18n.currentLang()))
      .replace('{nouveau}', formatMontant(ligne.montantApres, this.i18n.currentLang()))
      .replace('{devise}', ligne.devise ?? this.devise());
  }

  private periodiciteTexte(ligne: PosteDiffRow): string {
    const d = this.t.comparaisonScenarios.postesDiff;
    if (ligne.periodiciteMois === 0) return d.periodicitePonctuel;
    if (ligne.periodiciteMois === 1) return d.periodiciteMensuel;
    if (ligne.mode === 'PERIODIQUE') {
      const moment = ligne.moment === 'FIN_PERIODE' ? d.momentFin : d.momentDebut;
      return d.periodicitePeriodique.replace('{n}', String(ligne.periodiciteMois)).replace('{moment}', moment);
    }
    return d.periodiciteMensualise.replace('{n}', String(ligne.periodiciteMois));
  }

  private dateFr(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(localeDeLangue(this.i18n.currentLang()), {
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(d);
  }
}

