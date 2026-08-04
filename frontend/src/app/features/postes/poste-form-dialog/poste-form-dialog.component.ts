import { Component, inject, input, output, signal, computed, effect, untracked, ViewChild, ElementRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormArray, FormsModule, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { StepperModule } from 'primeng/stepper';
import { SliderModule } from 'primeng/slider';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ContexteService } from '../../../core/services/contexte.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { CompteService, TauxChangeService } from '../../../core/services/referentiel.service';
import { CategorieDto, CompteDto, MembreDto, MomentPeriode, PosteDto, TypePoste, TypeRepartition } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { creerDevisesDisponibles } from '../../../core/utils/devise-options.util';
import { toIsoDateLocal, parseIsoDateLocal } from '../../../core/utils/date.util';
import { arrondirSommeRepartition, sommeRepartitionValide as estSommeRepartitionValide } from '../../../core/utils/repartition.util';
import { notifierSucces, notifierErreur } from '../../../core/utils/toast.util';
import { normaliserCouleur, couleurTexteContraste } from '../../../shared/utils/couleur.util';
import { MembresTagsComponent } from '../../../shared/components/membres-tags/membres-tags.component';
import { MontantPipe, PeriodicitePipe } from '../../../core/pipes/format.pipes';

/**
 * Validateur de groupe : la date de fin (si renseignée) ne peut pas être
 * antérieure à la date de début.
 */
function datesCoherentesValidator(group: AbstractControl): ValidationErrors | null {
  const debut = group.get('debut')?.value as Date | null;
  const fin = group.get('fin')?.value as Date | null;
  if (debut && fin && fin.getTime() < debut.getTime()) {
    return { finAvantDebut: true };
  }
  return null;
}

/** Index des 4 étapes fixes du stepper (jamais plus, jamais moins). */
type Etape = 0 | 1 | 2 | 3;

@Component({
  selector: 'app-poste-form-dialog',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, DialogModule, ButtonModule, InputTextModule,
    InputNumberModule, SelectModule, SelectButtonModule, DatePickerModule, MessageModule, TooltipModule,
    StepperModule, ConfirmDialogModule, SliderModule, MembresTagsComponent, MontantPipe, PeriodicitePipe,
  ],
  templateUrl: './poste-form-dialog.component.html',
})
export class PosteFormDialogComponent {
  readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  readonly contexte = inject(ContexteService);
  private readonly posteSvc = inject(PosteService);
  private readonly compteSvc = inject(CompteService);
  private readonly tauxChangeSvc = inject(TauxChangeService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  readonly type = input<TypePoste>('REVENU');
  readonly categories = input<CategorieDto[]>([]);
  readonly poste = input<PosteDto | null>(null);
  readonly visible = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistre = output<void>();

  @ViewChild('descriptionInput') private descriptionInput?: ElementRef<HTMLInputElement>;

  comptes = signal<CompteDto[]>([]);
  enregistrementEnCours = signal(false);

  /** Uniquement les membres actifs du foyer : seuls concernés par une nouvelle répartition. */
  membresActifs = computed(() => this.contexte.membres().filter(m => m.actif));

  // ── Pilotage du stepper ───────────────────────────────────────────────
  etapeActive = signal<Etape>(0);
  etapesVisitees = signal<Set<Etape>>(new Set([0]));
  etapesTouched = signal<Set<Etape>>(new Set());

  form = this.fb.group({
    description:     ['', Validators.required],
    categorieId:     [null as string | null, Validators.required],
    montant:         [0, [Validators.required, Validators.min(0.01)]],
    devise:          [this.contexte.deviseBase(), Validators.required],
    periodiciteMois: [0, Validators.min(0)],
    mode:            ['MENSUALISE'],
    moment:          ['DEBUT_PERIODE' as MomentPeriode],
    nature:          ['EFFECTIF'],
    estimPourcentage: [null as number | null, [Validators.min(0), Validators.max(100)]],
    importance:      [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    potentielOptimisation: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    typeRepartition: ['AUTO' as TypeRepartition],
    debut:           [null as Date | null, Validators.required],
    fin:             [null as Date | null],
    repartitions:    this.fb.array([] as any[]),
  }, { validators: [datesCoherentesValidator] });

  get repartitionsArray() { return this.form.get('repartitions') as FormArray; }

  devisesDisponibles = creerDevisesDisponibles(this.contexte, this.tauxChangeSvc, this.form.get('devise'));

  private readonly typeRepartitionValue = toSignal(
    this.form.get('typeRepartition')!.valueChanges.pipe(startWith(this.form.get('typeRepartition')!.value as TypeRepartition)),
    { initialValue: 'AUTO' as TypeRepartition },
  );
  private readonly natureValue = toSignal(
    this.form.get('nature')!.valueChanges.pipe(startWith(this.form.get('nature')!.value)),
    { initialValue: 'EFFECTIF' },
  );
  private readonly momentValue = toSignal(
    this.form.get('moment')!.valueChanges.pipe(startWith(this.form.get('moment')!.value)),
    { initialValue: 'DEBUT_PERIODE' },
  );
  private readonly finValue = toSignal(
    this.form.get('fin')!.valueChanges.pipe(startWith(this.form.get('fin')!.value)),
    { initialValue: null as Date | null },
  );
  /** Valeur courante du formulaire, réactive — utilisée par le récapitulatif (étape 4). */
  readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.value)),
    { initialValue: this.form.value },
  );

  // ── Mini-questionnaire du rythme (façade au-dessus du form réactif) ──
  frequenceChoisie = signal<'PONCTUEL' | 'RECURRENT' | null>(null);
  sousFrequence    = signal<'MENSUEL' | 'AUTRE' | null>(null);

  // ── Sélection des membres concernés (étape 3) ──
  membresSelectionnesIds = signal<Set<string>>(new Set());
  /** Dernier type de répartition multi-membres choisi, restauré si on repasse de 1 à 2+ sélectionnés. */
  private dernierTypeRepartitionMulti: TypeRepartition = 'AUTO';

  sommeRepartition = 0;
  private _focusDescriptionFait = false;

  frequenceOptions = [
    { label: this.t.poste.questionnaire.ponctuel,  value: 'PONCTUEL' as const },
    { label: this.t.poste.questionnaire.recurrent, value: 'RECURRENT' as const },
  ];
  sousFrequenceOptions = [
    { label: this.t.poste.questionnaire.chaqueMois,     value: 'MENSUEL' as const },
    { label: this.t.poste.questionnaire.autreFrequence, value: 'AUTRE' as const },
  ];
  momentOptions = [
    { label: this.t.poste.momentOptions.DEBUT_PERIODE, value: 'DEBUT_PERIODE' },
    { label: this.t.poste.momentOptions.FIN_PERIODE,   value: 'FIN_PERIODE' },
    { label: this.t.poste.momentOptions.INCONNU,       value: 'INCONNU' },
  ];
  modeOptions = [
    { label: this.t.poste.modeOptions.MENSUALISE, value: 'MENSUALISE' },
    { label: this.t.poste.modeOptions.PERIODIQUE, value: 'PERIODIQUE' },
  ];
  estimationOptions = [
    { label: this.t.commun.non, value: 'EFFECTIF' as const },
    { label: this.t.commun.oui, value: 'ESTIMATION' as const },
  ];
  typeRepartitionOptions = [
    { label: this.t.poste.typeRepartitionOptions.AUTO,         value: 'AUTO' as TypeRepartition },
    { label: this.t.poste.typeRepartitionOptions.REVERSE_AUTO, value: 'REVERSE_AUTO' as TypeRepartition },
    { label: this.t.poste.typeRepartitionOptions.CUSTOM,       value: 'CUSTOM' as TypeRepartition },
  ];
  periodiciteOptions = [
    { label: this.t.poste.periodiciteLabels[0], value: 0 },
    ...this.t.poste.periodiciteLabels.slice(1).map((label, i) => ({ label, value: i + 1 })),
  ];
  periodiciteOptionsAutre = this.periodiciteOptions.filter(o => o.value !== 0 && o.value !== 1);

  etapesTitres = computed(() => [
    this.t.poste.stepper.etape1Titre,
    this.t.poste.stepper.etape2Titre,
    this.t.poste.stepper.etape3Titre,
    this.t.poste.stepper.etape4Titre,
  ]);

  /** Question 1 (fréquence) résolue : one-shot, ou récurrent avec une sous-fréquence choisie. */
  questionnaireFrequenceResolue = computed(() =>
    this.frequenceChoisie() === 'PONCTUEL' ||
    (this.frequenceChoisie() === 'RECURRENT' && this.sousFrequence() !== null)
  );

  /** Vrai si moment=INCONNU (date de paiement effective non connue) : impose mode=MENSUALISE. */
  momentEstInconnu = computed(() => this.momentValue() === 'INCONNU');

  /** Vrai si l'étape 3 doit afficher le mode simplifié « foyer mono-membre ». */
  estMonoMembre = computed(() => this.membresActifs().length <= 1);

  /** Vrai si le sélecteur de type de répartition (bloc 2) doit être visible. */
  afficherTypeRepartition = computed(() => !this.estMonoMembre() && this.membresSelectionnesIds().size > 1);

  /** Vrai si les quotes-parts affichées sont éditables (Personnalisé, 2+ membres). */
  estCustomMultiMembre = computed(() =>
    !this.estMonoMembre() && this.membresSelectionnesIds().size > 1 && this.typeRepartitionValue() === 'CUSTOM'
  );

  /** Tolérance flottante : une somme visuellement à 100% ne doit jamais être refusée à tort. */
  get sommeRepartitionValide(): boolean {
    return estSommeRepartitionValide(this.sommeRepartition);
  }

  /** Contrôles de répartition des seuls membres actuellement sélectionnés (ordre stable des membres actifs). */
  controlesSelectionnes = computed(() => {
    const selection = this.membresSelectionnesIds();
    return this.repartitionsArray.controls.filter(c => selection.has(c.get('membreId')?.value));
  });

  // ── Récupération des comptes du foyer (nécessaires aux ventilations) ──
  private readonly _chargerComptes = effect(() => {
    const foyerId = this.contexte.foyerId();
    if (this.visible() && foyerId) {
      this.compteSvc.lister(foyerId).subscribe(c => this.comptes.set(c));
    }
  });

  /** Ouverture/fermeture : (ré)initialise le formulaire sur le poste courant (ou vide en création). */
  private readonly _resetSurOuverture = effect(() => {
    const p = this.poste();
    const v = this.visible();
    // untracked : évite que les signaux lus par initialiserCreation/initialiserEdition
    // (membresActifs, membresSelectionnesIds, etc.) ne deviennent des dépendances de cet
    // effet — sinon une simple interaction (ex. sélection d'un membre étape 3) le
    // redéclencherait et réinitialiserait tout le formulaire.
    untracked(() => {
      if (v) {
        if (p) {
          this.initialiserEdition(p);
        } else {
          this.initialiserCreation();
        }
      }
    });
  });

  /** Bascule Nature EFFECTIF→ESTIMATION : pré-remplit 10% si le champ est vide. ESTIMATION→EFFECTIF : vide le champ. */
  private readonly _initEstimPourcentageOnNatureChange = effect(() => {
    const nature = this.natureValue();
    const ctrl = this.form.get('estimPourcentage')!;
    if (nature === 'ESTIMATION') {
      if (ctrl.value === null) {
        ctrl.setValue(10.0, { emitEvent: false });
      }
      ctrl.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
    } else {
      ctrl.setValue(null, { emitEvent: false });
      ctrl.setValidators([Validators.min(0), Validators.max(100)]);
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  });

  /** Moment=INCONNU (date de paiement effective non connue) : seule stratégie possible =
   * mensualiser. Force et verrouille le select mode tant que ce choix est actif. */
  private readonly _forcerModeMensualiseSiMomentInconnu = effect(() => {
    const inconnu = this.momentEstInconnu();
    const ctrl = this.form.get('mode')!;
    if (inconnu) {
      ctrl.setValue('MENSUALISE', { emitEvent: false });
      ctrl.disable({ emitEvent: false });
    } else if (ctrl.disabled) {
      ctrl.enable({ emitEvent: false });
    }
  });

  private initialiserCreation(): void {
    this.form.reset({
      mode: 'MENSUALISE', moment: 'DEBUT_PERIODE', nature: 'EFFECTIF',
      periodiciteMois: 0, devise: this.contexte.deviseBase(),
      typeRepartition: 'AUTO', estimPourcentage: null, importance: 3, potentielOptimisation: 3,
    });
    this.initialiserRepartitions(undefined);
    this.frequenceChoisie.set(null);
    this.sousFrequence.set(null);
    this.dernierTypeRepartitionMulti = 'AUTO';
    // Par défaut en création, tous les membres actifs sont sélectionnés.
    this.membresSelectionnesIds.set(new Set(this.membresActifs().map(m => m.id)));
    this.appliquerRepartitionSelection();
    this.etapeActive.set(0);
    this.etapesVisitees.set(new Set([0]));
    this.etapesTouched.set(new Set());
    this._focusDescriptionFait = false;
  }

  private initialiserEdition(p: PosteDto): void {
    this.form.patchValue({
      description: p.description, categorieId: p.categorieId ?? null,
      montant: p.montant, devise: p.devise ?? this.contexte.deviseBase(), periodiciteMois: p.periodiciteMois ?? 0,
      mode: p.mode, moment: p.moment, nature: p.nature ?? 'EFFECTIF',
      estimPourcentage: p.estimPourcentage ?? null,
      importance: p.importance ?? 3,
      potentielOptimisation: p.potentielOptimisation ?? 3,
      typeRepartition: p.typeRepartition ?? 'AUTO',
      debut: p.debut ? parseIsoDateLocal(p.debut) : null,
      fin: p.fin ? parseIsoDateLocal(p.fin) : null,
    });
    this.form.markAsPristine();

    if (p.typeRepartition === 'CUSTOM') {
      this.initialiserRepartitions(p.repartitions, p.ventilations);
    } else {
      this.initialiserRepartitions(undefined, p.ventilations);
    }

    const periodicite = p.periodiciteMois ?? 0;
    this.frequenceChoisie.set(periodicite === 0 ? 'PONCTUEL' : 'RECURRENT');
    this.sousFrequence.set(periodicite === 0 ? null : periodicite === 1 ? 'MENSUEL' : 'AUTRE');

    if (p.typeRepartition === 'CUSTOM') {
      const nonZero = this.repartitionsArray.controls.filter(c => (c.get('quotePart')?.value ?? 0) > 0);
      this.membresSelectionnesIds.set(new Set(nonZero.map(c => c.get('membreId')?.value)));
      this.dernierTypeRepartitionMulti = 'AUTO';
    } else {
      this.membresSelectionnesIds.set(new Set(this.membresActifs().map(m => m.id)));
      this.dernierTypeRepartitionMulti = (p.typeRepartition ?? 'AUTO') as TypeRepartition;
      this.appliquerRepartitionSelection();
    }

    this.etapeActive.set(0);
    this.etapesVisitees.set(new Set([0, 1, 2, 3]));
    this.etapesTouched.set(new Set());
    this._focusDescriptionFait = true; // pas d'autofocus surprise en édition
  }

  private defaultCompteId(): string | null {
    return this.comptes()[0]?.id ?? null;
  }

  /** Comptes accessibles pour un membre donné (filtre sur membreIds). */
  comptesForMembre(membreId: string | undefined): CompteDto[] {
    if (!membreId) return this.comptes();
    return this.comptes().filter(c => c.membreIds?.includes(membreId));
  }

  /** Membres rattachés à un compte (pour l'affichage du select). */
  membresForCompte(compte: CompteDto): MembreDto[] {
    return this.membresActifs().filter(m => compte.membreIds?.includes(m.id));
  }

  private defaultCompteIdForMembre(membreId: string | undefined): string | null {
    if (!membreId) return this.defaultCompteId();
    const rattaches = this.comptesForMembre(membreId);
    return rattaches[0]?.id ?? this.defaultCompteId();
  }

  /**
   * Le compte n'est requis que pour une ligne de répartition effectivement porteuse
   * d'une quote-part (membre sélectionné, part > 0). Sans ce garde-fou, une ligne de
   * membre désélectionné (compteId vidé mais toujours `Validators.required`) rend le
   * `FormGroup` global invalide alors qu'elle ne fait plus partie de la répartition
   * envoyée à l'API : le bouton « Enregistrer » resterait grisé à tort.
   */
  private definirValiditeCompte(ctrl: AbstractControl, requis: boolean): void {
    const compteCtrl = ctrl.get('compteId')!;
    compteCtrl.setValidators(requis ? [Validators.required] : []);
    compteCtrl.updateValueAndValidity({ emitEvent: false });
  }

  private initialiserRepartitions(
    existantes?: { membreId: string; quotePart: number; nomMembre: string }[],
    ventilationsExistantes?: { membreId: string; compteId: string }[],
  ): void {
    const membres = this.membresActifs();

    while (this.repartitionsArray.length > membres.length) {
      this.repartitionsArray.removeAt(this.repartitionsArray.length - 1);
    }

    membres.forEach((m, i) => {
      const rep       = existantes?.find(r => r.membreId === m.id);
      const vent      = ventilationsExistantes?.find(v => v.membreId === m.id);
      const quotePart = rep ? Math.round(rep.quotePart * 10000) / 100 : 0;
      const compteId  = vent?.compteId ?? this.defaultCompteIdForMembre(m.id);

      if (i < this.repartitionsArray.length) {
        const ctrl = this.repartitionsArray.at(i);
        ctrl.patchValue({ membreId: m.id, quotePart, compteId });
        // Requis seulement si le membre porte effectivement une quote-part : sinon (ex.
        // typeRepartition CUSTOM éditée avec un foyer élargi depuis, membre non inclus
        // dans la répartition d'origine) la ligne resterait invalide alors qu'elle n'est
        // pas envoyée à l'API, bloquant à tort le bouton « Enregistrer » (cf. formulaireValide).
        this.definirValiditeCompte(ctrl, quotePart > 0);
      } else {
        this.repartitionsArray.push(this.fb.group({
          membreId:  [m.id],
          quotePart: [quotePart],
          compteId:  [compteId, quotePart > 0 ? Validators.required : []],
        }));
      }
    });

    this.calculerSomme();
  }

  calculerSomme(): void {
    const total = this.repartitionsArray.controls
      .reduce((s, c) => s + (c.get('quotePart')?.value ?? 0), 0);
    this.sommeRepartition = arrondirSommeRepartition(total);
  }

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

  /** Bascule la sélection d'un membre pour l'étape 3 (au moins un membre doit rester sélectionné). */
  toggleMembreSelection(membreId: string): void {
    const current = new Set(this.membresSelectionnesIds());
    if (current.has(membreId)) {
      if (current.size === 1) return;
      current.delete(membreId);
    } else {
      current.add(membreId);
    }
    this.membresSelectionnesIds.set(current);

    if (current.size === 1) {
      this.form.get('typeRepartition')?.setValue('CUSTOM', { emitEvent: false });
    } else {
      this.form.get('typeRepartition')?.setValue(this.dernierTypeRepartitionMulti, { emitEvent: false });
    }
    this.appliquerRepartitionSelection();
  }

  choisirTypeRepartition(tr: TypeRepartition): void {
    this.dernierTypeRepartitionMulti = tr;
    this.form.get('typeRepartition')?.setValue(tr);
    this.appliquerRepartitionSelection();
  }

  /**
   * Recalcule les quotes-parts (et vide le compte des membres non sélectionnés) selon la
   * sélection courante et le type de répartition. AUTO/REVERSE_AUTO affichent une valeur
   * dérivée du scénario à titre purement informatif (jamais envoyée à l'API pour ces modes,
   * seul CUSTOM stocke une répartition sur le poste).
   */
  private appliquerRepartitionSelection(): void {
    const selection = this.membresSelectionnesIds();
    const tr = this.form.get('typeRepartition')?.value as TypeRepartition;

    this.repartitionsArray.controls.forEach(c => {
      const selectionne = selection.has(c.get('membreId')?.value);
      if (!selectionne) {
        c.patchValue({ quotePart: 0, compteId: null }, { emitEvent: false });
      }
      this.definirValiditeCompte(c, selectionne);
    });

    const controlesSelectionnes = this.repartitionsArray.controls.filter(c => selection.has(c.get('membreId')?.value));
    const n = controlesSelectionnes.length;

    if (n === 1) {
      controlesSelectionnes[0].patchValue({ quotePart: 100 }, { emitEvent: false });
    } else if (tr === 'CUSTOM') {
      if (n > 0) {
        const part = Math.round((100 / n) * 100) / 100;
        const reste = Math.round((100 - part * (n - 1)) * 100) / 100;
        controlesSelectionnes.forEach((c, i) => {
          c.patchValue({ quotePart: i === n - 1 ? reste : part }, { emitEvent: false });
        });
      }
    } else {
      const reps = this.contexte.scenarioCourant()?.repartitions ?? [];
      controlesSelectionnes.forEach(c => {
        const membreId = c.get('membreId')?.value;
        const base = reps.find(r => r.membreId === membreId)?.quotePart ?? (n ? 1 / n : 0);
        const effective = (tr === 'REVERSE_AUTO' && n > 1) ? (1 - base) / (n - 1) : base;
        c.patchValue({ quotePart: Math.round(effective * 10000) / 100 }, { emitEvent: false });
      });
    }

    this.calculerSomme();
  }

  /** Appelé à chaque saisie de quotePart en mode Personnalisé (vide le compte si le membre repasse à 0%). */
  onQuotePartChange(index: number): void {
    const ctrl = this.repartitionsArray.at(index);
    const quotePart = ctrl.get('quotePart')?.value ?? 0;
    if (quotePart === 0) {
      ctrl.get('compteId')?.setValue(null, { emitEvent: false });
    }
    this.definirValiditeCompte(ctrl, quotePart > 0);
    this.calculerSomme();
  }

  normaliserCouleur(couleur?: string): string {
    return normaliserCouleur(couleur);
  }

  couleurTexteContraste(hexColor: string): string {
    return couleurTexteContraste(hexColor);
  }

  initiales(nom: string): string {
    return nom.trim().split(/\s+/).map(mot => mot[0]).slice(0, 2).join('').toUpperCase();
  }

  categorieLibelle(categorieId: string | null | undefined): string {
    return this.categories().find(c => c.id === categorieId)?.libelle ?? '';
  }

  nomMembre(membreId: string | null | undefined): string {
    return this.membresActifs().find(m => m.id === membreId)?.nom ?? '';
  }

  membre(membreId: string | null | undefined): MembreDto | undefined {
    return this.membresActifs().find(m => m.id === membreId);
  }

  compteLibelle(compteId: string | null | undefined): string {
    return this.comptes().find(c => c.id === compteId)?.libelle ?? '';
  }

  // ── Navigation du stepper ──────────────────────────────────────────────

  /** Vrai si l'étape donnée est valide et peut être quittée vers la suivante. */
  etapeValide(etape: Etape): boolean {
    switch (etape) {
      case 0:
        return this.form.get('description')!.valid && this.form.get('montant')!.valid &&
               this.form.get('categorieId')!.valid && this.form.get('estimPourcentage')!.valid;
      case 1: {
        if (!this.questionnaireFrequenceResolue()) return false;
        if (this.form.get('debut')!.invalid) return false;
        return !this.form.hasError('finAvantDebut');
      }
      case 2:
        return this.membresSelectionnesIds().size > 0 &&
               (!this.estCustomMultiMembre() || this.sommeRepartitionValide) &&
               this.controlesSelectionnes().every(c => c.get('compteId')!.valid);
      default:
        return true;
    }
  }

  /** Vrai si l'étape donnée, une fois quittée, contient une erreur de validation. */
  etapeEnErreur(etape: Etape): boolean {
    return this.etapesTouched().has(etape) && !this.etapeValide(etape);
  }

  /** Marque l'étape courante comme quittée (les erreurs deviennent visibles) puis change d'étape. */
  private quitterEtape(etape: Etape): void {
    this.etapesTouched.update(s => new Set(s).add(etape));
    if (etape === 0) {
      this.form.get('description')!.markAsTouched();
      this.form.get('montant')!.markAsTouched();
      this.form.get('estimPourcentage')!.markAsTouched();
    }
  }

  /**
   * Change d'étape. En avançant, l'étape courante doit être valide : sinon la navigation
   * est bloquée et ses erreurs deviennent visibles. Revenir en arrière est toujours permis.
   */
  allerA(etape: Etape): void {
    const courante = this.etapeActive();
    if (etape > courante) {
      this.quitterEtape(courante);
      if (this.etapeEnErreur(courante)) return;
    }
    this.etapeActive.set(etape);
    this.etapesVisitees.update(s => new Set(s).add(etape));
  }

  suivant(): void {
    const prochaine = Math.min(this.etapeActive() + 1, 3) as Etape;
    this.allerA(prochaine);
  }

  precedent(): void {
    const precedente = Math.max(this.etapeActive() - 1, 0) as Etape;
    this.allerA(precedente);
  }

  /** Clique sur une pastille déjà visitée : navigation libre, jamais bloquée par la validation. */
  cliquerPastille(etape: Etape): void {
    if (!this.etapesVisitees().has(etape) && etape > this.etapeActive()) return;
    this.allerA(etape);
  }

  /**
   * Déclenché une fois le dialog effectivement affiché (animation terminée). C'est le
   * seul moment fiable pour focus le champ description : un focus tenté trop tôt (ex. dans
   * l'effet de reset) est écrasé par le focus-trap interne du p-dialog.
   */
  onDialogShow(): void {
    if (this._focusDescriptionFait) return;
    this._focusDescriptionFait = true;
    this.descriptionInput?.nativeElement.focus();
  }

  /** Intercepte la fermeture déclenchée par le dialog (croix, clic hors-modal) pour appliquer la confirmation si dirty. */
  onDialogVisibleChange(v: boolean): void {
    if (v) {
      this.visibleChange.emit(true);
      return;
    }
    this.fermer();
  }

  fermer(): void {
    if (this.form.dirty) {
      this.confirm.confirm({
        message: this.t.commun.confirmerAnnulationFormulaire,
        accept: () => this.visibleChange.emit(false),
      });
    } else {
      this.visibleChange.emit(false);
    }
  }

  /**
   * Vrai si le formulaire peut être enregistré. Utilisé par le bouton d'enregistrement
   * (étape récap) : ne doit PAS se baser sur `form.invalid` seul, car les lignes de
   * répartition des membres non sélectionnés portent un `compteId` requis remis à `null`
   * (cf. `appliquerSelectionMembres`), ce qui rendrait le formulaire globalement invalide
   * alors que ces lignes ne concernent pas la répartition effective.
   */
  formulaireValide(): boolean {
    if (this.form.invalid) return false;
    if (this.form.hasError('finAvantDebut')) return false;
    if (this.membresSelectionnesIds().size === 0) return false;
    if (this.estCustomMultiMembre() && !this.sommeRepartitionValide) return false;
    return true;
  }

  private premiereEtapeFautive(): Etape {
    for (const etape of [0, 1, 2] as Etape[]) {
      this.etapesTouched.update(s => new Set(s).add(etape));
      if (this.etapeEnErreur(etape)) return etape;
    }
    return 0;
  }

  enregistrer(etNouveau = false): void {
    if (this.enregistrementEnCours()) return;
    this.form.markAllAsTouched();
    if (!this.formulaireValide()) {
      const fautive = this.premiereEtapeFautive();
      this.etapeActive.set(fautive);
      this.etapesVisitees.update(s => new Set(s).add(fautive));
      return;
    }

    const foyerId = this.contexte.foyerId()!;
    const scenarioId = this.contexte.scenarioId()!;
    const v = this.form.value;
    const periodicite = v.periodiciteMois ?? 0;
    const estOneShot = periodicite === 0;
    const momentInconnu = v.moment === 'INCONNU';
    const typeRepartition = (v.typeRepartition ?? 'AUTO') as TypeRepartition;
    const isCustom = typeRepartition === 'CUSTOM';

    const repartitions = isCustom && this.repartitionsArray.length
      ? this.repartitionsArray.controls.map(c => ({
          membreId: c.get('membreId')!.value,
          quotePart: Math.round((c.get('quotePart')!.value ?? 0) * 100) / 10000,
        })).filter(r => r.quotePart > 0)
      : undefined;

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
      mode:            (estOneShot || momentInconnu ? 'MENSUALISE' : v.mode) as any,
      moment:          (estOneShot ? 'DEBUT_PERIODE' : v.moment) as any,
      nature:          (v.nature ?? 'EFFECTIF') as any,
      estimPourcentage: v.nature === 'ESTIMATION' ? v.estimPourcentage ?? undefined : undefined,
      importance:      v.importance ?? 3,
      potentielOptimisation: v.potentielOptimisation ?? 3,
      typeRepartition,
      debut:           v.debut ? toIsoDateLocal(v.debut) : undefined,
      fin:             estOneShot ? undefined : (v.fin ? toIsoDateLocal(v.fin) : undefined),
      ordre: 0,
      repartitions,
      ventilations,
    };

    const posteEnEdition = this.poste();
    const obs = posteEnEdition
      ? this.posteSvc.modifier(foyerId, scenarioId, posteEnEdition.id, req)
      : this.posteSvc.creer(foyerId, scenarioId, req);

    this.enregistrementEnCours.set(true);
    obs.subscribe({
      next: () => {
        this.enregistrementEnCours.set(false);
        notifierSucces(this.toast, this.t.commun.succes);
        this.enregistre.emit();
        if (etNouveau) {
          this.reinitialiserPourNouveau();
        } else {
          this.visibleChange.emit(false);
        }
      },
      error: (err) => {
        this.enregistrementEnCours.set(false);
        notifierErreur(this.toast, this.t.commun.erreur, err);
      },
    });
  }

  /**
   * « Enregistrer et nouveau » : vide les champs qui identifient CE poste (description,
   * montant, date de fin) mais conserve les champs structurels (catégorie, devise,
   * fréquence, répartition). Ramène à l'étape 1.
   */
  private reinitialiserPourNouveau(): void {
    this.form.patchValue({ description: '', montant: 0, fin: null });
    this.form.markAsPristine();
    this.etapeActive.set(0);
    this.etapesTouched.set(new Set());
    this._focusDescriptionFait = false;
    setTimeout(() => this.descriptionInput?.nativeElement.focus());
  }
}
