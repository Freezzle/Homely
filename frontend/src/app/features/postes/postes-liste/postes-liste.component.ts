import { Component, inject, signal, computed, input, effect, ViewChild, ElementRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, FormArray, FormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { startWith } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { DatePickerModule } from 'primeng/datepicker';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { DrawerModule } from 'primeng/drawer';
import { CheckboxModule } from 'primeng/checkbox';
import { MenuModule } from 'primeng/menu';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { CategorieService, CompteService, TauxChangeService } from '../../../core/services/referentiel.service';
import { PosteDto, CategorieDto, CompteDto, MembreDto, VentilationCompteDto, TypePoste, TypeRepartition } from '../../../core/models/api.models';
import { MontantPipe, PeriodicitePipe } from '../../../core/pipes/format.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../core/i18n/locale.util';
import { creerDevisesDisponibles } from '../../../core/utils/devise-options.util';
import { TagComponent } from '../../../shared/components/tag/tag.component';
import { toIsoDateLocal, parseIsoDateLocal } from '../../../core/utils/date.util';
import { arrondirSommeRepartition, sommeRepartitionValide as estSommeRepartitionValide } from '../../../core/utils/repartition.util';
import { formatPeriodeMois, formaterMontantSimple } from '../../../core/utils/format-affichage.util';
import { notifierSucces, notifierErreur } from '../../../core/utils/toast.util';
import { PosteApercuDialogComponent } from '../poste-apercu-dialog/poste-apercu-dialog.component';
import { PosteHistoriqueDrawerComponent, MaillonHistorique } from '../poste-historique-drawer/poste-historique-drawer.component';
import { PosteRevisionDialogComponent } from '../poste-revision-dialog/poste-revision-dialog.component';
import { PosteClotureDialogComponent } from '../poste-cloture-dialog/poste-cloture-dialog.component';
import { PosteDecalageDialogComponent } from '../poste-decalage-dialog/poste-decalage-dialog.component';

/**
 * Validateur de groupe : la date de fin (si renseignée) ne peut pas être
 * antérieure à la date de début. Sans ce garde-fou, le formulaire principal
 * autorisait l'enregistrement de périodes incohérentes (`fin < debut`).
 */
function datesCoherentesValidator(group: AbstractControl): ValidationErrors | null {
  const debut = group.get('debut')?.value as Date | null;
  const fin = group.get('fin')?.value as Date | null;
  if (debut && fin && fin.getTime() < debut.getTime()) {
    return { finAvantDebut: true };
  }
  return null;
}

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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule,
            InputTextModule, InputNumberModule, SelectModule, MultiSelectModule, DatePickerModule,
            TagModule, TooltipModule, CardModule, MessageModule, ConfirmDialogModule, SkeletonModule, DrawerModule, CheckboxModule,
            MenuModule, SelectButtonModule,
            MontantPipe, PeriodicitePipe, TagComponent, PosteApercuDialogComponent, PosteHistoriqueDrawerComponent, PosteRevisionDialogComponent, PosteClotureDialogComponent, PosteDecalageDialogComponent],
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
  private tauxChangeSvc = inject(TauxChangeService);
  private toast = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  postes = signal<PosteDto[]>([]);
  categories = signal<CategorieDto[]>([]);
  comptes = signal<CompteDto[]>([]);
  chargement = signal(false);
  enregistrementEnCours = signal(false);
  dialogVisible = false;
  apercuVisible = false;
  posteEnEdition: PosteDto | null = null;
  apercuData = signal<{ annee: number; contributions: { mois: number; contribution: number; }[] } | null>(null);
  membres = this.contexte.membres;
  sommeRepartition = 0;

  /** Tolérance flottante : une somme visuellement à 100% ne doit jamais être refusée à tort. */
  get sommeRepartitionValide(): boolean {
    return estSommeRepartitionValide(this.sommeRepartition);
  }

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

  modeOptions = [
    { label: this.t.poste.modeOptions.MENSUALISE, value: 'MENSUALISE' },
    { label: this.t.poste.modeOptions.PERIODIQUE, value: 'PERIODIQUE' },
  ];

  momentOptions = [
    { label: this.t.poste.momentOptions.DEBUT_PERIODE, value: 'DEBUT_PERIODE' },
    { label: this.t.poste.momentOptions.FIN_PERIODE,   value: 'FIN_PERIODE' },
  ];

  natureOptions = [
    { label: this.t.poste.natureOptions.EFFECTIF,  value: 'EFFECTIF' },
    { label: this.t.poste.natureOptions.ESTIMATION, value: 'ESTIMATION' },
  ];

  // ── Mini-questionnaire structurel (façade UI au-dessus du form réactif) ──
  @ViewChild('descriptionInput') private descriptionInput?: ElementRef<HTMLInputElement>;

  frequenceChoisie = signal<'PONCTUEL' | 'RECURRENT' | null>(null);
  sousFrequence    = signal<'MENSUEL' | 'AUTRE' | null>(null);
  /** Q « Qui est concerné » : Tous les membres, ou un seul membre en particulier. */
  quiConcerneChoice = signal<'TOUS' | 'MEMBRE_UNIQUE' | null>(null);
  /** Sous-question affichée quand quiConcerneChoice = TOUS : quel type de répartition. */
  quiRepartition = signal<TypeRepartition | null>(null);
  membreUniqueId = signal<string | null>(null);
  private _focusDescriptionFait = false;

  frequenceOptions = [
    { label: this.t.poste.questionnaire.ponctuel,  value: 'PONCTUEL' as const },
    { label: this.t.poste.questionnaire.recurrent, value: 'RECURRENT' as const },
  ];

  sousFrequenceOptions = [
    { label: this.t.poste.questionnaire.chaqueMois,     value: 'MENSUEL' as const },
    { label: this.t.poste.questionnaire.autreFrequence, value: 'AUTRE' as const },
  ];

  quiConcerneOptions = [
    { label: this.t.poste.questionnaire.quiTous,         value: 'TOUS' as const },
    { label: this.t.poste.questionnaire.quiMembreUnique, value: 'MEMBRE_UNIQUE' as const },
  ];

  quiRepartitionOptions = [
    { label: this.t.poste.questionnaire.repartitionScenario,        value: 'AUTO' as TypeRepartition },
    { label: this.t.poste.questionnaire.repartitionScenarioInverse, value: 'REVERSE_AUTO' as TypeRepartition },
    { label: this.t.poste.questionnaire.repartitionPersonnalisee,   value: 'CUSTOM' as TypeRepartition },
  ];

  estimationOptions = [
    { label: this.t.commun.non, value: 'EFFECTIF' as const },
    { label: this.t.commun.oui, value: 'ESTIMATION' as const },
  ];

  /** Vrai si la liste des membres + pourcentages doit être affichée (choix « Tous » + « Personnalisé »). */
  afficherListeRepartition = computed(() =>
    this.quiConcerneChoice() === 'TOUS' && this.quiRepartition() === 'CUSTOM' && this.membres().length > 1
  );

  /** Vrai si le bloc « Sur quels comptes à ventiler ? » doit être affiché (choix « Tous », quel que soit le type). */
  afficherComptesTous = computed(() =>
    this.quiConcerneChoice() === 'TOUS' && this.quiRepartition() !== null && this.membres().length > 1
  );

  /** Vrai si les quotes-parts affichées sont éditables (uniquement pour Personnalisé). */
  repartitionEditable = computed(() => this.quiRepartition() === 'CUSTOM');

  /** Question 1 résolue : one-shot, ou récurrent avec une fréquence précisée. */
  questionnaireFrequenceResolue = computed(() =>
    this.frequenceChoisie() === 'PONCTUEL' ||
    (this.frequenceChoisie() === 'RECURRENT' && this.sousFrequence() !== null)
  );

  /** Question « Qui » résolue : mono-membre (question non posée), ou un choix complet fait. */
  private questionnaireQuiResolue = computed(() =>
    this.membres().length <= 1 ||
    (this.quiConcerneChoice() === 'MEMBRE_UNIQUE' && this.membreUniqueId() !== null) ||
    (this.quiConcerneChoice() === 'TOUS' && this.quiRepartition() !== null)
  );

  /** Focus automatique sur Description une fois le questionnaire résolu (une seule fois par ouverture). */
  private readonly _focusDescriptionApresQuestionnaire = effect(() => {
    if (this.questionnaireFrequenceResolue() && this.questionnaireQuiResolue() &&
        this.dialogVisible && !this._focusDescriptionFait) {
      this._focusDescriptionFait = true;
      setTimeout(() => this.descriptionInput?.nativeElement.focus());
    }
  });

  choisirFrequence(f: 'PONCTUEL' | 'RECURRENT'): void {
    this.frequenceChoisie.set(f);
    if (f === 'PONCTUEL') {
      this.sousFrequence.set(null);
      this.form.get('periodiciteMois')?.setValue(0);
    }
  }

  choisirSousFrequence(sf: 'MENSUEL' | 'AUTRE'): void {
    this.sousFrequence.set(sf);
    if (sf === 'MENSUEL') {
      this.form.get('periodiciteMois')?.setValue(1);
    } else {
      const actuel = this.form.get('periodiciteMois')?.value ?? 0;
      if (actuel === 0 || actuel === 1) {
        this.form.get('periodiciteMois')?.setValue(3);
      }
    }
  }

  choisirQuiConcerne(choix: 'TOUS' | 'MEMBRE_UNIQUE'): void {
    this.quiConcerneChoice.set(choix);
    if (choix === 'MEMBRE_UNIQUE') {
      this.quiRepartition.set(null);
      if (this.membreUniqueId()) {
        this.choisirMembreUnique(this.membreUniqueId()!);
      }
    } else {
      this.membreUniqueId.set(null);
      if (this.quiRepartition()) {
        this.choisirQuiRepartition(this.quiRepartition()!);
      }
    }
  }

  choisirQuiRepartition(qr: TypeRepartition): void {
    this.quiRepartition.set(qr);
    this.form.get('typeRepartition')?.setValue(qr);
    if (qr === 'CUSTOM') {
      this.appliquerRepartitionEgale();
    } else {
      this.appliquerRepartitionAffichageScenario(qr === 'REVERSE_AUTO');
    }
  }

  choisirMembreUnique(membreId: string): void {
    this.membreUniqueId.set(membreId);
    this.form.get('typeRepartition')?.setValue('CUSTOM');
    this.appliquerRepartitionMembreUnique(membreId);
  }

  /** Nom du membre retenu par le preset « Un membre en particulier ». */
  nomMembreUnique(): string {
    return this.membres().find(m => m.id === this.membreUniqueId())?.nom ?? '';
  }

  /** 100% pour le membre sélectionné, 0% pour les autres (et vide leur compte). */
  private appliquerRepartitionMembreUnique(membreId: string): void {
    this.repartitionsArray.controls.forEach(c => {
      const selectionne = c.get('membreId')?.value === membreId;
      c.patchValue({
        quotePart: selectionne ? 100 : 0,
        compteId: selectionne ? c.get('compteId')?.value : null,
      }, { emitEvent: false });
    });
    this.calculerSomme();
  }

  /** Parts égales entre tous les membres, en conservant 2 décimales pour éviter les résidus flottants. */
  private appliquerRepartitionEgale(): void {
    const n = this.repartitionsArray.length;
    if (!n) return;
    const part = Math.round((100 / n) * 100) / 100;
    const reste = Math.round((100 - part * (n - 1)) * 100) / 100;
    this.repartitionsArray.controls.forEach((c, i) => {
      c.patchValue({ quotePart: i === n - 1 ? reste : part }, { emitEvent: false });
    });
    this.calculerSomme();
  }

  /**
   * Affichage (lecture seule) des quotes-parts effectives AUTO/REVERSE_AUTO, dérivées de la
   * répartition par défaut du scénario. Ces valeurs ne sont jamais envoyées à l'API pour ces
   * deux modes (seul CUSTOM stocke une répartition sur le poste) — c'est purement informatif.
   */
  private appliquerRepartitionAffichageScenario(inverse: boolean): void {
    const reps = this.contexte.scenarioCourant()?.repartitions ?? [];
    const n = this.membres().length;
    this.repartitionsArray.controls.forEach(c => {
      const membreId = c.get('membreId')?.value;
      const base = reps.find(r => r.membreId === membreId)?.quotePart ?? (n ? 1 / n : 0);
      const effective = (inverse && n > 1) ? (1 - base) / (n - 1) : base;
      c.patchValue({ quotePart: Math.round(effective * 10000) / 100 }, { emitEvent: false });
    });
    this.calculerSomme();
  }

  periodiciteOptions = [
    { label: this.t.poste.periodiciteLabels[0], value: 0 },
    ...this.t.poste.periodiciteLabels.slice(1).map((label, i) => ({ label, value: i + 1 }))
  ];

  /** Options de périodicité pour le choix « Autre » : sans « Une seule fois » ni « Tous les mois »,
   *  déjà couverts par les choix rapides Ponctuel / Chaque mois. */
  periodiciteOptionsAutre = this.periodiciteOptions.filter(o => o.value !== 0 && o.value !== 1);

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

  form = this.fb.group({
    description:     ['', Validators.required],
    categorieId:     [null as string | null],
    montant:         [0, [Validators.required, Validators.min(0)]],
    devise:          [this.contexte.deviseBase(), Validators.required],
    periodiciteMois: [0, Validators.min(0)],
    mode:            ['MENSUALISE'],
    moment:          ['DEBUT_PERIODE'],
    nature:          ['EFFECTIF'],
    estimPourcentage: [null as number | null, [Validators.min(0), Validators.max(100)]],  // Obligatoire si nature=ESTIMATION
    typeRepartition: ['AUTO' as TypeRepartition],
    debut:           [null as Date | null],
    fin:             [null as Date | null],
    repartitions:    this.fb.array([] as any[]),
  }, { validators: [datesCoherentesValidator] });

  get repartitionsArray() { return this.form.get('repartitions') as FormArray; }

  devisesDisponibles = creerDevisesDisponibles(this.contexte, this.tauxChangeSvc, this.form.get('devise'));

  /** Signal réactif sur la valeur courante de typeRepartition (réagit aux changements du select) */
  private typeRepartitionValue = toSignal(
    this.form.get('typeRepartition')!.valueChanges.pipe(
      startWith(this.form.get('typeRepartition')!.value as TypeRepartition)
    ),
    { initialValue: 'AUTO' as TypeRepartition }
  );

  /** Signal réactif sur la nature du poste (bascule EFFECTIF ↔ ESTIMATION) */
  private natureValue = toSignal(
    this.form.get('nature')!.valueChanges.pipe(
      startWith(this.form.get('nature')!.value)
    ),
    { initialValue: 'EFFECTIF' }
  );

  /** Vrai si le mode de répartition courant nécessite des parts manuelles (CUSTOM multi-membres) */
  estCustomMultiMembre = computed(() =>
    this.typeRepartitionValue() === 'CUSTOM' && this.membres().length > 1
  );

  /** Vrai si le formulaire est valide, incluant la validation du pourcentage d'estimation. */
  isFormValid(): boolean {
    const isBaseValid = this.form.valid;
    const nature = this.form.value.nature;
    const estimPct = this.form.value.estimPourcentage;
    // Si nature=ESTIMATION, estimPourcentage doit être non-null
    const isEstimationValid = nature === 'ESTIMATION' ? estimPct !== null && estimPct !== undefined && estimPct > 0 : true;
    return isBaseValid && isEstimationValid && (!this.estCustomMultiMembre() || this.sommeRepartitionValide);
  }

  /** Effet : bascule Nature EFFECTIF→ESTIMATION pré-remplit 10%, ESTIMATION→EFFECTIF vide (null) */
  private readonly _initEstimPourcentageOnNatureChange = effect(() => {
    const nature = this.natureValue();
    if (nature === 'ESTIMATION') {
      // Ne mettre 10% que si le champ est actuellement vide
      if (this.form.get('estimPourcentage')?.value === null) {
        this.form.get('estimPourcentage')?.setValue(10.0, { emitEvent: false });
      }
    } else {
      // Vider si nature=EFFECTIF
      this.form.get('estimPourcentage')?.setValue(null, { emitEvent: false });
    }
  });

  /**
   * Quand l'utilisateur bascule vers CUSTOM et que le FormArray n'est pas encore peuplé
   * (cas d'une ouverture en création), on initialise les parts à 0.
   */
  private readonly _initPartsOnCustom = effect(() => {
    if (this.typeRepartitionValue() === 'CUSTOM' && this.repartitionsArray.length === 0) {
      this.initialiserRepartitions(undefined);
    }
  });

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
    this.form.reset({ mode: 'MENSUALISE', moment: 'DEBUT_PERIODE', nature: 'EFFECTIF',
                      periodiciteMois: 0, devise: this.contexte.deviseBase(),
                      typeRepartition: 'AUTO', estimPourcentage: null });
    this.initialiserRepartitions(undefined);
    this.frequenceChoisie.set(null);
    this.sousFrequence.set(null);
    this.quiConcerneChoice.set(null);
    this.quiRepartition.set(null);
    this.membreUniqueId.set(null);
    this._focusDescriptionFait = false;
    this.dialogVisible = true;
  }

  ouvrirEdition(p: PosteDto): void {
    this.posteEnEdition = p;
    this.form.patchValue({
      description: p.description, categorieId: p.categorieId,
      montant: p.montant, devise: p.devise ?? this.contexte.deviseBase(), periodiciteMois: p.periodiciteMois ?? 0,
      mode: p.mode, moment: p.moment, nature: p.nature ?? 'EFFECTIF',
      estimPourcentage: p.estimPourcentage ?? null,
      typeRepartition: p.typeRepartition ?? 'AUTO',
      debut: p.debut ? parseIsoDateLocal(p.debut) : null,
      fin: p.fin ? parseIsoDateLocal(p.fin) : null,
    });
    // Initialiser les parts seulement pour CUSTOM
    if (p.typeRepartition === 'CUSTOM') {
      this.initialiserRepartitions(p.repartitions, p.ventilations);
    } else {
      this.initialiserRepartitions(undefined, p.ventilations);
    }

    // Déduction des réponses du mini-questionnaire à partir du poste existant, sans
    // rien changer aux valeurs réelles du formulaire.
    const periodicite = p.periodiciteMois ?? 0;
    this.frequenceChoisie.set(periodicite === 0 ? 'PONCTUEL' : 'RECURRENT');
    this.sousFrequence.set(
      periodicite === 0 ? null :
      periodicite === 1 ? 'MENSUEL' : 'AUTRE'
    );
    this.membreUniqueId.set(null);
    if (p.typeRepartition === 'CUSTOM') {
      const nonZero = this.repartitionsArray.controls.filter(c => (c.get('quotePart')?.value ?? 0) > 0);
      if (nonZero.length === 1) {
        this.quiConcerneChoice.set('MEMBRE_UNIQUE');
        this.quiRepartition.set(null);
        this.membreUniqueId.set(nonZero[0].get('membreId')?.value ?? null);
      } else {
        this.quiConcerneChoice.set('TOUS');
        this.quiRepartition.set('CUSTOM');
      }
    } else {
      const tr = (p.typeRepartition ?? 'AUTO') as TypeRepartition;
      this.quiConcerneChoice.set('TOUS');
      this.quiRepartition.set(tr);
      this.appliquerRepartitionAffichageScenario(tr === 'REVERSE_AUTO');
    }
    this._focusDescriptionFait = true; // pas d'autofocus surprise en édition, le formulaire est déjà rempli
    this.dialogVisible = true;
  }

  ouvrirApercu(p: PosteDto): void {
    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const sc = this.contexte.scenarioCourant();
    this.posteSvc.apercu(foyerId, scenarioId, p.id, sc?.anneeDepart ?? new Date().getFullYear())
      .subscribe(a => { this.apercuData.set(a); this.apercuVisible = true; });
  }

  private defaultCompteId(): string | null {
    const comptes = this.comptes();
    return comptes[0]?.id ?? null;
  }

  /** Comptes accessibles pour un membre donné (filtre sur membreIds). */
  comptesForMembre(membreId: string | undefined): CompteDto[] {
    if (!membreId) return this.comptes();
    return this.comptes().filter(c => c.membreIds?.includes(membreId));
  }

  /** Compte par défaut pour un membre : premier compte qui lui est rattaché. */
  private defaultCompteIdForMembre(membreId: string | undefined): string | null {
    if (!membreId) return this.defaultCompteId();
    const rattaches = this.comptesForMembre(membreId);
    return rattaches[0]?.id ?? this.defaultCompteId();
  }

  private initialiserRepartitions(
    existantes?: { membreId: string; quotePart: number; nomMembre: string }[],
    ventilationsExistantes?: VentilationCompteDto[],
  ): void {
    const membres = this.membres();

    // Supprimer les contrôles en surplus (ex : changement de foyer)
    while (this.repartitionsArray.length > membres.length) {
      this.repartitionsArray.removeAt(this.repartitionsArray.length - 1);
    }

    membres.forEach((m, i) => {
      const rep       = existantes?.find(r => r.membreId === m.id);
      const vent      = ventilationsExistantes?.find(v => v.membreId === m.id);
      const quotePart = rep ? Math.round(rep.quotePart * 10000) / 100 : 0;
      const compteId  = vent?.compteId ?? this.defaultCompteIdForMembre(m.id);

      if (i < this.repartitionsArray.length) {
        // Mettre à jour en place : le même FormGroup est conservé,
        // les directives Angular gardent leurs liaisons → les valeurs s'affichent bien.
        this.repartitionsArray.at(i).patchValue({ membreId: m.id, quotePart, compteId });
      } else {
        this.repartitionsArray.push(this.fb.group({
          membreId:  [m.id],
          quotePart: [quotePart],
          compteId:  [compteId],
        }));
      }
    });

    this.calculerSomme();
  }


  fermerDialogPoste(): void {
    this.dialogVisible = false;
    this.posteEnEdition = null;
  }

  calculerSomme(): void {
    const total = this.repartitionsArray.controls
      .reduce((s, c) => s + (c.get('quotePart')?.value ?? 0), 0);
    // Neutralise les résidus binaires (ex. 33.33+33.33+33.34 = 100.00000000000001).
    this.sommeRepartition = arrondirSommeRepartition(total);
  }

  /**
   * Appelé à chaque modification de quotePart dans le bloc CUSTOM.
   * Si le membre passe à 0%, on vide automatiquement son compte sélectionné.
   */
  onQuotePartChange(index: number): void {
    const ctrl = this.repartitionsArray.at(index);
    if ((ctrl.get('quotePart')?.value ?? 0) === 0) {
      ctrl.get('compteId')?.setValue(null, { emitEvent: false });
    }
    this.calculerSomme();
  }

  enregistrer(): void {
    if (this.enregistrementEnCours()) return;
    if (this.form.hasError('finAvantDebut')) {
      this.toast.add({ severity: 'warn', summary: this.t.commun.erreur, detail: this.t.poste.finAvantDebut });
      return;
    }
    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const v = this.form.value;
    const periodicite = v.periodiciteMois ?? 0;
    const estOneShot = periodicite === 0;

    if (estOneShot && !v.debut) {
      this.toast.add({
        severity: 'warn',
        summary: this.t.commun.erreur,
        detail: this.i18n.instant('poste.debutRequisPourOneShot', { champ: this.t.poste.debut, type: this.t.poste.oneShot }),
      });
      return;
    }

    const typeRepartition = (v.typeRepartition ?? 'AUTO') as TypeRepartition;
    const isCustom = typeRepartition === 'CUSTOM';

    // Parts uniquement pour CUSTOM
    const repartitions = isCustom && this.repartitionsArray.length
      ? this.repartitionsArray.controls.map(c => ({
          membreId: c.get('membreId')!.value,
          quotePart: Math.round((c.get('quotePart')!.value ?? 0) * 100) / 10000,
        })).filter(r => r.quotePart > 0)
      : undefined;

    // Validation somme seulement pour CUSTOM multi-membres
    if (isCustom && this.membres().length > 1 && !this.sommeRepartitionValide) {
      this.toast.add({ severity: 'warn', summary: this.t.commun.erreur, detail: this.t.commun.repartitionInvalide });
      return;
    }

    const ventilations = this.repartitionsArray.length
      ? this.repartitionsArray.controls
          .filter(c => c.get('compteId')?.value)
          .map(c => ({ membreId: c.get('membreId')!.value, compteId: c.get('compteId')!.value }))
      : undefined;

    const req = {
      type:            this.type(),
      description:     v.description!,
      categorieId:     v.categorieId ?? undefined,
      montant:         v.montant!,
      devise:          v.devise ?? this.contexte.deviseBase(),
      periodiciteMois: periodicite,
      mode:            (estOneShot ? 'MENSUALISE' : v.mode) as any,
      moment:          (estOneShot ? 'DEBUT_PERIODE' : v.moment) as any,
      nature:          (v.nature ?? 'EFFECTIF') as any,
      estimPourcentage: v.nature === 'ESTIMATION' ? v.estimPourcentage ?? undefined : undefined,
      typeRepartition: typeRepartition,
      debut:           v.debut ? this.toIso(v.debut) : undefined,
      fin:             estOneShot ? undefined : (v.fin ? this.toIso(v.fin) : undefined),
      ordre: 0,
      repartitions,
      ventilations,
    };

    const obs = this.posteEnEdition
      ? this.posteSvc.modifier(foyerId, scenarioId, this.posteEnEdition.id, req)
      : this.posteSvc.creer(foyerId, scenarioId, req);

    this.enregistrementEnCours.set(true);
    obs.subscribe({
      next: () => {
        this.enregistrementEnCours.set(false);
        notifierSucces(this.toast, this.t.commun.succes);
        this.dialogVisible = false;
        this.charger();
      },
      error: (err) => {
        this.enregistrementEnCours.set(false);
        notifierErreur(this.toast, this.t.commun.erreur, err);
      },
    });
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
