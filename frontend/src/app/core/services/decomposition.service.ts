import { Injectable, inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import {
  CategorieDto, CompteDto, MembreDto, ObjectifDto, ScenarioDto, TypeCategorie,
  VentilationAggregatDto, VentilationSplitDto,
} from '../models/api.models';
import { LigneDecomposition, MembreTagInfo } from '../../shared/components/carte-bilan/carte-bilan.component';
import { normaliserCouleur, couleurTexteContraste } from '../../shared/utils/couleur.util';

/** Forme minimale commune à une ventilation mensuelle ou à un agrégat annuel sommé. */
export interface VentilationLike {
  agregat: VentilationAggregatDto;
  parMembre: Record<string, VentilationAggregatDto>;
  parCategorie: Record<string, number>;
  parCategorieMembre: Record<string, Record<string, number>>;
  parCompteMembre: Record<string, Record<string, number>>;
  parMembreSplit: Record<string, VentilationSplitDto>;
}

/**
 * Construit les décompositions (catégorie / type de poste / compte / cascade
 * perso-partagé) utilisées par les cartes « bilan » membre + foyer, mensuelles et
 * annuelles. Logique portée depuis `dashboard-mensuel` pour être partagée avec
 * `dashboard-annuel` sans duplication.
 */
@Injectable({ providedIn: 'root' })
export class DecompositionService {
  private readonly i18n = inject(I18nService);

  /** Traductions courantes (recalculées à chaque accès, cohérent si la langue change). */
  private get t() {
    return this.i18n.translations();
  }

  /** Initiales (1 à 2 lettres) à partir d'un nom/prénom — utilisées dans les avatars. */
  initiales(nom: string): string {
    return nom.trim().split(/\s+/).map(mot => mot[0]).slice(0, 2).join('').toUpperCase();
  }

  /** Qualifie un taux d'effort selon les seuils indicatifs 70 %/85 %. */
  niveauEffort(taux: number): string {
    if (taux >= 85) return this.t.projection.tauxEffortCritique;
    if (taux >= 70) return this.t.projection.tauxEffortSoutenu;
    return this.t.projection.tauxEffortConfortable;
  }

  tauxEffort(agregat: VentilationAggregatDto): number {
    if (agregat.revenus <= 0) return 0;
    return Math.min((agregat.charges / agregat.revenus) * 100, 100);
  }

  normaliserCouleur(couleur?: string): string {
    return normaliserCouleur(couleur);
  }

  /** Lisibilité minimale des tags, quelle que soit la couleur du membre. */
  couleurTexteContraste(hexColor: string): string {
    return couleurTexteContraste(hexColor);
  }

  /** Libellé de décomposition pour une catégorie RESERVE — préfixe « Objectif · nom » si liée. */
  libelleCategorie(cat: { id: string; libelle: string }, objectifs: ObjectifDto[]): string {
    const objectif = objectifs.find(o => o.categorieProjetId === cat.id);
    return objectif ? `${this.t.projection.objectifPrefixe} ${objectif.libelle}` : cat.libelle;
  }

  compteLibelle(id: string, comptes: CompteDto[]): string {
    return comptes.find(c => c.id === id)?.libelle ?? id.substring(0, 8) + '…';
  }

  /**
   * Tags des membres rattachés à un compte : masqué si le compte n'a qu'un seul membre
   * rattaché et que c'est `excludeMembreId` (redondant avec la carte courante) ; sinon
   * affiche tous les membres rattachés (y compris `excludeMembreId`).
   */
  membresTagsCompte(compteId: string, comptes: CompteDto[], membres: MembreDto[], excludeMembreId?: string): MembreTagInfo[] {
    const compte = comptes.find(c => c.id === compteId);
    const membreIds = compte?.membreIds ?? [];
    if (membreIds.length === 1 && membreIds[0] === excludeMembreId) return [];
    return membres
      .filter(m => membreIds.includes(m.id))
      .map(m => {
        const couleur = this.normaliserCouleur(m.couleur);
        return { membreId: m.id, label: m.nom, couleur, couleurTexte: this.couleurTexteContraste(couleur) };
      });
  }

  construireDecomposition(detail: {
    revenus: { id: string; libelle: string; montant: number }[];
    charges: { id: string; libelle: string; montant: number }[];
    reserves: { id: string; libelle: string; montant: number }[];
  }, objectifs: ObjectifDto[]): LigneDecomposition[] {
    return [
      ...detail.revenus.map(r => ({ id: r.id, libelle: r.libelle, montantAbs: r.montant, signe: 1 as const })),
      ...detail.charges.map(r => ({ id: r.id, libelle: r.libelle, montantAbs: r.montant, signe: -1 as const })),
      ...detail.reserves.map(r => ({ id: r.id, libelle: this.libelleCategorie(r, objectifs), montantAbs: r.montant, signe: -1 as const })),
    ];
  }

  /** Décomposition par catégorie (foyer ou membre) pour un type de poste donné. */
  listeParCategorie(
    type: TypeCategorie,
    categories: CategorieDto[],
    montantParCategorie: (categorieId: string) => number,
  ): { id: string; libelle: string; montant: number }[] {
    return categories
      .filter(c => c.typePoste === type)
      .map(c => ({ id: c.id, libelle: c.libelle, montant: montantParCategorie(c.id) }))
      .filter(r => r.montant !== 0)
      .sort((a, b) => b.montant - a.montant);
  }

  /**
   * Construit les lignes de décomposition « cascade » à partir d'un split perso/partagé
   * (`VentilationSplitDto`) : jusqu'à 6 lignes (revenus perso./partagés, charges
   * perso./partagées, réserves perso./partagées). Les lignes à 0 sont omises.
   */
  cascadeDecompositionDepuisSplit(split: VentilationSplitDto): LigneDecomposition[] {
    const rows: LigneDecomposition[] = [];
    const push = (id: string, libelle: string, montant: number, signe: 1 | -1) => {
      if (Math.abs(montant) >= 0.005) rows.push({ id, libelle, montantAbs: montant, signe });
    };

    push('rev-perso',   this.t.projection.revenusPersonnels,    split.revenusPerso,     1);
    push('rev-partage', this.t.projection.revenusPartages,      split.revenusPartage,   1);
    push('chg-perso',   this.t.projection.chargesPersonnelles,  split.chargesPerso,     -1);
    push('chg-partage', this.t.projection.chargesPartagees,     split.chargesPartage,   -1);
    push('res-perso',   this.t.projection.reservesPersonnelles, split.reservesPerso,    -1);
    push('res-partage', this.t.projection.reservesPartagees,    split.reservesPartage,  -1);

    return rows;
  }

  /** Décomposition « cascade » foyer/membre en mode mono-membre : 3 lignes agrégées. */
  cascadeDecompositionTotal(ag: VentilationAggregatDto): LigneDecomposition[] {
    return [
      { id: 'revenus',  libelle: this.t.projection.revenus,  montantAbs: ag.revenus,  signe: 1 },
      { id: 'charges',  libelle: this.t.projection.charges,  montantAbs: ag.charges,  signe: -1 },
      { id: 'reserves', libelle: this.t.projection.reserves, montantAbs: ag.reserves, signe: -1 },
    ];
  }

  /**
   * Décomposition « cascade » pour un membre : perso/partagé (`v.parMembreSplit`) si
   * multi-membres, sinon totaux agrégés.
   */
  construireCascadeDecomposition(membreId: string, ag: VentilationAggregatDto, v: VentilationLike, nbMembres: number): LigneDecomposition[] {
    if (nbMembres <= 1) return this.cascadeDecompositionTotal(ag);
    const split = v.parMembreSplit?.[membreId];
    return split ? this.cascadeDecompositionDepuisSplit(split) : this.cascadeDecompositionTotal(ag);
  }

  /** Décomposition « cascade » foyer multi-membres : somme des splits perso/partagé de tous les membres. */
  foyerCascadeDecomposition(v: VentilationLike, membres: MembreDto[]): LigneDecomposition[] {
    if (membres.length <= 1) return this.cascadeDecompositionTotal(v.agregat);

    const total: VentilationSplitDto = {
      revenusPerso: 0, revenusPartage: 0,
      chargesPerso: 0, chargesPartage: 0,
      reservesPerso: 0, reservesPartage: 0,
    };
    for (const m of membres) {
      const split = (v.parMembreSplit ?? {})[m.id];
      if (!split) continue;
      total.revenusPerso    += split.revenusPerso;
      total.revenusPartage  += split.revenusPartage;
      total.chargesPerso    += split.chargesPerso;
      total.chargesPartage  += split.chargesPartage;
      total.reservesPerso   += split.reservesPerso;
      total.reservesPartage += split.reservesPartage;
    }
    return this.cascadeDecompositionDepuisSplit(total);
  }

  /** Période de répartition du scénario couvrant le mois/année donnés, pour un membre. */
  periodeEtQuotePart(scenario: ScenarioDto | null, membreId: string, annee: number, mois: number): { quotePart: number; debut?: string; fin?: string } {
    if (!scenario) return { quotePart: 0 };
    const debutMois = new Date(Date.UTC(annee, mois - 1, 1));
    const finMois = new Date(Date.UTC(annee, mois, 0));
    const periode = scenario.periodes.find(p => {
      const debutOk = !p.debut || new Date(p.debut) <= finMois;
      const finOk = !p.fin || new Date(p.fin) >= debutMois;
      return debutOk && finOk;
    });
    if (periode) {
      const part = periode.parts.find(p => p.membreId === membreId);
      return { quotePart: (part?.quotePart ?? 0) * 100, debut: periode.debut, fin: periode.fin };
    }
    const defaut = scenario.repartitions.find(r => r.membreId === membreId);
    return { quotePart: (defaut?.quotePart ?? 0) * 100 };
  }

  /** Sous-titre « Quote-part X % » (répartition par défaut du scénario) pour une carte membre annuelle. */
  sousTitreQuotePartDefaut(scenario: ScenarioDto | null, membreId: string): string {
    if (!scenario) return '';
    const defaut = scenario.repartitions.find(r => r.membreId === membreId);
    return `${this.t.projection.quotePart} ${this.formatPct((defaut?.quotePart ?? 0) * 100)} %`;
  }

  private formatMoisAnnee(iso: string): string {
    const d = new Date(iso);
    return `${this.t.mois[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }

  formatPct(v: number): string {
    return Intl.NumberFormat('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(v);
  }

  /** Sous-titre « Quote-part X % · période … » pour la carte d'un membre (vue mensuelle). */
  sousTitrePeriode(scenario: ScenarioDto | null, membreId: string, annee: number, mois: number): string {
    const { quotePart, debut, fin } = this.periodeEtQuotePart(scenario, membreId, annee, mois);
    const q = `${this.t.projection.quotePart} ${this.formatPct(quotePart)} %`;
    if (!debut && !fin) return q;
    if (debut && fin) {
      return `${q} · ${this.t.projection.periodeDu} ${this.formatMoisAnnee(debut)} ${this.t.projection.periodeAu} ${this.formatMoisAnnee(fin)}`;
    }
    return `${q} · ${this.t.projection.periodeOuvertDepuis} ${this.formatMoisAnnee(debut!)}`;
  }
}
