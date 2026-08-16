import { Component, computed, effect, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { MessageModule } from 'primeng/message';
import { MenuModule } from 'primeng/menu';
import { MeterGroupModule, MeterItem } from 'primeng/metergroup';
import { SliderModule } from 'primeng/slider';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';

import { ContexteService } from '../../core/services/contexte.service';
import {
  PolitiqueArgentPocheService,
  AllocationArgentPocheService,
  ResolutionArgentPocheService,
} from '../../core/services/argent-poche.service';
import { CompteService } from '../../core/services/referentiel.service';
import { creerChargementReactif } from '../../core/utils/reference-data.util';
import { creerCrudReferentielScenario } from '../../core/utils/crud-referentiel.util';
import { MontantPipe } from '../../core/pipes/format.pipes';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  AllocationArgentPocheDto, PolitiqueArgentPocheDto,
  ModePolitiqueArgentPoche, MembreDto, SourceArgentPoche, RavBrutMoisDto,
} from '../../core/models/api.models';
import {
  DatePickerComponent, InputNumberComponent, InputTextComponent,
  SelectComponent, SelectButtonComponent, MultiSelectComponent,
} from '../../shared/components/form-fields';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { TagComponent } from '../../shared/components/tag/tag.component';

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
    CommonModule, FormsModule, ReactiveFormsModule,
    ButtonComponent, DialogModule, TagComponent,
    SkeletonModule, ConfirmDialogModule, AvatarModule, TooltipModule, MessageModule,
    MenuModule, MeterGroupModule, SliderModule,
    InputTextComponent, InputNumberComponent, DatePickerComponent,
    SelectComponent, SelectButtonComponent, MultiSelectComponent,
    MontantPipe,
  ],
  templateUrl: './argent-poche.component.html',
})
export class ArgentPocheComponent {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  contexte = inject(ContexteService);
  private politiqueSvc = inject(PolitiqueArgentPocheService);
  private allocationSvc = inject(AllocationArgentPocheService);
  private resolutionSvc = inject(ResolutionArgentPocheService);
  private compteSvc = inject(CompteService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

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

  readonly modeOptions = [
    { label: this.t.argentPoche.modes.VARIABLE, value: 'VARIABLE' as ModePolitiqueArgentPoche },
    { label: this.t.argentPoche.modes.FIXE,     value: 'FIXE'     as ModePolitiqueArgentPoche },
  ];

  // ── Liste unique : regroupement + filtres (façon PostesListeComponent) ──────
  readonly regroupement = signal<'MEMBRE' | 'TYPE' | 'MOIS_DEBUT'>('MEMBRE');
  readonly filtreTypes = signal<TypeArgentPoche[]>([]);
  readonly filtreMembreIds = signal<string[]>([]);

  readonly regroupementOptions = [
    { label: this.t.argentPoche.regroupementOptions.MEMBRE,     value: 'MEMBRE' as const },
    { label: this.t.argentPoche.regroupementOptions.TYPE,       value: 'TYPE' as const },
    { label: this.t.argentPoche.regroupementOptions.MOIS_DEBUT, value: 'MOIS_DEBUT' as const },
  ];

  readonly filtreTypeOptions = [
    { label: this.t.argentPoche.typeOptions.POLITIQUE,  value: 'POLITIQUE' as TypeArgentPoche },
    { label: this.t.argentPoche.typeOptions.ALLOCATION, value: 'ALLOCATION' as TypeArgentPoche },
  ];

  /** Menu popup du bouton "+" (choix entre politique et allocation). */
  readonly creationMenuItems: MenuItem[] = [
    { label: this.t.argentPoche.creerPolitique, icon: 'pi pi-sync', command: () => this.ouvrirCreationPolitique() },
    { label: this.t.argentPoche.creerAllocation, icon: 'pi pi-calendar-plus', command: () => this.ouvrirCreationAllocation() },
  ];

  // ── Formulaires ─────────────────────────────────────────────────────────────
  formPolitique = this.fb.group({
    nom:         ['', [Validators.required, Validators.maxLength(160)]],
    membreId:    [null as string | null, Validators.required],
    compteId:    [null as string | null, Validators.required],
    dateDebut:   [null as Date | null,   Validators.required],
    dateFin:     [null as Date | null],
    mode:        ['VARIABLE' as ModePolitiqueArgentPoche, Validators.required],
    socle:       [0 as number | null,      [Validators.min(0)]],
    pourcentage: [0 as number | null,      [Validators.min(0), Validators.max(100)]],
    plafond:     [0 as number | null,      [Validators.min(0)]],
    montantFixe: [null as number | null,   [Validators.min(0)]],
  });

  formAllocation = this.fb.group({
    membreId: [null as string | null, Validators.required],
    compteId: [null as string | null, Validators.required],
    mois:     [null as Date | null,   Validators.required],
    montant:  [0,                     [Validators.required, Validators.min(0.01)]],
    raison:   [''],
  });

  constructor() {
    // Rafraîchit la résolution dès que (membre, mois) change dans la popin.
    this.formAllocation.valueChanges
      .pipe(
        debounceTime(150),
        distinctUntilChanged((a, b) => a.membreId === b.membreId && a.mois?.getTime() === b.mois?.getTime()),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this._actualiserResolutionInterne());

    // Rafraîchit l'aperçu "6 prochains mois" (RàV + formule) dès qu'un champ du
    // formulaire de politique change, uniquement pendant que la popin est ouverte.
    this.formPolitique.valueChanges
      .pipe(debounceTime(100), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => { if (this.dialogPolitiqueVisible) this._actualiserApercuPolitiqueInterne(); });

    // Passage explicite en mode VARIABLE (clic utilisateur — `dirty`, donc pas
    // au premier `reset()`/`setValue()` d'ouverture de la popin en édition) :
    // préremplit le pourcentage à 50% immédiatement, et arme le préremplissage
    // du socle/plafond (appliqué dès que la moyenne RàV de la fenêtre 6 mois
    // est disponible, voir l'effect ci-dessous).
    this.formPolitique.get('mode')!.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(mode => {
        if (mode === 'VARIABLE' && this.formPolitique.get('mode')!.dirty) {
          this.formPolitique.patchValue({ pourcentage: 50 });
          this._demandePrefillVariable.set(true);
        }
      });

    // Applique le préremplissage socle/plafond dès que la moyenne RàV de la
    // fenêtre (6 mois depuis dateDebut) devient disponible — peut être différé
    // si membre/dateDebut ne sont pas encore renseignés au moment du clic.
    effect(() => {
      if (!this._demandePrefillVariable()) return;
      const ravParMois = this._apercuFenetreData.donnees();
      if (!ravParMois) return;
      const dateDebut = this.formPolitique.get('dateDebut')!.value as Date | null;
      const dateFin = this.formPolitique.get('dateFin')!.value as Date | null;
      const fenetre = this._fenetreSixMois(dateDebut, dateFin);
      if (fenetre.length === 0) return;
      const valeurs = fenetre.map(({ annee, mois }) => ravParMois.get(`${annee}-${mois}`) ?? 0);
      const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
      // `Math.min`/`Math.max` (plutôt que 20%/70% directs) garantit plafond ≥
      // socle même si la moyenne RàV est négative (contrainte validée par le
      // back-end, voir `ArgentPocheService`).
      const vingtPct = Math.round(moyenne * 0.2);
      const soixanteDixPct = Math.round(moyenne * 0.7);
      this.formPolitique.patchValue({
        socle: Math.min(vingtPct, soixanteDixPct),
        plafond: Math.max(vingtPct, soixanteDixPct),
      });
      this._demandePrefillVariable.set(false);
    });
  }

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

  /** Liste filtrée selon le type et les membres sélectionnés. */
  private readonly _itemsFiltres = computed<ArgentPocheAffiche[]>(() => {
    const types = this.filtreTypes();
    const membreIds = this.filtreMembreIds();
    return this._itemsFusionnes().filter(item => {
      if (types.length > 0 && !types.includes(item._type)) return false;
      if (membreIds.length > 0 && !membreIds.includes(item.membreId)) return false;
      return true;
    });
  });

  /** Clé + libellé de séparateur d'un item selon le regroupement actif. */
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
   * Liste finale affichée : filtrée, regroupée (mois de début croissant à
   * l'intérieur de chaque groupe) puis enrichie de séparateurs de groupe —
   * sur le modèle de {@code postesAvecSeparateurs}.
   */
  readonly itemsAvecSeparateurs = computed<(ArgentPocheAffiche | { separator: string })[]>(() => {
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

    const resultat: (ArgentPocheAffiche | { separator: string })[] = [];
    for (const [, groupe] of entrees) {
      resultat.push({ separator: groupe.label });
      resultat.push(...groupe.items);
    }
    return resultat;
  });

  /** Type discriminant pour le template : un élément est un item ou un séparateur. */
  isSeparator(item: ArgentPocheAffiche | { separator: string }): item is { separator: string } {
    return 'separator' in item;
  }

  /** Cast sûr côté template après discrimination par isSeparator(). */
  asItem(item: ArgentPocheAffiche | { separator: string }): ArgentPocheAffiche {
    return item as ArgentPocheAffiche;
  }

  /** Menu d'actions (icône + popup), routé vers la bonne méthode selon le type. */
  actionItemsFor(item: ArgentPocheAffiche): MenuItem[] {
    const items: MenuItem[] = [];
    if (this.contexte.estEditor()) {
      items.push({
        label: this.t.commun.modifier, icon: 'pi pi-pencil',
        command: () => item._type === 'POLITIQUE'
          ? this.ouvrirEditionPolitique(item.source as PolitiqueArgentPocheDto)
          : this.ouvrirEditionAllocation(item.source as AllocationArgentPocheDto),
      });
      items.push({
        label: this.t.commun.supprimer, icon: 'pi pi-trash',
        command: () => item._type === 'POLITIQUE'
          ? this.supprimerPolitique(item.source as PolitiqueArgentPocheDto)
          : this.supprimerAllocation(item.source as AllocationArgentPocheDto),
      });
    }
    return items;
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

    typeSeverity(item: ArgentPocheAffiche): 'info' | 'warn' {
        return item._type === 'ALLOCATION' ? 'warn' : 'info';
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

  // ── Résolution en direct dans la popin d'allocation ─────────────────────────
  private readonly _resolution = signal<{ montant: number; source: SourceArgentPoche } | null>(null);
  readonly resolution = this._resolution.asReadonly();

  /** Vrai après un passage explicite en mode VARIABLE (clic utilisateur) tant
   *  que le préremplissage socle/plafond (moyenne RàV × 20%/70%) n'a pas
   *  encore pu être appliqué faute de données RàV disponibles — voir l'effect
   *  du constructeur. */
  private readonly _demandePrefillVariable = signal(false);

  // ── Aperçu "6 prochains mois" en direct dans la popin de politique ──────────
  // PR6 — instantané des champs pertinents du formulaire (mis à jour à chaque
  // frappe pendant que la popin est ouverte, voir constructeur). Séparé en deux
  // parties : (membreId, dateDebut, dateFin) qui déterminent la <b>fenêtre</b> de
  // mois à afficher et déclenchent le chargement réseau du RàV brut, et le reste
  // (mode/socle/pourcentage/plafond/montantFixe) qui n'affecte que le calcul
  // local de la formule — pas de nouvel appel réseau à chaque frappe sur ces
  // derniers champs.
  private readonly _apercuSnapshot = signal<{
    membreId: string | null; dateDebut: Date | null; dateFin: Date | null;
    mode: ModePolitiqueArgentPoche; socle: number | null; pourcentage: number | null;
    plafond: number | null; montantFixe: number | null;
  } | null>(null);

  private readonly _apercuFenetreCle = computed<{ foyerId: string; scenarioId: string; membreId: string; annees: number[] } | null>(() => {
    const snap = this._apercuSnapshot();
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!snap || !snap.membreId || !foyerId || !scenarioId) return null;
    const fenetre = this._fenetreSixMois(snap.dateDebut, snap.dateFin);
    const annees = [...new Set(fenetre.map(f => f.annee))];
    return { foyerId, scenarioId, membreId: snap.membreId, annees };
  }, {
    // `_apercuSnapshot` change à chaque frappe (mode/socle/%/plafond/montantFixe
    // inclus), mais seuls (membre, dateDebut, dateFin) doivent déclencher un
    // rechargement réseau du RàV — égalité par valeur pour éviter de recharger
    // à chaque champ de formule modifié.
    equal: (a, b) => a === b || (a !== null && b !== null
      && a.foyerId === b.foyerId && a.scenarioId === b.scenarioId && a.membreId === b.membreId
      && a.annees.length === b.annees.length && a.annees.every((v, i) => v === b.annees[i])),
  });

  /** Charge le RàV brut (indépendant de toute politique persistée) pour la ou
   *  les 2 années couvertes par la fenêtre de 6 mois — 1 seul appel réseau la
   *  plupart du temps, 2 seulement si la fenêtre chevauche un réveillon. */
  private readonly _apercuFenetreData = creerChargementReactif(this._apercuFenetreCle, ({ foyerId, scenarioId, membreId, annees }) =>
    forkJoin(annees.map(annee => this.resolutionSvc.ravBrutAnnee(foyerId, scenarioId, membreId, annee)))
      .pipe(switchMap(parAnnee => {
        const map = new Map<string, number>();
        parAnnee.forEach((liste, i) => liste.forEach((r: RavBrutMoisDto) => map.set(`${annees[i]}-${r.mois}`, r.rav)));
        return of(map);
      })),
  );

  /** Aperçu affiché dans la popin politique : 6 lignes (mois, RàV brut, argent
   *  de poche calculé selon la formule <b>en cours d'édition</b> — mise à jour
   *  au fil de la frappe, y compris pour une politique non encore enregistrée). */
  readonly apercuPolitique = computed(() => {
    const snap = this._apercuSnapshot();
    const ravParMois = this._apercuFenetreData.donnees();
    if (!snap || !ravParMois) return [];
    return this._fenetreSixMois(snap.dateDebut, snap.dateFin).map(({ annee, mois }) => {
      const rav = ravParMois.get(`${annee}-${mois}`) ?? 0;
      const montant = this._calculerMontantPolitique(snap.mode, snap.socle, snap.pourcentage, snap.plafond, snap.montantFixe, rav);
      const couleur = this._classifierMontant(snap.mode, snap.socle, snap.plafond, snap.montantFixe, rav, montant);
      const couleurCss = this._couleurCss(couleur);
      // Dénominateur toujours le RàV du mois (jamais `montant`) : sinon dès que
      // le montant dépasse le RàV, le ratio value/max resterait bloqué à 1 quel
      // que soit l'écart, et la barre semblerait figée pour tout changement
      // ultérieur du % (report utilisateur) — clampée à `rav` ici, elle continue
      // de refléter proportionnellement chaque variation du % tant que le
      // montant reste sous le RàV, puis se fige à 100% (pleine, en rouge) une
      // fois celui-ci atteint ou dépassé.
      const meterMax = Math.max(rav, 1e-9);
      const meterValue = Math.max(0, Math.min(montant, rav));
      return {
        moisLibelle: `${this.t.mois[mois - 1]} ${annee}`,
        rav,
        montant,
        couleur,
        couleurCss,
        meterItems: [{ value: meterValue, color: couleurCss }] as MeterItem[],
        meterMax,
      };
    });
  });

  readonly chargementApercuPolitique = computed(() => this._apercuFenetreData.chargement());

  // ─────────────────────────────────────────────────────────────────────────────
  // Politique — CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  ouvrirCreationPolitique(): void {
    this.politiqueEnEdition = null;
    this.formPolitique.reset({
      nom: '', membreId: null, compteId: null,
      dateDebut: null, dateFin: null,
      mode: 'VARIABLE',
      socle: 0, pourcentage: 50, plafond: 0, montantFixe: null,
    });
    this.dialogPolitiqueVisible = true;
    this._actualiserApercuPolitiqueInterne();
    // Mode VARIABLE par défaut à la création — arme le préremplissage
    // socle/plafond dès que membre + dateDebut seront renseignés (voir effect
    // du constructeur), sans attendre un clic explicite sur le toggle.
    this._demandePrefillVariable.set(true);
  }

  ouvrirEditionPolitique(p: PolitiqueArgentPocheDto): void {
    this.politiqueEnEdition = p;
    this.formPolitique.setValue({
      nom: p.nom,
      membreId: p.membreId,
      compteId: p.compteId,
      dateDebut: this._yearMonthToDate(p.dateDebut),
      dateFin: p.dateFin ? this._yearMonthToDate(p.dateFin) : null,
      mode: p.mode,
      socle: p.socle ?? 0,
      pourcentage: p.pourcentage ?? 0,
      plafond: p.plafond ?? 0,
      montantFixe: p.montantFixe ?? null,
    });
    this.dialogPolitiqueVisible = true;
    this._actualiserApercuPolitiqueInterne();
    // Édition d'une politique existante — jamais de préremplissage automatique
    // (les valeurs persistées font foi tant que l'utilisateur ne re-choisit pas
    // explicitement VARIABLE via le toggle).
    this._demandePrefillVariable.set(false);
  }

  enregistrerPolitique(): void {
    if (!this._validerPolitique()) return;
    const v = this.formPolitique.getRawValue();
    const req = {
      membreId:    v.membreId!,
      compteId:    v.compteId!,
      nom:         v.nom!,
      dateDebut:   this._dateToYearMonth(v.dateDebut!),
      dateFin:     v.dateFin ? this._dateToYearMonth(v.dateFin) : undefined,
      mode:        v.mode!,
      socle:       v.mode === 'VARIABLE' ? (v.socle ?? 0)       : undefined,
      pourcentage: v.mode === 'VARIABLE' ? (v.pourcentage ?? 0) : undefined,
      plafond:     v.mode === 'VARIABLE' ? (v.plafond ?? 0)     : undefined,
      montantFixe: v.mode === 'FIXE'     ? (v.montantFixe ?? 0) : undefined,
    };
    this._crudPolitiques.enregistrer(this.politiqueEnEdition?.id ?? null, req,
      () => { this.dialogPolitiqueVisible = false; });
  }

  supprimerPolitique(p: PolitiqueArgentPocheDto): void {
    this.confirm.confirm({
      message: this.t.commun.confirmerSuppression,
      accept: () => this._crudPolitiques.supprimer(p.id),
    });
  }

  /**
   * Validation métier miroir de {@code ArgentPocheService} (spec §7) — bloque
   * le clic <i>Enregistrer</i> tant que la combinaison mode/champs n'est pas
   * cohérente, sans attendre un aller-retour serveur.
   */
  private _validerPolitique(): boolean {
    const v = this.formPolitique.getRawValue();
    if (v.mode === 'FIXE') {
      if (v.montantFixe == null || v.montantFixe <= 0) {
        this.toast.add({ severity: 'warn', summary: this.t.argentPoche.erreurs.modeFixeMontantRequis });
        return false;
      }
    } else {
      if (v.socle == null || v.pourcentage == null || v.plafond == null) {
        this.toast.add({ severity: 'warn', summary: this.t.argentPoche.erreurs.modeVariableChampsRequis });
        return false;
      }
      if (v.plafond < v.socle) {
        this.toast.add({ severity: 'warn', summary: this.t.argentPoche.erreurs.plafondInferieurSocle });
        return false;
      }
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Allocation — CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  ouvrirCreationAllocation(): void {
    this.allocationEnEdition = null;
    this.formAllocation.reset({
      membreId: null, compteId: null, mois: null, montant: 0, raison: '',
    });
    this._resolution.set(null);
    this.dialogAllocationVisible = true;
  }

  ouvrirEditionAllocation(a: AllocationArgentPocheDto): void {
    this.allocationEnEdition = a;
    this.formAllocation.setValue({
      membreId: a.membreId,
      compteId: a.compteId,
      mois: this._yearMonthToDate(a.mois),
      montant: a.montant,
      raison: a.raison ?? '',
    });
    this._resolution.set(null);
    this.dialogAllocationVisible = true;
  }

  /**
   * Recalcule à la demande le montant théorique issu de la politique en vigueur
   * pour la paire {@code (membre, mois)} choisie — utile pour prépositionner
   * l'utilisateur avant qu'il ne saisisse l'exception.
   */
  private _actualiserResolutionInterne(): void {
    if (!this.dialogAllocationVisible) return;
    const v = this.formAllocation.getRawValue();
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!foyerId || !scenarioId || !v.membreId || !v.mois) { this._resolution.set(null); return; }
    this.resolutionSvc.resoudre(foyerId, scenarioId, v.membreId, this._dateToYearMonth(v.mois))
      .subscribe({
        next: r => this._resolution.set({ montant: r.montant, source: r.source }),
        error: () => this._resolution.set(null),
      });
  }

  /**
   * Recopie l'état courant du formulaire de politique dans {@link _apercuSnapshot}
   * — déclenche la mise à jour de l'aperçu "6 prochains mois" (chargement réseau
   * du RàV brut si la fenêtre a changé, recalcul local sinon).
   */
  private _actualiserApercuPolitiqueInterne(): void {
    const v = this.formPolitique.getRawValue();
    this._apercuSnapshot.set({
      membreId: v.membreId, dateDebut: v.dateDebut, dateFin: v.dateFin,
      mode: v.mode!, socle: v.socle, pourcentage: v.pourcentage,
      plafond: v.plafond, montantFixe: v.montantFixe,
    });
  }

  /**
   * Fenêtre de 6 mois consécutifs démarrant à {@code dateDebut} (ou au mois
   * courant si non renseignée — décision produit PR6), plafonnée à
   * {@code dateFin} si celle-ci tombe avant le 6ᵉ mois. Peut donc renvoyer entre
   * 1 et 6 éléments.
   */
  private _fenetreSixMois(dateDebut: Date | null, dateFin: Date | null): { annee: number; mois: number }[] {
    const debut = dateDebut ?? new Date();
    const resultat: { annee: number; mois: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(debut.getFullYear(), debut.getMonth() + i, 1);
      if (dateFin && d.getFullYear() > dateFin.getFullYear()
          || (dateFin && d.getFullYear() === dateFin.getFullYear() && d.getMonth() > dateFin.getMonth())) {
        break;
      }
      resultat.push({ annee: d.getFullYear(), mois: d.getMonth() + 1 });
    }
    return resultat;
  }

  /**
   * Miroir exact côté client de {@code ArgentPocheService.calculerFormule} —
   * nécessaire pour l'aperçu live d'une politique <b>en cours d'édition</b>,
   * potentiellement non encore enregistrée (donc pas résolvable via l'API).
   *
   * <p>Mode {@code VARIABLE} : le pourcentage s'applique directement au RàV
   * brut du mois (pas à un surplus RàV − socle) ; le socle sert de plancher
   * (versé tel quel si le résultat du pourcentage tombe en dessous), le
   * plafond de plafond absolu.</p>
   */
  private _calculerMontantPolitique(
    mode: ModePolitiqueArgentPoche,
    socle: number | null, pourcentage: number | null, plafond: number | null,
    montantFixe: number | null, rav: number,
  ): number {
    if (mode === 'FIXE') return montantFixe ?? 0;
    const s = socle ?? 0;
    const pct = pourcentage ?? 0;
    const pla = plafond ?? 0;
    const brut = rav * pct / 100;
    return Math.min(Math.max(brut, s), pla);
  }

  /**
   * Classification couleur de l'aperçu, par mois — reflète le "risque" de la
   * formule vis-à-vis du RàV disponible ce mois-là :
   * <ul>
   *   <li><b>FIXE</b> : rouge si le montant fixe dépasse le RàV du mois
   *       (ponction plus grande que ce qui est disponible), or sinon —
   *       aucune notion de socle/plafond en mode fixe.</li>
   *   <li><b>VARIABLE</b> : rouge si le montant est plafonné (le pourcentage
   *       du RàV a atteint {@code plafond}), vert si le montant vaut
   *       exactement le socle (plancher atteint, pourcentage du RàV en
   *       dessous du socle), or entre les deux.</li>
   * </ul>
   */
  private _classifierMontant(
    mode: ModePolitiqueArgentPoche,
    socle: number | null, plafond: number | null, montantFixe: number | null,
    rav: number, montant: number,
  ): 'rouge' | 'vert' | 'or' | 'neutre' {
    if (mode === 'FIXE') {
      return (montantFixe ?? 0) > rav ? 'rouge' : 'or';
    }
    const s = socle ?? 0;
    const pla = plafond ?? 0;
    if (montant >= pla) return 'rouge';
    if (montant <= s) return 'vert';
    return 'or';
  }

  /** Couleur CSS (charte --app-*) associée à une classification. */
  private _couleurCss(couleur: 'rouge' | 'vert' | 'or' | 'neutre'): string {
    switch (couleur) {
      case 'rouge': return 'var(--app-danger)';
      case 'vert': return 'var(--app-success)';
      case 'or': return 'var(--app-argent-poche)';
      default: return 'var(--p-surface-400)';
    }
  }

  enregistrerAllocation(): void {
    const v = this.formAllocation.getRawValue();
    const req = {
      membreId: v.membreId!,
      compteId: v.compteId!,
      mois:     this._dateToYearMonth(v.mois!),
      montant:  v.montant!,
      raison:   v.raison || undefined,
    };
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
