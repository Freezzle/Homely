import {
  Component, computed, effect, inject, input, output, signal, untracked, viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import {
  AbstractControl, FormArray, FormBuilder, ValidationErrors, Validators,
} from '@angular/forms';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { ContexteService } from '../../../core/services/contexte.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { CompteService, TauxChangeService } from '../../../core/services/referentiel.service';
import {
  CategorieDto, CompteDto, MomentPeriode, PosteDto, TypePoste, TypeRepartition,
} from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../core/i18n/locale.util';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { creerDevisesDisponibles } from '../../../core/utils/devise-options.util';
import { parseIsoDateLocal, toIsoDateLocal } from '../../../core/utils/date.util';
import { arrondirSommeRepartition, sommeRepartitionValide as estSommeRepartitionValide } from '../../../core/utils/repartition.util';
import { notifierErreur, notifierSucces } from '../../../core/utils/toast.util';
import { ParcoursGuideComponent } from '../../../shared/components/parcours-guide/parcours-guide.component';
import { EtapeParcours, LigneFiche, TonBadgeParcours } from '../../../shared/components/parcours-guide/parcours-guide.model';
import { PosteEcheancier } from '../../../shared/components/echeancier-annuel/echeancier.model';
import { legendeApercuPeriodicite } from '../../../shared/components/echeancier-annuel/poste-apercu-periodicite/poste-apercu-periodicite.component';
import { RepartitionSaisie } from './components/poste-repartition/repartition-saisie.model';
import { calculerParts } from './components/poste-repartition/repartition.util';
import { EtapeQuoiComponent } from './etapes/etape-quoi.component';
import { EtapeCombienComponent } from './etapes/etape-combien.component';
import { EtapeValiditeComponent } from './etapes/etape-validite.component';
import { EtapePaiementComponent } from './etapes/etape-paiement.component';
import { EtapeRepartitionComponent } from './etapes/etape-repartition.component';
import { EtapeAnalyseComponent } from './etapes/etape-analyse.component';
import {
  EtapeCle, PosteFormValeurs, etapesVisibles, moisAnnee, premierDuMois,
  resumeAnalyse, resumeMontant, resumePaiement, resumeValidite, rythmeLibelle,
} from './poste-form-etapes';

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

/**
 * Création et édition d'un poste, en « une question par écran ». Le conteneur
 * détient le `FormGroup` (inchangé), la navigation entre étapes et le calcul des
 * chaînes affichées ; les composants d'étape et la fiche ne font que présenter.
 */
@Component({
  selector: 'app-poste-form-dialog',
  standalone: true,
  providers: [ConfirmationService],
  imports: [
    ConfirmDialogModule, ParcoursGuideComponent,
    EtapeQuoiComponent, EtapeCombienComponent, EtapeValiditeComponent,
    EtapePaiementComponent, EtapeRepartitionComponent, EtapeAnalyseComponent,
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
  private readonly translate = inject(TranslateService);
  private readonly montantPipe = inject(MontantPipe);

  readonly type = input<TypePoste>('REVENU');
  readonly categories = input<CategorieDto[]>([]);
  readonly poste = input<PosteDto | null>(null);
  readonly visible = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistre = output<void>();

  private readonly etapeQuoi = viewChild(EtapeQuoiComponent);
  private readonly parcours = viewChild(ParcoursGuideComponent);

  readonly locale = computed(() => localeDeLangue(this.translate.currentLang()));

  comptes = signal<CompteDto[]>([]);
  enregistrementEnCours = signal(false);

  /** Uniquement les membres actifs du foyer : seuls concernés par une nouvelle répartition. */
  membresActifs = computed(() => this.contexte.membres().filter(m => m.actif));

  /** membreId → quote-part du scénario courant (0–1). */
  readonly partsAuto = computed<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    for (const r of this.contexte.scenarioCourant()?.repartitions ?? []) out[r.membreId] = r.quotePart;
    return out;
  });

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
    deriveExterne: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    typeRepartition: ['AUTO' as TypeRepartition],
    debut:           [null as Date | null, Validators.required],
    fin:             [null as Date | null],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repartitions:    this.fb.array([] as any[]),
    inclureProrataTheorique: [true],
  }, { validators: [datesCoherentesValidator] });

  get repartitionsArray() { return this.form.get('repartitions') as FormArray; }

  devisesDisponibles = creerDevisesDisponibles(this.contexte, this.tauxChangeSvc, this.form.get('devise'));

  private readonly natureValue = toSignal(
    this.form.get('nature')!.valueChanges.pipe(startWith(this.form.get('nature')!.value)),
    { initialValue: 'EFFECTIF' },
  );
  private readonly momentValue = toSignal(
    this.form.get('moment')!.valueChanges.pipe(startWith(this.form.get('moment')!.value)),
    { initialValue: 'DEBUT_PERIODE' },
  );

  /** Valeur courante du formulaire, réactive — alimente la fiche et les étapes (OnPush). */
  private readonly formValueBrut = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.value)),
    { initialValue: this.form.value },
  );
  readonly valeurs = computed<PosteFormValeurs>(() => this.formValueBrut() as PosteFormValeurs);

  /** Saisie de la répartition : source de vérité de l'étape, projetée dans le `FormArray`. */
  repartitionSaisie = signal<RepartitionSaisie>({
    typeRepartition: 'AUTO', selection: [], parts: {}, comptes: {}, comptesSepares: false,
  });

  /** Date de référence des raccourcis de l'étape Validité (jamais une date en dur). */
  readonly aujourdHui = signal(new Date());

  sommeRepartition = 0;
  private _focusDescriptionFait = false;

  periodiciteOptions = [
    { label: this.t.poste.periodiciteLabels[0], value: 0 },
    ...this.t.poste.periodiciteLabels.slice(1).map((label, i) => ({ label, value: i + 1 })),
  ];
  /** Périodicités hors raccourcis de l'étape « Combien » (0, 1, 3, 6, 12). */
  periodiciteOptionsAutre = this.periodiciteOptions.filter(o => ![0, 1, 3, 6, 12].includes(o.value));

  // ── Navigation ────────────────────────────────────────────────────────

  etapeCourante = signal<EtapeCle>('quoi');
  etapesVisitees = signal<Set<EtapeCle>>(new Set<EtapeCle>(['quoi']));
  etapesTouchees = signal<Set<EtapeCle>>(new Set<EtapeCle>());

  readonly periodicite = computed(() => this.valeurs().periodiciteMois ?? 0);
  readonly etapes = computed(() => etapesVisibles(this.periodicite()));
  readonly indexCourant = computed(() => Math.max(this.etapes().indexOf(this.etapeCourante()), 0));
  readonly derniereEtape = computed(() => this.indexCourant() === this.etapes().length - 1);
  readonly modeEdition = computed(() => this.poste() !== null);

  /** « Aller à la fin » n'a de sens qu'une fois la dernière étape déjà vue. */
  readonly peutAllerFin = computed(() => this.etapesVisitees().has('analyse') && !this.derniereEtape());

  readonly titreEtape = computed(() => this.titreDe(this.etapeCourante()));

  /** Étapes telles que les attend le parcours guidé : clé + titre déjà traduit. */
  readonly etapesParcours = computed<EtapeParcours[]>(() =>
    this.etapes().map(cle => ({ cle, titre: this.titreDe(cle) })),
  );

  readonly sousTitre = computed(() =>
    `${this.contexte.foyerCourant()?.nom ?? ''} · ${this.contexte.scenarioCourant()?.nom ?? ''}`,
  );

  readonly badgeTon = computed<TonBadgeParcours>(() => {
    switch (this.type()) {
      case 'REVENU':  return 'revenu';
      case 'RESERVE': return 'reserve';
      default:        return 'charge';
    }
  });

  private titreDe(cle: EtapeCle): string {
    const f = this.t.poste.form.etapes;
    switch (cle) {
      case 'quoi':        return f.quoi;
      case 'combien':     return f.combien[this.type()];
      case 'validite':    return this.periodicite() === 0 ? f.validitePonctuel : f.validite;
      case 'paiement':    return f.paiement[this.type()];
      case 'repartition': return f.repartition[this.type()];
      case 'analyse':     return f.analyse;
    }
  }

  // ── Aperçu du rythme ──────────────────────────────────────────────────

  readonly apercuPoste = computed<PosteEcheancier | null>(() => {
    const v = this.valeurs();
    if (!(v.debut instanceof Date)) return null;
    return {
      periodicite: v.periodiciteMois ?? 0,
      mode: (v.mode === 'PERIODIQUE' ? 'PERIODIQUE' : 'MENSUALISE') as PosteEcheancier['mode'],
      moment: (v.moment ?? 'DEBUT_PERIODE') as PosteEcheancier['moment'],
      debut: toIsoDateLocal(v.debut),
      fin: v.fin instanceof Date ? toIsoDateLocal(v.fin) : null,
    };
  });

  readonly apercuEntete = computed(() => {
    const debut = this.valeurs().debut;
    if (!(debut instanceof Date)) return '';
    return this.t.poste.form.apercuDes.replace('{{mois}}', moisAnnee(debut, this.locale()));
  });

  readonly apercuLegende = computed(() => {
    const v = this.valeurs();
    return legendeApercuPeriodicite(this.t.poste.form.legende, v.periodiciteMois ?? 0, v.moment, v.mode);
  });

  // ── Fiche ─────────────────────────────────────────────────────────────

  readonly ficheTitre = computed(() => this.valeurs().description?.trim() || this.t.poste.form.sansNom);

  readonly ficheCategorie = computed(() => {
    const libelle = this.categories().find(c => c.id === this.valeurs().categorieId)?.libelle;
    return libelle ?? this.t.poste.form.categorieAChoisir;
  });

  readonly lignesFiche = computed<LigneFiche[]>(() => {
    const f = this.t.poste.form.fiche;
    const valeurs: Record<EtapeCle, string | null> = {
      quoi: null,
      combien: this.resumeCombien(),
      validite: this.resumeValiditeTexte(),
      paiement: this.resumePaiementTexte(),
      repartition: this.resumeRepartition(),
      analyse: this.resumeAnalyseTexte(),
    };
    const libelles: Record<EtapeCle, string> = {
      quoi: f.poste, combien: f.montant, validite: f.validite,
      paiement: f.paiement, repartition: f.repartition, analyse: f.analyse,
    };
    const visitees = this.etapesVisitees();
    return this.etapes()
      .filter(cle => cle !== 'quoi')
      .map(cle => {
        // Une étape jamais atteinte reste muette, même si le formulaire porte déjà
        // une valeur par défaut (date de début, notes d'analyse, répartition…) :
        // la fiche ne doit refléter que ce que l'utilisateur a réellement vu.
        const valeur = visitees.has(cle) ? valeurs[cle] : null;
        const etat = this.etapeCourante() === cle ? 'courante' : valeur ? 'faite' : 'vide';
        return { cle, libelle: libelles[cle], valeur, etat } as LigneFiche;
      });
  });

  /** Impact mensuel du poste : la part qui pèse réellement sur un mois de budget. */
  readonly impactMensuel = computed(() => {
    const v = this.valeurs();
    const montant = v.montant ?? 0;
    const p = v.periodiciteMois ?? 0;
    return p <= 1 ? montant : montant / p;
  });

  /** L'impact n'a de sens qu'une fois le montant demandé : muet avant l'étape « Combien ». */
  private readonly impactConnu = computed(() => this.etapesVisitees().has('combien'));

  readonly impactPrincipal = computed(() =>
    this.impactConnu()
      ? this.montantPipe.transform(this.impactMensuel(), this.valeurs().devise ?? undefined)
      : '…',
  );

  readonly impactSecondaire = computed(() => {
    if (!this.impactConnu()) return '';
    return (this.valeurs().periodiciteMois ?? 0) === 0
      ? rythmeLibelle(this.t, 0)
      : this.t.poste.form.impactParMois;
  });

  private resumeCombien(): string | null {
    const v = this.valeurs();
    if (!v.montant) return null;
    const montant = this.montantPipe.transform(v.montant, v.devise ?? undefined);
    const estim = v.nature === 'ESTIMATION' ? v.estimPourcentage ?? null : null;
    return resumeMontant(this.t, montant, v.periodiciteMois ?? 0, estim);
  }

  private resumeValiditeTexte(): string | null {
    const v = this.valeurs();
    return resumeValidite(this.t, v.debut ?? null, v.fin ?? null, v.periodiciteMois ?? 0, this.locale());
  }

  private resumePaiementTexte(): string | null {
    const v = this.valeurs();
    return resumePaiement(
      this.t, this.t.poste.form.verbe[this.type()], v.debut ?? null,
      v.periodiciteMois ?? 1, v.moment ?? 'DEBUT_PERIODE', v.mode ?? 'MENSUALISE', this.locale(),
    );
  }

  private resumeAnalyseTexte(): string {
    const v = this.valeurs();
    return resumeAnalyse(this.t, v.importance ?? 3, v.potentielOptimisation ?? 3, v.deriveExterne ?? 3);
  }

  /** « Dylan 58 % · Camille 42 % · Compte joint » — le compte n'apparaît que s'il est commun. */
  private resumeRepartition(): string | null {
    const s = this.repartitionSaisie();
    if (!s.selection.length) return null;
    const membres = this.membresActifs().filter(m => s.selection.includes(m.id));
    const parts = membres.map(m =>
      membres.length === 1 ? m.nom : `${m.nom} ${Math.round(s.parts[m.id] ?? 0)} %`,
    );
    const comptesChoisis = new Set(membres.map(m => s.comptes[m.id] ?? null));
    if (comptesChoisis.size === 1) {
      const compteId = [...comptesChoisis][0];
      const libelle = this.comptes().find(c => c.id === compteId)?.libelle;
      if (libelle) parts.push(libelle);
    }
    return parts.join(' · ');
  }

  // ── Effets ────────────────────────────────────────────────────────────

  private readonly _chargerComptes = effect(() => {
    const foyerId = this.contexte.foyerId();
    if (this.visible() && foyerId) {
      this.compteSvc.lister(foyerId).subscribe(c => this.comptes.set(c));
    }
  });

  /** Ouverture : (ré)initialise le formulaire sur le poste courant (ou vide en création). */
  private readonly _resetSurOuverture = effect(() => {
    const p = this.poste();
    const v = this.visible();
    // untracked : une interaction dans le formulaire ne doit jamais redéclencher la
    // réinitialisation (les initialisations lisent membresActifs, comptes, etc.).
    untracked(() => {
      if (v) {
        this.aujourdHui.set(new Date());
        if (p) this.initialiserEdition(p);
        else this.initialiserCreation();
      }
    });
  });

  /** Bascule Nature EFFECTIF→ESTIMATION : pré-remplit 10 % si le champ est vide. */
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

  /** Moment=INCONNU : seule stratégie possible = mensualiser. Force et verrouille le mode. */
  private readonly _forcerModeMensualiseSiMomentInconnu = effect(() => {
    const inconnu = this.momentValue() === 'INCONNU';
    const ctrl = this.form.get('mode')!;
    if (inconnu) {
      ctrl.setValue('MENSUALISE', { emitEvent: false });
      ctrl.disable({ emitEvent: false });
    } else if (ctrl.disabled) {
      ctrl.enable({ emitEvent: false });
    }
  });

  /**
   * La périodicité peut faire disparaître l'étape courante (« Paiement » quand on
   * repasse au mensuel) : on se replace alors sur une étape qui existe encore.
   */
  private readonly _recalerEtapeCourante = effect(() => {
    const etapes = this.etapes();
    const courante = this.etapeCourante();
    if (!etapes.includes(courante)) {
      untracked(() => this.etapeCourante.set('validite'));
    }
  });

  /**
   * Les comptes arrivent en asynchrone : dès qu'ils sont là, on complète les
   * ventilations encore vides par le compte par défaut de chaque membre (sans
   * jamais écraser un choix déjà fait).
   */
  private readonly _completerComptesParDefaut = effect(() => {
    const comptes = this.comptes();
    if (!comptes.length || !this.visible()) return;
    untracked(() => {
      const saisie = this.repartitionSaisie();
      const manquants = saisie.selection.filter(id => (saisie.parts[id] ?? 0) > 0 && !saisie.comptes[id]);
      if (!manquants.length) return;
      const complets = { ...saisie.comptes };
      for (const id of manquants) complets[id] = this.defaultCompteIdForMembre(id);
      this.appliquerRepartition({ ...saisie, comptes: complets }, false);
    });
  });

  // ── Initialisation ────────────────────────────────────────────────────

  private initialiserCreation(): void {
    this.form.reset({
      mode: 'MENSUALISE', moment: 'DEBUT_PERIODE', nature: 'EFFECTIF',
      periodiciteMois: 0, devise: this.contexte.deviseBase(),
      typeRepartition: 'AUTO', estimPourcentage: null, importance: 3, potentielOptimisation: 3, deriveExterne: 3,
      inclureProrataTheorique: true,
    });
    // Défaut de création : le poste démarre au 1er du mois prochain.
    this.form.get('debut')!.setValue(premierDuMois(this.aujourdHui(), 1));
    this.initialiserRepartitions(undefined);

    const membres = this.membresActifs();
    const selection = membres.map(m => m.id);
    // AUTO par défaut, y compris pour un foyer mono-membre : la répartition du
    // scénario lui attribue déjà 100 %, et le payload reste identique à l'existant.
    const typeRepartition: TypeRepartition = 'AUTO';
    const comptes = this.comptesParDefaut(selection);
    const comptesDistincts = new Set(selection.map(id => comptes[id] ?? null));
    this.appliquerRepartition({
      typeRepartition,
      selection,
      parts: calculerParts(membres, selection, typeRepartition, this.partsAuto()),
      comptes,
      comptesSepares: comptesDistincts.size > 1,
    }, false);

    this.form.markAsPristine();
    this.etapeCourante.set('quoi');
    this.etapesVisitees.set(new Set<EtapeCle>(['quoi']));
    this.etapesTouchees.set(new Set<EtapeCle>());
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
      deriveExterne: p.deriveExterne ?? 3,
      typeRepartition: p.typeRepartition ?? 'AUTO',
      debut: p.debut ? parseIsoDateLocal(p.debut) : null,
      fin: p.fin ? parseIsoDateLocal(p.fin) : null,
      inclureProrataTheorique: p.inclureProrataTheorique ?? true,
    });

    const custom = p.typeRepartition === 'CUSTOM';
    this.initialiserRepartitions(custom ? p.repartitions : undefined, p.ventilations);

    const membres = this.membresActifs();
    const typeRepartition = (p.typeRepartition ?? 'AUTO') as TypeRepartition;
    const parts: Record<string, number> = {};
    const comptes: Record<string, string | null> = {};
    for (const m of membres) {
      const rep = custom ? p.repartitions?.find(r => r.membreId === m.id) : undefined;
      parts[m.id] = custom ? Math.round((rep?.quotePart ?? 0) * 10000) / 100 : 0;
      comptes[m.id] = p.ventilations?.find(v => v.membreId === m.id)?.compteId ?? null;
    }
    const selection = custom
      ? membres.filter(m => parts[m.id] > 0).map(m => m.id)
      : membres.map(m => m.id);
    if (!custom) Object.assign(parts, calculerParts(membres, selection, typeRepartition, this.partsAuto()));

    const comptesRetenus = { ...this.comptesParDefaut(selection) };
    for (const id of selection) {
      if (comptes[id]) comptesRetenus[id] = comptes[id];
    }
    const comptesDistincts = new Set(selection.map(id => comptesRetenus[id] ?? null));

    this.appliquerRepartition({
      typeRepartition,
      selection,
      parts,
      comptes: comptesRetenus,
      comptesSepares: comptesDistincts.size > 1,
    }, false);

    this.form.markAsPristine();
    this.etapeCourante.set('quoi');
    this.etapesVisitees.set(new Set<EtapeCle>(['quoi', 'combien', 'validite', 'paiement', 'repartition', 'analyse']));
    this.etapesTouchees.set(new Set<EtapeCle>());
    this._focusDescriptionFait = true; // pas d'autofocus surprise en édition
  }

  private comptesParDefaut(selection: readonly string[]): Record<string, string | null> {
    const out: Record<string, string | null> = {};
    for (const m of this.membresActifs()) {
      out[m.id] = selection.includes(m.id) ? this.defaultCompteIdForMembre(m.id) : null;
    }
    return out;
  }

  private defaultCompteId(): string | null {
    return this.comptes()[0]?.id ?? null;
  }

  /** Comptes accessibles pour un membre donné (filtre sur membreIds). */
  comptesForMembre(membreId: string | undefined): CompteDto[] {
    if (!membreId) return this.comptes();
    return this.comptes().filter(c => c.membreIds?.includes(membreId));
  }

  private defaultCompteIdForMembre(membreId: string | undefined): string | null {
    if (!membreId) return this.defaultCompteId();
    const rattaches = this.comptesForMembre(membreId);
    return rattaches[0]?.id ?? this.defaultCompteId();
  }

  /**
   * Le compte n'est requis que pour une ligne de répartition effectivement porteuse
   * d'une quote-part : sans ce garde-fou, une ligne de membre désélectionné (compteId
   * vidé mais toujours `Validators.required`) rendrait le `FormGroup` global invalide
   * alors qu'elle n'est pas envoyée à l'API.
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
        ctrl.patchValue({ membreId: m.id, quotePart, compteId }, { emitEvent: false });
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
    const selection = this.repartitionSaisie().selection;
    const total = this.repartitionsArray.controls
      .filter(c => selection.includes(c.get('membreId')?.value))
      .reduce((s, c) => s + (c.get('quotePart')?.value ?? 0), 0);
    this.sommeRepartition = arrondirSommeRepartition(total);
  }

  /** Tolérance flottante : une somme visuellement à 100 % ne doit jamais être refusée à tort. */
  get sommeRepartitionValide(): boolean {
    return estSommeRepartitionValide(this.sommeRepartition);
  }

  /**
   * Projette la saisie de répartition dans le `FormArray` : c'est lui qui alimente
   * `enregistrer()`, dont le contrat vers l'API reste inchangé.
   */
  appliquerRepartition(saisie: RepartitionSaisie, marquerDirty = true): void {
    this.repartitionSaisie.set(saisie);

    this.repartitionsArray.controls.forEach(c => {
      const id = c.get('membreId')?.value as string;
      const selectionne = saisie.selection.includes(id);
      const quotePart = selectionne ? saisie.parts[id] ?? 0 : 0;
      c.patchValue(
        { quotePart, compteId: quotePart > 0 ? saisie.comptes[id] ?? null : null },
        { emitEvent: false },
      );
      this.definirValiditeCompte(c, quotePart > 0);
    });

    this.form.get('typeRepartition')!.setValue(saisie.typeRepartition, { emitEvent: false });
    this.calculerSomme();
    if (marquerDirty) this.form.markAsDirty();
  }

  /** Vrai si la répartition courante est éditée membre par membre (somme à contrôler). */
  private readonly estCustomMultiMembre = computed(() =>
    this.repartitionSaisie().typeRepartition === 'CUSTOM' && this.repartitionSaisie().selection.length > 1,
  );

  readonly erreurRepartition = computed<string | null>(() => {
    if (!this.etapesTouchees().has('repartition')) return null;
    if (this.estCustomMultiMembre() && !this.sommeRepartitionValide) return this.t.commun.repartitionInvalide;
    if (!this.comptesComplets()) return this.t.commun.champObligatoire;
    return null;
  });

  private comptesComplets(): boolean {
    const s = this.repartitionSaisie();
    return s.selection.every(id => (s.parts[id] ?? 0) <= 0 || !!s.comptes[id]);
  }

  // ── Navigation ────────────────────────────────────────────────────────

  /** Vrai si l'étape donnée est valide et peut être quittée. */
  etapeValide(etape: EtapeCle): boolean {
    switch (etape) {
      case 'quoi':
        return this.form.get('description')!.valid && this.form.get('categorieId')!.valid;
      case 'combien':
        return this.form.get('montant')!.valid && this.form.get('estimPourcentage')!.valid;
      case 'validite':
        return this.form.get('debut')!.valid && !this.form.hasError('finAvantDebut');
      case 'repartition':
        return this.repartitionSaisie().selection.length > 0
          && (!this.estCustomMultiMembre() || this.sommeRepartitionValide)
          && this.comptesComplets();
      default:
        return true;
    }
  }

  /** Marque l'étape comme quittée : ses erreurs deviennent visibles. */
  private quitterEtape(etape: EtapeCle): void {
    this.etapesTouchees.update(s => new Set(s).add(etape));
    if (etape === 'quoi') {
      this.form.get('description')!.markAsTouched();
      this.form.get('categorieId')!.markAsTouched();
    }
    if (etape === 'combien') {
      this.form.get('montant')!.markAsTouched();
      this.form.get('estimPourcentage')!.markAsTouched();
    }
    if (etape === 'validite') {
      this.form.get('debut')!.markAsTouched();
    }
  }

  /**
   * Va à une étape. En avançant, toutes les étapes traversées doivent être valides :
   * sinon la navigation s'arrête sur la première fautive. Revenir est toujours permis.
   */
  allerA(cible: EtapeCle): void {
    const etapes = this.etapes();
    const depuis = this.indexCourant();
    const vers = etapes.indexOf(cible);
    if (vers < 0) return;

    if (vers > depuis) {
      for (let i = depuis; i < vers; i++) {
        this.quitterEtape(etapes[i]);
        if (!this.etapeValide(etapes[i])) {
          this.positionner(etapes[i]);
          return;
        }
      }
    }
    this.positionner(cible);
  }

  private positionner(cle: EtapeCle): void {
    this.etapeCourante.set(cle);
    this.etapesVisitees.update(s => new Set(s).add(cle));
    this.parcours()?.defilerEnHaut();
  }

  suivant(): void {
    const etapes = this.etapes();
    this.allerA(etapes[Math.min(this.indexCourant() + 1, etapes.length - 1)]);
  }

  precedent(): void {
    const etapes = this.etapes();
    this.positionner(etapes[Math.max(this.indexCourant() - 1, 0)]);
  }

  allerALaFin(): void {
    this.allerA('analyse');
  }

  /** Clic sur une ligne de la fiche : jamais bloqué vers une étape déjà visitée. */
  naviguerDepuisFiche(cle: EtapeCle): void {
    if (this.etapesVisitees().has(cle)) this.positionner(cle);
    else this.allerA(cle);
  }

  // ── Cycle de vie du dialog ────────────────────────────────────────────

  /**
   * Déclenché une fois le dialog effectivement affiché : seul moment fiable pour
   * placer le focus (un focus trop tôt est écrasé par le focus-trap du p-dialog).
   */
  onDialogShow(): void {
    if (this._focusDescriptionFait) return;
    this._focusDescriptionFait = true;
    this.etapeQuoi()?.focus();
  }


  /** Ferme le dialog (avec confirmation si le formulaire a été modifié). */
  fermer(): void {
    if (this.form.dirty) {
      this.confirm.confirm({
        message: this.t.commun.confirmerAnnulationFormulaire,
        accept: () => {
          if (!this.poste()) this.initialiserCreation();
          this.visibleChange.emit(false);
        },
      });
    } else {
      if (!this.poste()) this.initialiserCreation();
      this.visibleChange.emit(false);
    }
  }

  // ── Enregistrement ────────────────────────────────────────────────────

  /**
   * Vrai si le formulaire peut être enregistré. Ne se base pas sur `form.invalid`
   * seul : les lignes de répartition des membres non sélectionnés portent un
   * `compteId` remis à `null`, sans incidence sur la requête envoyée.
   */
  formulaireValide(): boolean {
    if (this.form.invalid) return false;
    if (this.form.hasError('finAvantDebut')) return false;
    if (this.repartitionSaisie().selection.length === 0) return false;
    if (this.estCustomMultiMembre() && !this.sommeRepartitionValide) return false;
    return true;
  }

  private premiereEtapeFautive(): EtapeCle {
    for (const etape of this.etapes()) {
      this.etapesTouchees.update(s => new Set(s).add(etape));
      if (!this.etapeValide(etape)) return etape;
    }
    return 'quoi';
  }

  enregistrer(etNouveau = false): void {
    if (this.enregistrementEnCours()) return;
    this.form.markAllAsTouched();
    if (!this.formulaireValide()) {
      this.positionner(this.premiereEtapeFautive());
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mode:            (estOneShot || momentInconnu ? 'MENSUALISE' : v.mode) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      moment:          (estOneShot ? 'DEBUT_PERIODE' : v.moment) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nature:          (v.nature ?? 'EFFECTIF') as any,
      estimPourcentage: v.nature === 'ESTIMATION' ? v.estimPourcentage ?? undefined : undefined,
      importance:      v.importance ?? 3,
      potentielOptimisation: v.potentielOptimisation ?? 3,
      deriveExterne: v.deriveExterne ?? 3,
      typeRepartition,
      debut:           v.debut ? toIsoDateLocal(v.debut) : undefined,
      fin:             estOneShot ? undefined : (v.fin ? toIsoDateLocal(v.fin) : undefined),
      ordre: 0,
      repartitions,
      ventilations,
      inclureProrataTheorique: this.type() === 'REVENU' ? (v.inclureProrataTheorique ?? true) : undefined,
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
   * « Enregistrer et nouveau » : vide les champs qui identifient CE poste
   * (description, montant, date de fin) mais conserve les champs structurels.
   */
  private reinitialiserPourNouveau(): void {
    this.form.patchValue({ description: '', montant: 0, fin: null });
    this.form.markAsPristine();
    this.etapesTouchees.set(new Set<EtapeCle>());
    this.positionner('quoi');
    this._focusDescriptionFait = false;
    setTimeout(() => this.etapeQuoi()?.focus());
  }
}
