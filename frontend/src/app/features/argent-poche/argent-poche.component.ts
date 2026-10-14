import { Component, computed, effect, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MenuModule } from 'primeng/menu';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';

import { ContexteService } from '../../core/services/contexte.service';
import {
  PolitiqueArgentPocheService,
  AllocationArgentPocheService,
} from '../../core/services/argent-poche.service';
import { CompteService } from '../../core/services/referentiel.service';
import { creerChargementReactif } from '../../core/utils/reference-data.util';
import { creerCrudReferentielScenario } from '../../core/utils/crud-referentiel.util';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  AllocationArgentPocheDto, PolitiqueArgentPocheDto, MembreDto,
} from '../../core/models/api.models';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { TagComponent } from '../../shared/components/tag/tag.component';
import { CarteListeComponent, DetailListeComponent, EnteteGroupeComponent, LigneDetail,
  ACTION_MODIFIER, ACTION_SUPPRIMER } from '../../shared/components/liste';
import { ArgentPocheBarreFiltresComponent } from './argent-poche-barre-filtres/argent-poche-barre-filtres.component';
import { PolitiqueFormDialogComponent, PolitiqueArgentPocheRequest } from './politique-form-dialog/politique-form-dialog.component';
import { AllocationFormDialogComponent, AllocationArgentPocheRequest } from './allocation-form-dialog/allocation-form-dialog.component';

/** Discrimine les deux natures d'items affichés dans la liste unique. */
export type TypeArgentPoche = 'POLITIQUE' | 'ALLOCATION';

/**
 * Élément affiché dans la liste unique (fusion politiques + allocations), sur
 * le modèle de {@code PosteAffiche} dans {@code PostesListeComponent} — permet
 * de partager tri/regroupement/séparateurs entre les deux natures d'objets.
 */
export interface ArgentPocheAffiche {
  _type: TypeArgentPoche;
  id: string;
  membreId: string;
  membre?: MembreDto;
  /** Clé de tri chronologique "YYYY-MM" (dateDebut politique / mois allocation). */
  dateDebutTri: string;
  libellePrincipal: string;
  libelleSecondaire: string;
  compteLibelle: string;
  montant?: number;
  montantLibelle: string;
  /** Référence à l'objet source, pour router les actions (édition/suppression). */
  source: PolitiqueArgentPocheDto | AllocationArgentPocheDto;
}

/**
 * PR4 — Écran <b>Argent de poche</b>.
 *
 * <p>Liste unique (façon {@code PostesListeComponent}) mélangeant :
 *   <ul>
 *     <li><b>Politiques récurrentes</b> — période, mode (FIXE / VARIABLE) et
 *         formule.</li>
 *     <li><b>Allocations ponctuelles</b> — une par couple {@code (membre, mois)}.
 *         Prime sur la politique en vigueur.</li>
 *   </ul>
 * Regroupable par membre (défaut), type ou mois de début ; filtrable par type
 * et par membre.</p>
 *
 * <p>Le chevauchement de politiques (même membre) et le doublon d'allocation
 * sont bloqués côté API — les erreurs 409 sont affichées via toast avec le
 * message de l'{@code ApiError}. La popin de politique respecte l'invariant
 * mode ⇄ champs (mode <b>FIXE</b> : montant fixe requis ; mode <b>VARIABLE</b> :
 * socle + pourcentage + plafond requis, plafond ≥ socle) — feedback live.</p>
 */
@Component({
  selector: 'app-argent-poche',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    ButtonComponent, TagComponent,
    SkeletonModule, ConfirmDialogModule, MenuModule,
    CarteListeComponent, DetailListeComponent, EnteteGroupeComponent,
    ArgentPocheBarreFiltresComponent,
    PolitiqueFormDialogComponent, AllocationFormDialogComponent,
  ],
  templateUrl: './argent-poche.component.html',
  styleUrl: './argent-poche.component.scss',
  host: {
    // Échap referme le détail ouvert et rend le focus à la tête de sa carte.
    '(document:keydown.escape)': 'fermerDetail()',
  },
})
export class ArgentPocheComponent {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private politiqueSvc = inject(PolitiqueArgentPocheService);
  private allocationSvc = inject(AllocationArgentPocheService);
  private compteSvc = inject(CompteService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);

  // ── CRUDs mutualisés (mêmes garde-fous switchMap que les autres écrans scénario) ────
  private readonly _crudPolitiques = creerCrudReferentielScenario(
    this.contexte, this.politiqueSvc, this.toast,
    { succes: this.t.commun.succes, erreur: this.t.commun.erreur, suppressionImpossible: this.t.commun.erreur },
  );
  private readonly _crudAllocations = creerCrudReferentielScenario(
    this.contexte, this.allocationSvc, this.toast,
    { succes: this.t.commun.succes, erreur: this.t.commun.erreur, suppressionImpossible: this.t.commun.erreur },
  );

  politiques = this._crudPolitiques.items;
  chargementPolitiques = this._crudPolitiques.chargement;
  allocations = this._crudAllocations.items;
  chargementAllocations = this._crudAllocations.chargement;

  readonly membres = this.contexte.membres;
  private readonly _comptesData = creerChargementReactif(this.contexte.foyerId, foyerId =>
    forkJoin([this.compteSvc.lister(foyerId)]),
  );
  comptes = computed(() => this._comptesData.donnees()?.[0] ?? []);

  // ── UI state ────────────────────────────────────────────────────────────────
  dialogPolitiqueVisible = false;
  dialogAllocationVisible = false;
  politiqueEnEdition: PolitiqueArgentPocheDto | null = null;
  allocationEnEdition: AllocationArgentPocheDto | null = null;

  // ── Liste unique : regroupement + filtres (façon PostesListeComponent) ──────
  readonly regroupement = signal<'MEMBRE' | 'TYPE' | 'MOIS_DEBUT'>('MEMBRE');
  readonly filtreTypes = signal<TypeArgentPoche[]>([]);
  readonly filtreMembreIds = signal<string[]>([]);
  readonly recherche = signal<string>('');

  /** Menu popup du bouton "+" (choix entre politique et allocation). */
  readonly creationMenuItems: MenuItem[] = [
    { label: this.t.argentPoche.creerPolitique, icon: 'pi pi-sync', command: () => this.ouvrirCreationPolitique() },
    { label: this.t.argentPoche.creerAllocation, icon: 'pi pi-calendar-plus', command: () => this.ouvrirCreationAllocation() },
  ];

  // ── Formulaires ─────────────────────────────────────────────────────────────
  // Les deux popins (politique et allocation) sont des parcours guidés autonomes :
  // elles portent leur propre formulaire, leur aperçu et leurs validations, et ne
  // remontent ici que la requête à enregistrer.

  // ── Vue enrichie politiques ─────────────────────────────────────────────────
  politiquesData = computed(() => {
    const mems = this.membres();
    const cptes = this.comptes();
    return this.politiques().map(p => {
      const membre = mems.find(m => m.id === p.membreId);
      const compte = cptes.find(c => c.id === p.compteId);
      return {
        ...p,
        membre,
        compteLibelle: compte?.libelle ?? '',
        periodeLibelle: this._formaterPeriode(p.dateDebut, p.dateFin),
        formuleLibelle: this._formuleLibelle(p),
      };
    });
  });

  // ── Vue enrichie allocations ────────────────────────────────────────────────
  allocationsData = computed(() => {
    const mems = this.membres();
    const cptes = this.comptes();
    return [...this.allocations()]
      .sort((a, b) => (a.mois < b.mois ? 1 : a.mois > b.mois ? -1 : 0))
      .map(a => {
        const membre = mems.find(m => m.id === a.membreId);
        const compte = cptes.find(c => c.id === a.compteId);
        return {
          ...a,
          membreNom: membre?.nom ?? '',
          membreCouleur: membre?.couleur ?? '#6366F1',
          compteLibelle: compte?.libelle ?? '',
          moisLibelle: this._formaterMois(a.mois),
        };
      });
  });

  // ── Liste unique (fusion politiques + allocations, façon PostesListeComponent) ──

  /** Fusionne les deux listes enrichies en une seule vue commune (non filtrée). */
  private readonly _itemsFusionnes = computed<ArgentPocheAffiche[]>(() => {
    const politiques: ArgentPocheAffiche[] = this.politiquesData().map(p => ({
      _type: 'POLITIQUE',
      id: p.id,
      membreId: p.membreId,
      membre: p.membre,
      dateDebutTri: p.dateDebut,
      libellePrincipal: p.nom,
      libelleSecondaire: p.periodeLibelle,
      compteLibelle: p.compteLibelle,
      montant: undefined,
      montantLibelle: p.formuleLibelle,
      source: p,
    }));
    const allocations: ArgentPocheAffiche[] = this.allocationsData().map(a => ({
      _type: 'ALLOCATION',
      id: a.id,
      membreId: a.membreId,
      membre: this.membres().find(m => m.id === a.membreId),
      dateDebutTri: a.mois,
      libellePrincipal: a.raison || this.t.argentPoche.allocationSansRaison,
      libelleSecondaire: a.moisLibelle,
      compteLibelle: a.compteLibelle,
      montant: a.montant,
      montantLibelle: this._formaterMontantCourt(a.montant),
      source: a,
    }));
    return [...politiques, ...allocations];
  });

  /** Liste filtrée selon le type, les membres sélectionnés et la recherche libre. */
  private readonly _itemsFiltres = computed<ArgentPocheAffiche[]>(() => {
    const types = this.filtreTypes();
    const membreIds = this.filtreMembreIds();
    const recherche = this.recherche().trim().toLowerCase();
    return this._itemsFusionnes().filter(item => {
      if (types.length > 0 && !types.includes(item._type)) return false;
      if (membreIds.length > 0 && !membreIds.includes(item.membreId)) return false;
      if (recherche && !item.libellePrincipal.toLowerCase().includes(recherche)) return false;
      return true;
    });
  });

  /** Nombre total d'éléments affichés (tous groupes confondus), pour le badge résultats et l'état vide. */
  readonly nbElementsAffiches = computed(() => this._itemsFiltres().length);

  /**
   * Clé + libellé de séparateur d'un item selon le regroupement actif.
   */
  private _clefSeparateur(item: ArgentPocheAffiche): { clef: string; label: string } {
    switch (this.regroupement()) {
      case 'MEMBRE': {
        const label = item.membre?.nom ?? '–';
        return { clef: item.membreId, label };
      }
      case 'TYPE': {
        const label = this.t.argentPoche.typeOptions[item._type];
        return { clef: item._type, label };
      }
      case 'MOIS_DEBUT': {
        const label = this._formaterMois(item.dateDebutTri);
        return { clef: item.dateDebutTri, label };
      }
    }
  }

  /**
   * Liste finale affichée, regroupée en blocs consécutifs : filtrée, triée (mois
   * de début croissant à l'intérieur de chaque groupe) puis découpée en groupes
   * portant chacun leur bandeau de séparateur (sticky) et le nombre d'éléments
   * — sur le modèle de {@code groupesAffiches} dans {@code PostesListeComponent}
   * (un conteneur par bloc, nécessaire pour que le `position: sticky` se
   * désépingle correctement au profit du bloc suivant lors du scroll).
   */
  readonly groupesAffiches = computed<{ separator: string; nbElements: number; items: ArgentPocheAffiche[] }[]>(() => {
    const filtres = [...this._itemsFiltres()].sort((a, b) => a.dateDebutTri.localeCompare(b.dateDebutTri));

    const groupes = new Map<string, { label: string; items: ArgentPocheAffiche[] }>();
    for (const item of filtres) {
      const { clef, label } = this._clefSeparateur(item);
      const groupe = groupes.get(clef) ?? { label, items: [] };
      groupe.items.push(item);
      groupes.set(clef, groupe);
    }

    // Ordre des groupes : alphabétique du libellé pour MEMBRE/TYPE, chronologique pour MOIS_DEBUT.
    const entrees = Array.from(groupes.entries());
    if (this.regroupement() === 'MOIS_DEBUT') {
      entrees.sort((a, b) => a[0].localeCompare(b[0]));
    } else {
      entrees.sort((a, b) => a[1].label.localeCompare(b[1].label, 'fr'));
    }

    return entrees.map(([, groupe]) => ({ separator: groupe.label, nbElements: groupe.items.length, items: groupe.items }));
  });

  /**
   * Menu d'actions du détail déplié ; les clés `data` pilotent la mise en page.
   */
  actionItemsFor(item: ArgentPocheAffiche): MenuItem[] {
    const items: MenuItem[] = [];
    if (this.contexte.estEditor()) {
      items.push({
        label: this.t.commun.modifier, icon: 'pi pi-pencil', data: ACTION_MODIFIER,
        command: () => item._type === 'POLITIQUE'
          ? this.ouvrirEditionPolitique(item.source as PolitiqueArgentPocheDto)
          : this.ouvrirEditionAllocation(item.source as AllocationArgentPocheDto),
      });
      items.push({
        label: this.t.commun.supprimer, icon: 'pi pi-trash', data: ACTION_SUPPRIMER,
        command: () => item._type === 'POLITIQUE'
          ? this.supprimerPolitique(item.source as PolitiqueArgentPocheDto)
          : this.supprimerAllocation(item.source as AllocationArgentPocheDto),
      });
    }
    return items;
  }

  // ── Détail déplié ───────────────────────────────────────────────────────────
  /** Élément dont le détail est ouvert ; un seul à la fois, comme sur les postes. */
  readonly itemDeplieId = signal<string | null>(null);

  basculerDeplie(item: ArgentPocheAffiche): void {
    this.itemDeplieId.update(id => (id === item.id ? null : item.id));
  }

  /** Échap : referme le détail ouvert et rend le focus à la tête de sa carte. */
  fermerDetail(): void {
    const id = this.itemDeplieId();
    if (!id) return;
    this.itemDeplieId.set(null);
    setTimeout(() => document.querySelector<HTMLElement>(`#argent-poche-${id} .tete`)?.focus());
  }

  libelleBascule(item: ArgentPocheAffiche): string {
    return this.i18n.instant(
      this.itemDeplieId() === item.id ? 'argentPoche.liste.replier' : 'argentPoche.liste.deplier',
      { nom: item.libellePrincipal });
  }

  /** Compteur accessible de l'en-tête de groupe. */
  libelleCompteurGroupe(n: number): string {
    return this.i18n.instant('argentPoche.nbElementsGroupe', { n });
  }

  /**
   * Montant affiché en tête de carte : toujours un chiffre court, jamais la formule
   * complète (qui ne tiendrait pas sur une ligne). Pour une politique VARIABLE, c'est le
   * pourcentage du reste à vivre ; la formule détaillée vit dans le détail déplié.
   */
  montantCarte(item: ArgentPocheAffiche): { valeur: string; unite: string | null } {
    if (item._type === 'ALLOCATION') {
      return { valeur: this._formaterMontantCourt((item.source as AllocationArgentPocheDto).montant), unite: null };
    }
    const p = item.source as PolitiqueArgentPocheDto;
    return p.mode === 'FIXE'
      ? { valeur: this._formaterMontantCourt(p.montantFixe ?? 0), unite: this.t.argentPoche.liste.parMois }
      : { valeur: `${p.pourcentage ?? 0} %`, unite: this.t.argentPoche.liste.duRav };
  }

  /** Paires libellé / valeur du détail déplié, déjà formatées. */
  lignesDetail(item: ArgentPocheAffiche): LigneDetail[] {
    const d = this.t.argentPoche.detail;
    const lignes: LigneDetail[] = [
      { cle: 'membre', libelle: d.membre, valeur: item.membre?.nom ?? '–' },
      { cle: 'compte', libelle: d.compte, valeur: item.compteLibelle || '–' },
    ];

    if (item._type === 'POLITIQUE') {
      const p = item.source as PolitiqueArgentPocheDto;
      lignes.push(
        { cle: 'periode', libelle: d.periode, valeur: item.libelleSecondaire },
        { cle: 'mode', libelle: d.mode, valeur: this.t.argentPoche.modes[p.mode] },
        { cle: 'formule', libelle: d.formule, valeur: item.montantLibelle },
      );
    } else {
      const a = item.source as AllocationArgentPocheDto;
      lignes.push(
        { cle: 'mois', libelle: d.mois, valeur: item.libelleSecondaire },
        { cle: 'montant', libelle: d.montant, valeur: this._formaterMontantCourt(a.montant) },
      );
      if (a.raison) lignes.push({ cle: 'raison', libelle: d.motif, valeur: a.raison });
    }

    return lignes;
  }

  /** Libellé du mode de la politique (utilisé côté template, où l'union du type
   *  source empêche l'indexation directe de `t.argentPoche.modes`). */
  modeLabel(item: ArgentPocheAffiche): string {
    if(item._type === 'POLITIQUE') {
        const p = item.source as PolitiqueArgentPocheDto;
        return this.t.argentPoche.typeOptions[item._type] + " - " + this.t.argentPoche.modes[p.mode];
    } else {
        return this.t.argentPoche.typeOptions[item._type];
    }
  }

  /** Tag combiné "Membre · Compte" (sur le modèle de {@code membresAffichesPoste}
   *  dans {@code PostesListeComponent}), coloré avec la couleur du membre. */
  membreCompteLabel(item: ArgentPocheAffiche): { label: string; couleur: string; couleurTexte: string } | null {
    if (!item.membre) return null;
    const couleur = this.normaliserCouleur(item.membre.couleur);
    const label = item.compteLibelle ? `${item.membre.nom} · ${item.compteLibelle}` : item.membre.nom;
    return { label, couleur, couleurTexte: this.couleurTexteContraste(couleur) };
  }

  normaliserCouleur(couleur?: string): string {
    if (!couleur) return '#64748b';
    return couleur.startsWith('#') ? couleur : `#${couleur}`;
  }

  // Lisibilité minimale des tags, quelle que soit la couleur du membre.
  couleurTexteContraste(hexColor: string): string {
    const hex = hexColor.replace('#', '');
    if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) return '#ffffff';
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
    return luminance > 170 ? '#111827' : '#ffffff';
  }

  readonly chargementListe = computed(() => this.chargementPolitiques() || this.chargementAllocations());

  // ─────────────────────────────────────────────────────────────────────────────
  // Politique — CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  ouvrirCreationPolitique(): void {
    this.politiqueEnEdition = null;
    this.dialogPolitiqueVisible = true;
  }

  ouvrirEditionPolitique(p: PolitiqueArgentPocheDto): void {
    this.politiqueEnEdition = p;
    this.dialogPolitiqueVisible = true;
  }

  /** La popin a validé sa saisie : il ne reste qu'à persister et refermer. */
  enregistrerPolitique(req: PolitiqueArgentPocheRequest): void {
    this._crudPolitiques.enregistrer(this.politiqueEnEdition?.id ?? null, req,
      () => { this.dialogPolitiqueVisible = false; });
  }

  supprimerPolitique(p: PolitiqueArgentPocheDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this._crudPolitiques.supprimer(p.id),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Allocation — CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  ouvrirCreationAllocation(): void {
    this.allocationEnEdition = null;
    this.dialogAllocationVisible = true;
  }

  ouvrirEditionAllocation(a: AllocationArgentPocheDto): void {
    this.allocationEnEdition = a;
    this.dialogAllocationVisible = true;
  }

  /** La popin a validé sa saisie : il ne reste qu'à persister et refermer. */
  enregistrerAllocation(req: AllocationArgentPocheRequest): void {
    this._crudAllocations.enregistrer(this.allocationEnEdition?.id ?? null, req,
      () => { this.dialogAllocationVisible = false; });
  }

  supprimerAllocation(a: AllocationArgentPocheDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this._crudAllocations.supprimer(a.id),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Utilitaires (formatage YearMonth ⇄ Date, période, formule, initiales)
  // ─────────────────────────────────────────────────────────────────────────────

  initiales(m?: MembreDto): string {
    if (!m) return '';
    return m.nom.trim().split(/\s+/).map(mot => mot[0]).slice(0, 2).join('').toUpperCase();
  }

  private _yearMonthToDate(ym: string): Date {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }
  private _dateToYearMonth(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  private _formaterMois(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    return `${this.t.mois[m - 1]} ${y}`;
  }
  private _formaterPeriode(debut: string, fin?: string): string {
    return fin ? `${this._formaterMois(debut)} → ${this._formaterMois(fin)}`
               : `${this._formaterMois(debut)} → …`;
  }
  private _formuleLibelle(p: PolitiqueArgentPocheDto): string {
    return p.mode === 'FIXE'
      ? this.i18n.instant('argentPoche.resume.fixe', {
          montant: this._formaterMontantCourt(p.montantFixe ?? 0),
        })
      : this.i18n.instant('argentPoche.resume.variable', {
          socle:       this._formaterMontantCourt(p.socle ?? 0),
          pourcentage: p.pourcentage ?? 0,
          plafond:     this._formaterMontantCourt(p.plafond ?? 0),
        });
  }
  private _formaterMontantCourt(n: number): string {
    return `${n} ${this.contexte.deviseBase()}`;
  }
}
