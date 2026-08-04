import { Component, inject, signal, computed, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { CheckboxModule } from 'primeng/checkbox';
import { MenuModule } from 'primeng/menu';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { CategorieService, CompteService } from '../../../core/services/referentiel.service';
import { PosteDto, CategorieDto, CompteDto, MembreDto, VentilationCompteDto, TypePoste, ChampGroupable } from '../../../core/models/api.models';
import { MontantPipe, PeriodicitePipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../core/i18n/locale.util';
import { MembresTagsComponent } from '../../../shared/components/membres-tags/membres-tags.component';
import { toIsoDateLocal } from '../../../core/utils/date.util';
import { formatPeriodeMois, formaterMontantSimple } from '../../../core/utils/format-affichage.util';
import { notifierSucces, notifierErreur } from '../../../core/utils/toast.util';
import { PosteApercuDialogComponent } from '../poste-apercu-dialog/poste-apercu-dialog.component';
import { PosteHistoriqueDrawerComponent, MaillonHistorique } from '../poste-historique-drawer/poste-historique-drawer.component';
import { PosteRevisionDialogComponent } from '../poste-revision-dialog/poste-revision-dialog.component';
import { PosteClotureDialogComponent } from '../poste-cloture-dialog/poste-cloture-dialog.component';
import { PosteDecalageDialogComponent } from '../poste-decalage-dialog/poste-decalage-dialog.component';
import { PosteFormDialogComponent } from '../poste-form-dialog/poste-form-dialog.component';
import { PosteBulkChampDialogComponent } from '../poste-bulk-champ-dialog/poste-bulk-champ-dialog.component';
import { PosteBulkSuppressionDialogComponent } from '../poste-bulk-suppression-dialog/poste-bulk-suppression-dialog.component';

/**
 * Poste enrichi de métadonnées d'affichage calculées côté front pour le regroupement
 * en chaîne de révisions (voir `postesVisibles`). Champs purement transitoires, non
 * envoyés à l'API.
 */
interface PosteAffiche extends PosteDto {
  _estChaine?: boolean;
  _premierDuBloc?: boolean;
  _estActifChaine?: boolean;
  _nbVersions?: number;
  _clefSeparateur?: string;
  _labelSeparateur?: string;
}


@Component({
  selector: 'app-postes-liste',
  standalone: true,
  providers: [ConfirmationService],
  imports: [CommonModule, FormsModule, TableModule, ButtonModule,
            InputTextModule, SelectModule, MultiSelectModule,
            TagModule, TooltipModule, ConfirmDialogModule, SkeletonModule, CheckboxModule,
            MenuModule,
            MontantPipe, PeriodicitePipe, MembresTagsComponent, PosteApercuDialogComponent, PosteHistoriqueDrawerComponent, PosteRevisionDialogComponent, PosteClotureDialogComponent, PosteDecalageDialogComponent, PosteFormDialogComponent,
            PosteBulkChampDialogComponent, PosteBulkSuppressionDialogComponent],
  templateUrl: './postes-liste.component.html',
})
export class PostesListeComponent {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  readonly type = input<TypePoste>('REVENU');
  readonly Math = Math; // Exposition pour le template
  contexte = inject(ContexteService);
  private posteSvc = inject(PosteService);
  private categorieSvc = inject(CategorieService);
  private compteSvc = inject(CompteService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);

  postes = signal<PosteDto[]>([]);
  categories = signal<CategorieDto[]>([]);
  comptes = signal<CompteDto[]>([]);
  chargement = signal(false);
  dialogVisible = false;
  apercuVisible = false;
  posteEnEdition: PosteDto | null = null;
  apercuData = signal<{ annee: number; contributions: { mois: number; contribution: number; }[] } | null>(null);
  membres = this.contexte.membres;

  // ── Révision de montant planifiée ─────────────────────────
  revisionDialogVisible = false;
  posteEnRevision: PosteDto | null = null;

  // ── Clôture rapide (action « Terminer ») ──────────────────
  clotureDialogVisible = false;
  posteEnCloture = signal<PosteDto | null>(null);

  // ── Historique de la chaîne de révisions (lecture seule) ──
  historiqueDrawerVisible = signal(false);
  historiquePosteDescription = signal<string>('');
  historiqueMaillons = signal<MaillonHistorique[]>([]);
  historiqueEvolutionGlobale = signal<{ signe: string; pct: string } | null>(null);
  /** Poste temporairement mis en surbrillance après navigation depuis le drawer d'historique. */
  posteEnSurbrillanceId = signal<string | null>(null);

  // ── Décaler la date d'effet (frontière entre un maillon et son prédécesseur) ──
  decalerDialogVisible = false;
  posteEnDecalage: PosteDto | null = null;

  /** Prédécesseur immédiat du maillon en cours de décalage. */
  precedentEnDecalage = computed(() => {
    const p = this.posteEnDecalage;
    if (!p?.posteOrigineId) return null;
    return this.postes().find(x => x.id === p.posteOrigineId) ?? null;
  });

  /** Successeur éventuel (maillon suivant), qui fige la borne haute s'il existe. */
  successeurEnDecalage = computed(() => {
    const p = this.posteEnDecalage;
    if (!p) return null;
    return this.postes().find(x => x.posteOrigineId === p.id) ?? null;
  });

  // ── Sélection multiple et actions groupées ────────────────────────────────
  /** Mode sélection : les cases à cocher ne sont visibles que lorsqu'il est actif,
   *  pour ne pas encombrer la liste au quotidien. */
  modeSelection = signal(false);
  selection = signal<Set<string>>(new Set());

  /** Ids ciblés par le dialog bulk courant : la sélection multiple, ou un poste unique
   *  (action déclenchée depuis le sous-menu "Changer une valeur" d'un élément isolé). */
  bulkIds = signal<string[]>([]);
  bulkChampDialogVisible = false;
  bulkChampCourant: ChampGroupable = 'CATEGORIE';
  bulkSuppressionDialogVisible = false;

  /** Vrai si au moins un poste sélectionné appartient à une chaîne de révisions :
   *  la suppression groupée est alors désactivée pour éviter une incohérence. */
  selectionContientChaine = computed(() => {
    const ids = this.selection();
    return this.postes().some(p => ids.has(p.id) && this.estDansChaine(p));
  });

  isSelectionne(id: string): boolean {
    return this.selection().has(id);
  }

  toggleSelection(id: string): void {
    const courant = new Set(this.selection());
    if (courant.has(id)) courant.delete(id); else courant.add(id);
    this.selection.set(courant);
  }

  /** Active ou quitte le mode sélection. En quittant, la sélection en cours est vidée. */
  toggleModeSelection(): void {
    if (this.modeSelection()) {
      this.modeSelection.set(false);
      this.effacerSelection();
    } else {
      this.modeSelection.set(true);
    }
  }

  effacerSelection(): void {
    this.selection.set(new Set());
  }

  /** Ouvre le dialog bulk d'un champ donné pour la sélection multiple courante. */
  ouvrirBulkChamp(champ: ChampGroupable): void {
    this.bulkIds.set(Array.from(this.selection()));
    this.bulkChampCourant = champ;
    this.bulkChampDialogVisible = true;
  }

  /** Ouvre le dialog bulk d'un champ donné pour un poste unique (sous-menu individuel). */
  ouvrirBulkChampPourPoste(p: PosteDto, champ: ChampGroupable): void {
    this.bulkIds.set([p.id]);
    this.bulkChampCourant = champ;
    this.bulkChampDialogVisible = true;
  }

  onBulkChampVisibleChange(visible: boolean): void {
    this.bulkChampDialogVisible = visible;
  }

  ouvrirBulkSuppression(): void {
    this.bulkIds.set(Array.from(this.selection()));
    this.bulkSuppressionDialogVisible = true;
  }

  onBulkSuppressionVisibleChange(visible: boolean): void {
    this.bulkSuppressionDialogVisible = visible;
  }

  /** Après une mise à jour groupée réussie : recharge la liste, conserve la sélection active. */
  onBulkChampEnregistre(): void {
    this.charger();
  }

  /** Après une suppression groupée réussie : recharge la liste et vide la sélection. */
  onBulkSuppressionEnregistre(): void {
    this.effacerSelection();
    this.charger();
  }

  triActuel = signal<'DATE' | 'CATEGORIE' | 'DESCRIPTION'>('CATEGORIE');
  cacherInactifs = signal(true);
  cacherFuturs = signal(false);
  filtreCompteIds = signal<string[]>([]);
  filtreMembreIds = signal<string[]>([]);
  filtreCategorieIds = signal<string[]>([]);
  filtreDescription = signal<string>('');

  triOptions = [
    { label: this.t.poste.triOptions.DATE,        value: 'DATE' as const },
    { label: this.t.poste.triOptions.CATEGORIE,   value: 'CATEGORIE' as const },
    { label: this.t.poste.triOptions.DESCRIPTION, value: 'DESCRIPTION' as const },
  ];

  visibiliteMenuItems: MenuItem[] = [
    { label: this.t.poste.cacherInactifs, data: 'cacher-inactifs' },
    { label: this.t.poste.cacherFuturs, data: 'cacher-futurs' },
  ];


  // ── Helpers fenêtre de validité ──────────────────────────
  private readonly _now = new Date();
  private readonly _moisCourant = (() => {
    const d = this._now;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  private readonly _aujourdHuiIso = this.toIso(this._now);

  /** Comparateur de tri appliqué au « représentant » d'un poste isolé ou d'une chaîne. */
  private comparerPostes = (a: PosteDto, b: PosteDto): number => {
    switch (this.triActuel()) {
      case 'DATE': {
        const da = a.debut ?? '9999-12'; const db = b.debut ?? '9999-12';
        if (da !== db) return da.localeCompare(db);
        return (a.fin ?? '9999-12').localeCompare(b.fin ?? '9999-12');
      }
      case 'CATEGORIE': {
        const ca = this.categorieLabel(a.categorieId); const cb = this.categorieLabel(b.categorieId);
        if (ca !== cb) return ca.localeCompare(cb, 'fr');
        if (a.description !== b.description) return a.description.localeCompare(b.description, 'fr');
        return b.montant - a.montant;
      }
      case 'DESCRIPTION': {
        if (a.description !== b.description) return a.description.localeCompare(b.description, 'fr');
        return b.montant - a.montant;
      }
      default: return 0;
    }
  };

  /** Clé + libellé de séparateur pour un poste « représentant » selon le tri actuel. */
  private clefSeparateur(p: PosteDto): { clef: string; label: string } {
    switch (this.triActuel()) {
      case 'DATE':
        return { clef: p.debut?.substring(0, 7) ?? '–', label: this.formatPeriode(p.debut ?? null) };
      case 'CATEGORIE': {
        const label = this.categorieLabel(p.categorieId);
        return { clef: label, label };
      }
      case 'DESCRIPTION': {
        const label = p.description.charAt(0).toUpperCase();
        return { clef: label, label };
      }
      default:
        return { clef: '', label: '' };
    }
  }

  /**
   * Racine (id du tout premier maillon) de la chaîne de révisions à laquelle appartient p.
   * Remonte via posteOrigineId sur la liste complète (non filtrée) du scénario.
   */
  private racineChaine(p: PosteDto, index: Map<string, PosteDto>): string {
    let courant = p;
    const visites = new Set<string>();
    while (courant.posteOrigineId && index.has(courant.posteOrigineId) && !visites.has(courant.id)) {
      visites.add(courant.id);
      courant = index.get(courant.posteOrigineId)!;
    }
    return courant.id;
  }

  /** Liste filtrée (avant tri/regroupement) selon les options de masquage et les filtres actifs. */
  private postesFiltres = computed(() => {
    const compteIds     = this.filtreCompteIds();
    const membreIds     = this.filtreMembreIds();
    const categorieIds  = this.filtreCategorieIds();
    const texteDescription = this.filtreDescription().trim().toLowerCase();
    const tousMembreIds = this.membres().map(m => m.id);

    return this.postes().filter(p => {
      const estInactif = !!p.fin && p.fin.substring(0, 7) < this._moisCourant;
      const estFutur   = !!p.debut && p.debut.substring(0, 7) > this._moisCourant;

      if (this.cacherInactifs() && estInactif) return false;
      if (this.cacherFuturs()   && estFutur)   return false;

      // Filtre catégories
      if (categorieIds.length > 0 && !categorieIds.includes(p.categorieId ?? '')) return false;

      // Filtre texte libre sur la description
      if (texteDescription && !p.description.toLowerCase().includes(texteDescription)) return false;

      // Filtre comptes : au moins une ventilation rattachée à un compte sélectionné
      if (compteIds.length > 0) {
        const match = (p.ventilations ?? []).some(v => compteIds.includes(v.compteId));
        if (!match) return false;
      }

      // Filtre membres (AND) :
      //   CUSTOM       → tous les membres sélectionnés doivent avoir quotePart > 0
      //   AUTO / REVERSE_AUTO → tous les membres actifs sont implicitement concernés ;
      //                         conserver si chaque membre sélectionné appartient au foyer
      if (membreIds.length > 0) {
        let match: boolean;
        if (p.typeRepartition === 'CUSTOM') {
          match = membreIds.every(id => (p.repartitions ?? []).some(r => r.quotePart > 0 && r.membreId === id));
        } else {
          // AUTO / REVERSE_AUTO : tous les membres du foyer sont concernés
          match = membreIds.every(id => tousMembreIds.includes(id));
        }
        if (!match) return false;
      }

      return true;
    });
  });

  // ── Séparateurs de groupe ─────────────────────────────────
  /** Type discriminant : un élément de la liste est soit un poste, soit un séparateur. */
  isSeparator(item: PosteAffiche | { separator: string }): item is { separator: string } {
    return 'separator' in item;
  }

  /** Cast sûr côté template après discrimination par isSeparator(). */
  asPoste(item: PosteAffiche | { separator: string }): PosteAffiche {
    return item as PosteAffiche;
  }

  /**
   * Liste finale affichée : filtrée, regroupée par chaîne de révisions (bloc contigu
   * trié chronologiquement en interne, positionné selon le tri actuel appliqué au
   * maillon actif) puis enrichie de métadonnées d'affichage (_estChaine, _estActifChaine…).
   */
  postesVisibles = computed<PosteAffiche[]>(() => {
    const filtres = this.postesFiltres();
    const indexComplet = new Map(this.postes().map(p => [p.id, p]));

    // Taille réelle de chaque chaîne de révisions, calculée sur la liste complète
    // (non filtrée) : un maillon isolé après masquage (inactifs/futurs) doit quand même
    // afficher la spine s'il appartient à une chaîne d'au moins 2 maillons au total.
    const tailleChaineComplete = new Map<string, number>();
    for (const p of this.postes()) {
      const racine = this.racineChaine(p, indexComplet);
      tailleChaineComplete.set(racine, (tailleChaineComplete.get(racine) ?? 0) + 1);
    }

    const groupes = new Map<string, PosteDto[]>();
    for (const p of filtres) {
      const racine = this.racineChaine(p, indexComplet);
      const liste = groupes.get(racine) ?? [];
      liste.push(p);
      groupes.set(racine, liste);
    }

    const blocs = Array.from(groupes.entries()).map(([racine, membres]) => {
      const tries = [...membres].sort((a, b) => (a.debut ?? '').localeCompare(b.debut ?? ''));
      const actif = tries.find(p => !p.posteSuivantId) ?? tries[tries.length - 1];
      const tailleComplete = tailleChaineComplete.get(racine) ?? tries.length;
      return { membres: tries, representant: actif, estChaine: tailleComplete > 1, tailleComplete };
    });

    blocs.sort((a, b) => this.comparerPostes(a.representant, b.representant));

    const resultat: PosteAffiche[] = [];
    for (const bloc of blocs) {
      const { clef, label } = this.clefSeparateur(bloc.representant);
      bloc.membres.forEach((p, i) => {
        resultat.push({
          ...p,
          _estChaine: bloc.estChaine,
          _premierDuBloc: i === 0,
          _estActifChaine: !p.posteSuivantId,
          _nbVersions: (!p.posteSuivantId && bloc.estChaine) ? bloc.tailleComplete : undefined,
          _clefSeparateur: clef,
          _labelSeparateur: label,
        });
      });
    }
    return resultat;
  });

  /** Liste affichée avec séparateurs de groupe insérés (clé/libellé du représentant de chaque bloc). */
  postesAvecSeparateurs = computed<(PosteAffiche | { separator: string })[]>(() => {
    const result: (PosteAffiche | { separator: string })[] = [];
    let lastKey: string | null = null;

    for (const p of this.postesVisibles()) {
      const key = p._clefSeparateur ?? '';
      if (key !== lastKey) {
        result.push({ separator: p._labelSeparateur ?? '' });
        lastKey = key;
      }
      result.push(p);
    }
    return result;
  });


  private readonly _chargerEffect = effect(() => {
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (foyerId && scenarioId) {
      this.posteSvc.lister(foyerId, scenarioId).subscribe({
        next: all => this.postes.set(all.filter(p => p.type === this.type())),
        error: () => {},
      });
      this.categorieSvc.lister(foyerId, this.type() as any).subscribe(c => this.categories.set(c));
      this.compteSvc.lister(foyerId).subscribe(c => this.comptes.set(c));
    }
  });

  charger(): void {
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!foyerId || !scenarioId) return;
    this.chargement.set(true);
    this.posteSvc.lister(foyerId, scenarioId).subscribe({
      next: all => { this.postes.set(all.filter(p => p.type === this.type())); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }

  categorieLabel(id?: string): string {
    return this.categories().find(c => c.id === id)?.libelle ?? '–';
  }

  natureAffichee(p: PosteDto): string {
    if (p.nature === 'ESTIMATION' && p.estimPourcentage !== null && p.estimPourcentage !== undefined) {
      return `± ${this.formatEstimationPourcentage(p.estimPourcentage)}%`;
    }
    return p.nature === 'ESTIMATION'
      ? this.t.poste.natureOptions.ESTIMATION
      : this.t.poste.natureOptions.EFFECTIF;
  }

  importanceTooltip(n: number): string {
    return this.t.poste.importanceValeur.replace('{{n}}', String(n));
  }

  potentielOptimisationTooltip(n: number): string {
    return this.t.poste.potentielOptimisationValeur.replace('{{n}}', String(n));
  }

  afficheMontantMensualise(p: PosteDto): boolean {
    return p.periodiciteMois !== 0 && p.periodiciteMois !== 1 && p.mode === 'MENSUALISE';
  }

  actionItemsFor(p: PosteDto): MenuItem[] {
    const items: MenuItem[] = [
      { label: this.t.poste.apercu, icon: 'pi pi-eye', command: () => this.ouvrirApercu(p) },
    ];

    if (this.estDansChaine(p)) {
      items.push({ label: this.t.poste.voirHistorique, icon: 'pi pi-history', command: () => this.ouvrirHistorique(p) });
    }

    if (this.contexte.estEditor()) {
      items.push({ label: this.t.commun.modifier, icon: 'pi pi-pencil', command: () => this.ouvrirEdition(p) });
      if (this.estRevisable(p)) {
        items.push({ label: this.t.poste.reviserMontant, icon: 'pi pi-sync', command: () => this.ouvrirRevision(p) });
      }
      if (this.estFusionnable(p)) {
        items.push({ label: this.t.poste.annulerRevision, icon: 'pi pi-replay', command: () => this.annulerRevision(p) });
      }
      if (this.estDecalable(p)) {
        items.push({ label: this.t.poste.decalerDateEffet, icon: 'pi pi-arrows-h', command: () => this.ouvrirDecalage(p) });
      }
      if (this.estActionClotureApplicable(p)) {
        if (this.estPosteTermine(p)) {
          items.push({ label: this.t.poste.reactiver, icon: 'pi pi-play', command: () => this.reactiverPoste(p) });
        } else {
          items.push({ label: this.t.poste.terminer, icon: 'pi pi-stop-circle', command: () => this.ouvrirCloture(p) });
        }
      }
      items.push({
        label: this.t.poste.bulk.sousMenuChangerValeur,
        icon: 'pi pi-sliders-h',
        items: [
          { label: this.t.poste.bulk.actionCategorie, icon: 'pi pi-tag', command: () => this.ouvrirBulkChampPourPoste(p, 'CATEGORIE') },
          { label: this.t.poste.bulk.actionImportance, icon: 'pi pi-heart', command: () => this.ouvrirBulkChampPourPoste(p, 'IMPORTANCE') },
          { label: this.t.poste.bulk.actionPotentiel, icon: 'pi pi-arrows-h', command: () => this.ouvrirBulkChampPourPoste(p, 'POTENTIEL_OPTIMISATION') },
        ],
      });
      items.push({ label: this.t.commun.supprimer, icon: 'pi pi-trash', command: () => this.supprimer(p) });
    }

    return items;
  }

  /** Un poste appartient à une chaîne de révisions s'il a un prédécesseur ou un successeur. */
  estDansChaine(p: PosteDto): boolean {
    return !!p.posteOrigineId || !!p.posteSuivantId;
  }

  /** Un poste est révisable s'il est récurrent (périodicité != 0) et pas déjà terminé dans le passé. */
  estRevisable(p: PosteDto): boolean {
    return p.periodiciteMois !== 0 && !(p.fin != null && p.fin < this._aujourdHuiIso);
  }

  /** Un poste est fusionnable (annulation de révision) s'il est le dernier maillon d'une chaîne. */
  estFusionnable(p: PosteDto): boolean {
    return !!p.posteOrigineId && !p.posteSuivantId;
  }

  /**
   * Un poste est décalable (frontière avec son prédécesseur) s'il a lui-même un
   * prédécesseur — y compris un maillon intermédiaire, contrairement à la fusion qui
   * est réservée au dernier maillon.
   */
  estDecalable(p: PosteDto): boolean {
    return !!p.posteOrigineId;
  }

  /**
   * Les actions rapides « Terminer »/« Réactiver » ne s'appliquent qu'à un poste isolé ou
   * au dernier maillon actif d'une chaîne de révisions (pas encore remplacé) : un maillon
   * intermédiaire ou d'origine a des dates déjà figées par sa position dans la chaîne.
   */
  estActionClotureApplicable(p: PosteDto): boolean {
    return !p.posteSuivantId;
  }

  /** Vrai si le poste est actuellement terminé (date de fin déjà passée). */
  estPosteTermine(p: PosteDto): boolean {
    return !!p.fin && p.fin < this._aujourdHuiIso;
  }

  repartitionsAffichees(p: PosteDto): { membreId: string; quotePart: number; nomMembre: string; couleur: string; couleurTexte: string }[] {
    return p.repartitions
      .filter(r => r.quotePart > 0)
      .map(r => {
        const membre = this.membres().find(m => m.id === r.membreId);
        const couleur = this.normaliserCouleur(membre?.couleur);
        return {
          membreId: r.membreId,
          quotePart: r.quotePart,
          nomMembre: membre?.nom ?? '',
          couleur,
          couleurTexte: this.couleurTexteContraste(couleur),
        };
      })
      .filter(r => r.nomMembre);
  }

  /**
   * Tags membres à afficher dans la liste des postes.
   * AUTO / REVERSE_AUTO → "Nom · Compte" (tous les membres actifs).
   * CUSTOM              → "Nom · XX% · Compte" (uniquement les membres avec quotePart > 0).
   * Mono-membre         → aucun tag (inutile d'afficher l'unique membre).
   * Si aucune ventilation pour le membre, le compte est omis du label.
   */
  membresAffichesPoste(p: PosteDto): { membreId: string; label: string; couleur: string; couleurTexte: string }[] {
    const membres = this.membres();
    // Mono-membre : inutile d'afficher un tag
    if (membres.length <= 1) return [];

    /** Helper : libellé du compte ventilé pour un membre donné (ou '' si absent). */
    const compteLabel = (membreId: string): string => {
      const ventilation = p.ventilations?.find(v => v.membreId === membreId);
      if (!ventilation) return '';
      return this.libelleCompteVentilationPourMembre(ventilation, membreId);
    };

    if (p.typeRepartition === 'CUSTOM') {
      // Parts explicites stockées → afficher avec pourcentage + compte
      return this.repartitionsAffichees(p).map(r => {
        const compte = compteLabel(r.membreId);
        const label = compte
          ? `${r.nomMembre} · ${Math.round(r.quotePart * 100)}% · ${compte}`
          : `${r.nomMembre} · ${Math.round(r.quotePart * 100)}%`;
        return { membreId: r.membreId, label, couleur: r.couleur, couleurTexte: r.couleurTexte };
      });
    }

    // AUTO ou REVERSE_AUTO (ou null = AUTO) → tous les membres actifs, nom + compte
    return membres.map(m => {
      const couleur = this.normaliserCouleur(m.couleur);
      const couleurTexte = this.couleurTexteContraste(couleur);
      const compte = compteLabel(m.id);
      const label = compte ? `${m.nom} · ${compte}` : m.nom;
      return { membreId: m.id, label, couleur, couleurTexte };
    });
  }

  /** Membres rattachés à un compte (pour l'affichage dans le filtre). */
  membresForCompte(compte: CompteDto): MembreDto[] {
    return this.membres().filter(m => compte.membreIds?.includes(m.id));
  }


  private libelleCompteVentilationPourMembre(ventilation: VentilationCompteDto, membreId: string): string {
    const compte = this.comptes().find(c => c.id === ventilation.compteId);
    const libelle = ventilation.libelleCompte || compte?.libelle || '';
    if (!compte || compte.membreIds?.includes(membreId)) return libelle;
    const nomsMembres = this.nomsMembresDuCompte(compte.membreIds ?? []);
    return nomsMembres ? `${libelle} ${this.t.commun.de} ${nomsMembres}` : libelle;
  }

  private nomsMembresDuCompte(membreIds: string[]): string {
    if (!membreIds.length) return '';
    const mapMembres = new Map(this.membres().map(m => [m.id, m.nom]));
    return membreIds
      .map(id => mapMembres.get(id))
      .filter((nom): nom is string => !!nom)
      .join(', ');
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

  ouvrirCreation(): void {
    this.posteEnEdition = null;
    this.dialogVisible = true;
  }

  ouvrirEdition(p: PosteDto): void {
    this.posteEnEdition = p;
    this.dialogVisible = true;
  }

  /** Intercepte la fermeture du dialog poste-form-dialog (confirmation gérée par le composant lui-même). */
  onDialogPosteVisibleChange(v: boolean): void {
    this.dialogVisible = v;
    if (!v) this.posteEnEdition = null;
  }

  ouvrirApercu(p: PosteDto): void {
    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const sc = this.contexte.scenarioCourant();
    this.posteSvc.apercu(foyerId, scenarioId, p.id, sc?.anneeDepart ?? new Date().getFullYear())
      .subscribe(a => { this.apercuData.set(a); this.apercuVisible = true; });
  }

  supprimer(p: PosteDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => {
        const foyerId = this.contexte.foyerId()!;
        const scenarioId = this.contexte.scenarioId()!;
        this.posteSvc.supprimer(foyerId, scenarioId, p.id).subscribe({
          next: () => { notifierSucces(this.toast, this.t.commun.succes); this.charger(); },
          error: (err) => notifierErreur(this.toast, this.t.commun.erreur, err),
        });
      },
    });
  }

  private toIso(d: Date): string { return toIsoDateLocal(d); }

  private localeCourante(): string {
    return localeDeLangue(this.i18n.currentLang());
  }

  /** Formater un pourcentage avec 1 décimale */
  formatEstimationPourcentage(pct: number): string {
    return new Intl.NumberFormat(this.localeCourante(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(pct);
  }

  typeAccentClass = computed(() => {
    switch (this.type()) {
      case 'REVENU':  return 'bg-green-500';
      case 'CHARGE':  return 'bg-red-400';
      default:        return 'bg-indigo-400';
    }
  });

  formatPeriode(v?: string | null): string {
    return formatPeriodeMois(v, this.localeCourante());
  }

  formaterMontant(montant: number, devise?: string): string {
    return formaterMontantSimple(montant, this.localeCourante(), devise);
  }

  private formaterDateComplete(iso: string): string {
    const [year, month, day] = iso.split('-');
    const d = new Date(+year, +month - 1, +day);
    return new Intl.DateTimeFormat(this.localeCourante(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  }

  ouvrirCloture(p: PosteDto): void {
    this.posteEnCloture.set(p);
    this.clotureDialogVisible = true;
  }

  /** Suit la fermeture (par la croix ou l'overlay) du dialog clôture, en plus du bouton Annuler. */
  onClotureVisibleChange(visible: boolean): void {
    this.clotureDialogVisible = visible;
    if (!visible) this.posteEnCloture.set(null);
  }

  /** Réactive un poste terminé : retire sa fin directement, sans popin. */
  reactiverPoste(p: PosteDto): void {
    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    this.posteSvc.reactiver(foyerId, scenarioId, p.id).subscribe({
      next: () => {
        this.toast.add({
          severity: 'success', summary: this.t.commun.succes,
          detail: this.i18n.instant('poste.reactiverConfirmation', { description: p.description }),
        });
        this.charger();
      },
      error: (err) => notifierErreur(this.toast, this.t.commun.erreur, err),
    });
  }

  ouvrirRevision(p: PosteDto): void {
    this.posteEnRevision = p;
    this.revisionDialogVisible = true;
  }

  fermerDialogRevision(): void {
    this.revisionDialogVisible = false;
    this.posteEnRevision = null;
  }

  /** Suit la fermeture (par la croix ou l'overlay) du dialog révision, en plus du bouton Annuler. */
  onRevisionVisibleChange(visible: boolean): void {
    this.revisionDialogVisible = visible;
    if (!visible) this.posteEnRevision = null;
  }

  /** Rafraîchit la liste après une action réussie effectuée par un dialog enfant autonome (révision/clôture/décalage). */
  onDialogEnregistre(): void {
    this.charger();
  }

  ouvrirDecalage(p: PosteDto): void {
    this.posteEnDecalage = p;
    this.decalerDialogVisible = true;
  }

  /** Suit la fermeture (par la croix ou l'overlay) du dialog décalage, en plus du bouton Annuler. */
  onDecalageVisibleChange(visible: boolean): void {
    this.decalerDialogVisible = visible;
    if (!visible) this.posteEnDecalage = null;
  }

  /**
   * Ouvre le drawer d'historique de la chaîne de révisions à laquelle appartient p.
   * Reconstruit la chaîne complète (racine → maillon actif) depuis la liste déjà
   * chargée en mémoire (this.postes()) : aucun appel réseau dédié n'est nécessaire.
   */
  ouvrirHistorique(p: PosteDto): void {
    const index = new Map(this.postes().map(x => [x.id, x]));
    const racineId = this.racineChaine(p, index);
    const membres = this.postes()
      .filter(x => this.racineChaine(x, index) === racineId)
      .sort((a, b) => (a.debut ?? '').localeCompare(b.debut ?? ''));

    if (membres.length === 0) return;

    const maillons: MaillonHistorique[] = membres.map((m, i) => {
      const periode = `${this.formatPeriode(m.debut)} – ${m.fin ? this.formatPeriode(m.fin) : (i === membres.length - 1 ? this.t.poste.historiquePeriodeEnCours : '–')}`;
      if (i === 0) {
        return { posteId: m.id, periode, montant: m.montant, devise: m.devise, ecartLabel: null, ecartPositif: null };
      }
      const precedent = membres[i - 1];
      const ecartMontant = m.montant - precedent.montant;
      const ecartPourcentage = precedent.montant !== 0 ? (ecartMontant / precedent.montant) * 100 : null;
      const ecartLabel = this.i18n.instant('poste.historiqueEcart', {
        signe: ecartMontant >= 0 ? '+' : '',
        montant: this.formaterMontant(ecartMontant, m.devise),
        pct: ecartPourcentage !== null ? ecartPourcentage.toFixed(1) : '–',
      });
      return { posteId: m.id, periode, montant: m.montant, devise: m.devise, ecartLabel, ecartPositif: ecartMontant >= 0 };
    });

    const premier = membres[0];
    const dernier = membres[membres.length - 1];
    const evolutionGlobale = membres.length > 1 && premier.montant !== 0
      ? ((dernier.montant - premier.montant) / premier.montant) * 100
      : null;

    this.historiquePosteDescription.set(p.description);
    this.historiqueMaillons.set(maillons);
    this.historiqueEvolutionGlobale.set(
      evolutionGlobale !== null ? { signe: evolutionGlobale >= 0 ? '+' : '', pct: evolutionGlobale.toFixed(1) } : null
    );
    this.historiqueDrawerVisible.set(true);
  }

  /**
   * Navigation depuis un maillon du drawer vers sa carte dans la liste : ferme le
   * drawer, fait défiler jusqu'à la carte concernée et la met brièvement en surbrillance.
   */
  navigerVersPoste(posteId: string): void {
    this.historiqueDrawerVisible.set(false);
    setTimeout(() => {
      this.posteEnSurbrillanceId.set(posteId);
      document.getElementById('poste-' + posteId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => this.posteEnSurbrillanceId.set(null), 2000);
    }, 200);
  }

  /**
   * Annule la révision d'un poste : fusionne le maillon actif avec son prédécesseur.
   * Affiche une confirmation concrète (montant et fin restaurés) avant d'exécuter
   * l'opération atomique côté serveur.
   */
  annulerRevision(p: PosteDto): void {
    const precedent = this.postes().find(x => x.id === p.posteOrigineId);
    if (!precedent) return;

    const montantActuel = this.formaterMontant(p.montant, p.devise);
    const montantPrecedent = this.formaterMontant(precedent.montant, precedent.devise);
    const message = precedent.fin
      ? this.i18n.instant('poste.annulerRevisionConfirmationAvecFin', {
          montant: montantActuel,
          description: precedent.description,
          montantPrecedent,
          finPrecedente: this.formaterDateComplete(precedent.fin),
        })
      : this.i18n.instant('poste.annulerRevisionConfirmationSansFin', {
          montant: montantActuel,
          description: precedent.description,
          montantPrecedent,
        });

    this.confirm.confirm({
      message,
      header: this.i18n.instant('poste.annulerRevisionTitre', { description: precedent.description }),
      accept: () => {
        const foyerId = this.contexte.foyerId()!;
        const scenarioId = this.contexte.scenarioId()!;
        this.posteSvc.annulerRevision(foyerId, scenarioId, p.id).subscribe({
          next: () => { notifierSucces(this.toast, this.t.commun.succes); this.charger(); },
          error: (err) => notifierErreur(this.toast, this.t.commun.erreur, err),
        });
      },
    });
  }
}
