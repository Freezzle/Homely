import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { forkJoin } from 'rxjs';
import { ContexteService } from '../../../core/services/contexte.service';
import { ProjectionService } from '../../../core/services/projection.service';
import { CategorieService, CompteService } from '../../../core/services/referentiel.service';
import { PosteService, ObjectifService } from '../../../core/services/scenario-poste.service';
import { DecompositionService } from '../../../core/services/decomposition.service';
import { VentilationsDto, VentilationAggregatDto, CategorieDto, CompteDto, TypeCategorie, PosteDto, ObjectifDto } from '../../../core/models/api.models';
import { FR } from '../../../core/i18n/fr';
import { CarteBilanMembreComponent, LigneDecomposition, MembreTagInfo } from '../../../shared/components/carte-bilan-membre/carte-bilan-membre.component';

@Component({
  selector: 'app-dashboard-mensuel',
  standalone: true,
  imports: [
    CommonModule, FormsModule, SelectModule, SelectButtonModule, SkeletonModule,
    CarteBilanMembreComponent,
  ],
  template: `
      <div class="flex flex-col gap-6">

          <!-- ── En-tête + sélecteurs ──────────────────────────────────────────── -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-3">
              <div class="flex-1 min-w-0">
                  <h1 class="text-2xl font-bold">{{ t.nav.dashboardMensuel }}</h1>
                  <p class="text-sm text-surface-500 mt-0.5">
                      Ventilation détaillée de {{ t.mois[mois - 1] }} {{ annee }}
                  </p>
              </div>
              <div class="flex gap-2 shrink-0">
                  @if (afficherParMembre()) {
                      <p-selectbutton [options]="vueOptions" [ngModel]="vue()" (ngModelChange)="vue.set($event)"
                                      optionLabel="label" optionValue="value" [allowEmpty]="false"/>
                  }
                  <p-select appendTo="body" [options]="annees" [(ngModel)]="annee"
                            (onChange)="charger()" styleClass="w-28"/>
                  <p-select appendTo="body" [options]="moisOptions" [(ngModel)]="mois"
                            optionLabel="label" optionValue="value"
                            (onChange)="charger()" styleClass="w-36"/>
              </div>
          </div>

          <!-- ── Skeletons ─────────────────────────────────────────────────────── -->
          @if (chargement()) {
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  @for (i of [1, 2, 3, 4]; track i) {
                      <p-skeleton height="104px" borderRadius="12px"/>
                  }
              </div>
              <p-skeleton height="80px" borderRadius="12px"/>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  @for (i of [1, 2, 3]; track i) {
                      <p-skeleton height="260px" borderRadius="12px"/>
                  }
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  @for (i of [1, 2]; track i) {
                      <p-skeleton height="240px" borderRadius="12px"/>
                  }
              </div>

          } @else if (ventilations()) {

              <!-- ① Cartes membre + foyer (reste à vivre, décomposition, taux d'effort) -->
              <div class="flex items-center justify-start gap-2 mb-1">
                  <p-selectbutton [options]="vueDecompositionOptions" [ngModel]="vueDecomposition()"
                                  (ngModelChange)="vueDecomposition.set($event)"
                                  optionLabel="label" optionValue="value" [allowEmpty]="false"/>
              </div>
              @if (vueEffective() !== 'MEMBRE') {
                  <div class="grid grid-cols-1 gap-4 mb-4">
                      <app-carte-bilan-membre variante="foyer" [nom]="t.projection.foyer" [sousTitre]="foyerSousTitre()"
                                               [initiales]="foyerInitiales()"
                                               [montantPrincipalLabel]="t.projection.resteAVivreMois"
                                               [montantPrincipal]="ventilations()!.agregat.soldeDisponible"
                                               [devise]="deviseBase()" [lignes]="foyerLignesActuelles()"
                                               [tauxEffort]="tauxEffort()"/>
                  </div>
              }

              @if (afficherParMembre() && vueEffective() !== 'FOYER') {
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      @for (mc of membresData(); track mc.id) {
                          <app-carte-bilan-membre variante="membre" [nom]="mc.nom" [sousTitre]="mc.sousTitre"
                                                   [couleur]="mc.couleur" [initiales]="mc.initiales"
                                                   [montantPrincipalLabel]="t.projection.resteAVivreMois"
                                                   [montantPrincipal]="mc.agregat.soldeDisponible"
                                                   [devise]="deviseBase()" [lignes]="lignesMembre(mc)"
                                                   [tauxEffort]="mc.tauxEffort"/>
                      }
                  </div>
              }
          }
      </div>
  `,
})
export class DashboardMensuelComponent implements OnInit {
  readonly t = FR;
  private contexte     = inject(ContexteService);
  private projSvc      = inject(ProjectionService);
  private categorieSvc = inject(CategorieService);
  private compteSvc    = inject(CompteService);
  private posteSvc     = inject(PosteService);
  private objectifSvc  = inject(ObjectifService);
  private decomp       = inject(DecompositionService);

  ventilations = signal<VentilationsDto | null>(null);
  categories   = signal<CategorieDto[]>([]);
  comptes      = signal<CompteDto[]>([]);
  postes       = signal<PosteDto[]>([]);
  objectifs    = signal<ObjectifDto[]>([]);
  chargement   = signal(false);

  readonly deviseBase = this.contexte.deviseBase;

  // membres provient du contexte global (chargé par le Shell)
  readonly membres = this.contexte.membres;

  // ── Vue Foyer / Par membre / Les deux ────────────────────────────────────────
  vue = signal<'FOYER' | 'MEMBRE' | 'TOUT'>('MEMBRE');
  afficherParMembre = computed(() => this.membres().length > 1);
  vueEffective = computed<'FOYER' | 'MEMBRE' | 'TOUT'>(() =>
    this.afficherParMembre() ? this.vue() : 'FOYER'
  );
  readonly vueOptions = [
    { label: this.t.projection.vueFoyer,     value: 'FOYER'  },
    { label: this.t.projection.vueParMembre, value: 'MEMBRE' },
    { label: this.t.projection.vueTout,      value: 'TOUT'   },
  ];

  // ── Vue Catégorie / Type de poste (perso vs partagé) / Compte pour la décomposition ───
  vueDecomposition = signal<'CATEGORIE' | 'TYPE_POSTE' | 'COMPTE'>('TYPE_POSTE');
  readonly vueDecompositionOptions = [
    { label: this.t.projection.vueCategorie,  value: 'CATEGORIE'  },
    { label: this.t.projection.vueTypePoste,  value: 'TYPE_POSTE' },
    { label: this.t.projection.vueCompte,     value: 'COMPTE'     },
  ];

  private etaitMonoMembre = false;

  annee = new Date().getFullYear();
  mois  = new Date().getMonth() + 1;

  annees: number[]  = Array.from({ length: 9 }, (_, i) => new Date().getFullYear() + i);
  moisOptions       = FR.mois.map((label, i) => ({ label, value: i + 1 }));

  formatPct(v: number): string {
    return this.decomp.formatPct(v);
  }

  /** Initiales (1 à 2 lettres) à partir d'un nom/prénom — utilisées dans les avatars. */
  private initiales(nom: string): string {
    return this.decomp.initiales(nom);
  }

  /** Sous-titre « Quote-part X % · période … » pour la carte d'un membre. */
  private sousTitrePeriode(membreId: string): string {
    return this.decomp.sousTitrePeriode(this.contexte.scenarioCourant(), membreId, this.annee, this.mois);
  }

  private construireDecomposition(detail: {
    revenus: { id: string; libelle: string; montant: number }[];
    charges: { id: string; libelle: string; montant: number }[];
    reserves: { id: string; libelle: string; montant: number }[];
  }): LigneDecomposition[] {
    return this.decomp.construireDecomposition(detail, this.objectifs());
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  soldeCardBorder = computed(() =>
    (this.ventilations()?.agregat.soldeDisponible ?? 0) >= 0
      ? 'border-emerald-500'
      : 'border-red-500'
  );

  foyerInitiales = computed(() => this.initiales(this.contexte.foyerCourant()?.nom ?? this.t.projection.foyer));

  foyerSousTitre = computed(() => {
    const nbMembres = this.membres().length;
    const scenarioNom = this.contexte.scenarioCourant()?.nom ?? '';
    return `${nbMembres} ${this.t.projection.membres} · ${this.t.projection.scenarioMot} ${scenarioNom}`;
  });

  foyerDecomposition = computed(() => this.construireDecomposition(this.categoriesParType()));

  /** Décomposition foyer par compte : somme des contributions de tous les membres, par compte. */
  foyerCompteDecomposition = computed<LigneDecomposition[]>(() => {
    const v = this.ventilations();
    if (!v) return [];
    return Object.entries(v.parCompteMembre ?? {})
      .map(([compteId, memMap]) => ({
        id: compteId,
        libelle: this.compteLibelle(compteId),
        montantAbs: Object.values(memMap).reduce((s, m) => s + m, 0),
        signe: -1 as const,
        tags: this.membresTagsCompte(compteId),
      }))
      .filter(c => c.montantAbs !== 0)
      .sort((a, b) => b.montantAbs - a.montantAbs);
  });

  /** Lignes affichées dans la carte foyer, selon le mode de décomposition sélectionné. */
  foyerLignesActuelles = computed(() => {
    switch (this.vueDecomposition()) {
      case 'CATEGORIE':  return this.foyerDecomposition();
      case 'COMPTE':     return this.foyerCompteDecomposition();
      default:           return this.foyerCascadeDecomposition();
    }
  });

  /** Lignes affichées dans la carte d'un membre, selon le mode de décomposition sélectionné. */
  lignesMembre(mc: {
    decomposition: LigneDecomposition[];
    cascadeDecomposition: LigneDecomposition[];
    compteDecomposition: LigneDecomposition[];
  }): LigneDecomposition[] {
    switch (this.vueDecomposition()) {
      case 'CATEGORIE':  return mc.decomposition;
      case 'COMPTE':     return mc.compteDecomposition;
      default:           return mc.cascadeDecomposition;
    }
  }

  private compteLibelle(id: string): string {
    return this.decomp.compteLibelle(id, this.comptes());
  }

  /**
   * Tags des membres rattachés à un compte : masqué si le compte n'a qu'un seul
   * membre rattaché et que c'est `excludeMembreId` (redondant avec la carte courante) ;
   * sinon affiche tous les membres rattachés (y compris `excludeMembreId`).
   */
  private membresTagsCompte(compteId: string, excludeMembreId?: string): MembreTagInfo[] {
    return this.decomp.membresTagsCompte(compteId, this.comptes(), this.membres(), excludeMembreId);
  }

  private categorieMontantParMembre(categorieId: string, membreId: string): number {
    return (this.ventilations()?.parCategorieMembre ?? {})[categorieId]?.[membreId] ?? 0;
  }

  // ── Computed ─────────────────────────────────────────────────────────────────

  tauxEffort = computed(() => this.decomp.tauxEffort(this.ventilations()?.agregat ?? { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 }));

  categoriesParType = computed(() => {
    const v    = this.ventilations();
    const cats = this.categories();
    const makeList = (type: TypeCategorie) =>
      cats
        .filter(c => c.typePoste === type)
        .map(c => ({ id: c.id, libelle: c.libelle, montant: (v?.parCategorie as Record<string, number>)?.[c.id] ?? 0 }))
        .filter(r => r.montant !== 0)
        .sort((a, b) => b.montant - a.montant);
    return {
      revenus:  makeList('REVENU'),
      charges:  makeList('CHARGE'),
      reserves: makeList('RESERVE'),
    };
  });

  membresParType = computed(() => {
    const v    = this.ventilations();
    const mems = this.membres();
    const makeList = (type: keyof VentilationAggregatDto) =>
      mems
        .map(m => ({ id: m.id, libelle: m.nom, montant: (v?.parMembre as Record<string, VentilationAggregatDto>)?.[m.id]?.[type] ?? 0 }))
        .filter(r => r.montant !== 0)
        .sort((a, b) => b.montant - a.montant);
    return {
      revenus:  makeList('revenus'),
      charges:  makeList('charges'),
      reserves: makeList('reserves'),
    };
  });

  totalParType = computed(() => {
    const d   = this.categoriesParType();
    const sum = (rows: { montant: number }[]) => rows.reduce((s, r) => s + r.montant, 0);
    return { revenus: sum(d.revenus), charges: sum(d.charges), reserves: sum(d.reserves) };
  });

  totalParMembreType = computed(() => {
    const d   = this.membresParType();
    const sum = (rows: { montant: number }[]) => rows.reduce((s, r) => s + r.montant, 0);
    return { revenus: sum(d.revenus), charges: sum(d.charges), reserves: sum(d.reserves) };
  });

  // ── Cascade de trésorerie (perso / partagé, calculée par le moteur backend) ─

  /** Décomposition « cascade » foyer multi-membres : somme des splits perso/partagé de tous les membres. */
  foyerCascadeDecomposition = computed(() => {
    const v = this.ventilations();
    if (!v) return [];
    return this.decomp.foyerCascadeDecomposition(v, this.membres());
  });

  membresData = computed(() => {
    const v = this.ventilations();
    if (!v) return [];
    const zero: VentilationAggregatDto = { revenus: 0, charges: 0, reserves: 0, soldeDisponible: 0 };
    const cats = this.categories();
    const nbMembres = this.membres().length;
    return this.membres().map(m => {
      const agregat: VentilationAggregatDto = (v.parMembre ?? {})[m.id] ?? zero;
      const tauxEffort = this.decomp.tauxEffort(agregat);
      const chargesParCompte = Object.entries(v.parCompteMembre ?? {})
        .map(([compteId, memMap]) => ({
          id: compteId,
          libelle: this.compteLibelle(compteId),
          montant: memMap[m.id] ?? 0,
        }))
        .filter(c => c.montant > 0)
        .sort((a, b) => b.montant - a.montant);

      const makeList = (type: TypeCategorie) => cats
        .filter(c => c.typePoste === type)
        .map(c => ({ id: c.id, libelle: c.libelle, montant: this.categorieMontantParMembre(c.id, m.id) }))
        .filter(r => r.montant !== 0)
        .sort((a, b) => b.montant - a.montant);

      return {
        id: m.id, nom: m.nom, couleur: m.couleur,
        initiales: this.initiales(m.nom),
        sousTitre: this.sousTitrePeriode(m.id),
        decomposition: this.construireDecomposition({
          revenus: makeList('REVENU'),
          charges: makeList('CHARGE'),
          reserves: makeList('RESERVE'),
        }),
        cascadeDecomposition: this.decomp.construireCascadeDecomposition(m.id, agregat, v, nbMembres),
        compteDecomposition: chargesParCompte.map(c => ({
          id: c.id, libelle: c.libelle, montantAbs: c.montant, signe: -1 as const,
          tags: this.membresTagsCompte(c.id, m.id),
        })),
        agregat, tauxEffort,
      };
    });
  });

  // ── Effets & chargement ──────────────────────────────────────────────────────

  private readonly _initEffect = effect(() => {
    const sc      = this.contexte.scenarioCourant();
    const foyerId = this.contexte.foyerId();
    if (sc) {
      this.annees = Array.from({ length: sc.horizonAnnees }, (_, i) => sc.anneeDepart + i);
      this.annee  = sc.anneeDepart;
    }
    if (foyerId && sc) {
      forkJoin([
        this.categorieSvc.lister(foyerId),
        this.compteSvc.lister(foyerId),
        this.posteSvc.lister(foyerId, sc.id),
        this.objectifSvc.lister(foyerId, sc.id),
      ]).subscribe(([cats, cptes, postes, objectifs]) => {
        this.categories.set(cats);
        this.comptes.set(cptes);
        this.postes.set(postes);
        this.objectifs.set(objectifs);
        this.charger();
      });
    }
  });

  private readonly _normaliserVueEffect = effect(() => {
    const multiMembres = this.afficherParMembre();
    if (!multiMembres) {
      this.etaitMonoMembre = true;
      if (this.vue() !== 'FOYER') this.vue.set('FOYER');
      return;
    }
    if (this.etaitMonoMembre) {
      this.etaitMonoMembre = false;
      if (this.vue() !== 'MEMBRE') this.vue.set('MEMBRE');
    }
  });

  ngOnInit(): void {}

  charger(): void {
    const foyerId    = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!foyerId || !scenarioId) return;
    this.chargement.set(true);
    this.projSvc.mensuelle(foyerId, scenarioId, this.annee, this.mois).subscribe({
      next: v => { this.ventilations.set(v); this.chargement.set(false); },
      error: () => this.chargement.set(false),
    });
  }
}
