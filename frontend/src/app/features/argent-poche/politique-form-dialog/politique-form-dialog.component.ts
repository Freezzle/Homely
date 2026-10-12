import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { MeterGroupModule, MeterItem } from 'primeng/metergroup';
import { ContexteService } from '../../../core/services/contexte.service';
import { ResolutionArgentPocheService } from '../../../core/services/argent-poche.service';
import { creerChargementReactif } from '../../../core/utils/reference-data.util';
import { I18nService } from '../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../core/i18n/locale.util';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import { TranslateService } from '@ngx-translate/core';
import {
  CompteDto, MembreDto, ModePolitiqueArgentPoche, PolitiqueArgentPocheDto, RavBrutMoisDto,
} from '../../../core/models/api.models';
import { normaliserCouleur } from '../../../shared/utils/couleur.util';
import { ParcoursGuideComponent } from '../../../shared/components/parcours-guide/parcours-guide.component';
import { EtapeParcours, LigneFiche } from '../../../shared/components/parcours-guide/parcours-guide.model';
import { ChoixCartesComponent } from '../../../shared/components/choix-cartes/choix-cartes.component';
import { ChoixPucesComponent } from '../../../shared/components/choix-puces/choix-puces.component';
import { OptionChoix } from '../../../shared/components/choix-cartes/option-choix.model';
import { DatePickerComponent, InputNumberComponent, InputTextComponent } from '../../../shared/components/form-fields';
import { optionsComptes, pastillesMembres } from '../argent-poche-options.util';
import {
  debutDAnnee, finApresUnAn, finDeLAnnee, memeJour, moisAnnee, premierDuMois,
} from '../../postes/poste-form-dialog/poste-form-etapes';

type EtapePolitique = 'quoi' | 'formule' | 'validite' | 'compte';
type RaccourciDebut = 'CE_MOIS' | 'PROCHAIN_MOIS' | 'DEBUT_ANNEE' | 'DEBUT_ANNEE_PROCHAINE';
type RaccourciFin = 'SANS_FIN' | 'UN_AN' | 'FIN_ANNEE';

const ETAPES: readonly EtapePolitique[] = ['quoi', 'formule', 'validite', 'compte'];

/** Requête envoyée à l'API — identique au contrat existant de l'écran. */
export interface PolitiqueArgentPocheRequest {
  membreId: string;
  compteId: string;
  nom: string;
  dateDebut: string;
  dateFin?: string;
  mode: ModePolitiqueArgentPoche;
  socle?: number;
  pourcentage?: number;
  plafond?: number;
  montantFixe?: number;
}

/**
 * Création et édition d'une politique d'argent de poche, en parcours guidé.
 * Le composant détient le formulaire, l'aperçu « 6 prochains mois » et les
 * validations miroir du back ; l'enregistrement lui-même reste à la charge de
 * l'écran parent, qui tient la liste.
 */
@Component({
  selector: 'app-politique-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, MessageModule, SkeletonModule, MeterGroupModule, MontantPipe,
    ParcoursGuideComponent, ChoixCartesComponent, ChoixPucesComponent,
    InputTextComponent, InputNumberComponent, DatePickerComponent,
  ],
  templateUrl: './politique-form-dialog.component.html',
  styleUrl: './politique-form-dialog.component.scss',
})
export class PolitiqueFormDialogComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();
  private readonly fb = inject(FormBuilder);
  private readonly contexte = inject(ContexteService);
  private readonly resolutionSvc = inject(ResolutionArgentPocheService);
  private readonly translate = inject(TranslateService);
  private readonly montantPipe = inject(MontantPipe);

  readonly visible = input<boolean>(false);
  readonly politique = input<PolitiqueArgentPocheDto | null>(null);
  readonly membres = input.required<readonly MembreDto[]>();
  readonly comptes = input.required<readonly CompteDto[]>();
  readonly enregistrementEnCours = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistrer = output<PolitiqueArgentPocheRequest>();

  protected readonly locale = computed(() => localeDeLangue(this.translate.currentLang()));
  protected readonly modeEdition = computed(() => this.politique() !== null);

  readonly form = this.fb.group({
    nom:         ['', [Validators.required, Validators.maxLength(160)]],
    membreId:    [null as string | null, Validators.required],
    compteId:    [null as string | null, Validators.required],
    dateDebut:   [null as Date | null,   Validators.required],
    dateFin:     [null as Date | null],
    mode:        ['VARIABLE' as ModePolitiqueArgentPoche, Validators.required],
    socle:       [0 as number | null,    [Validators.min(0)]],
    pourcentage: [50 as number | null,   [Validators.min(0), Validators.max(100)]],
    plafond:     [0 as number | null,    [Validators.min(0)]],
    montantFixe: [null as number | null, [Validators.min(0)]],
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.value)),
    { initialValue: this.form.value },
  );

  /** Date de référence des raccourcis (jamais une date en dur). */
  private readonly aujourdHui = signal(new Date());

  protected readonly etapeCourante = signal<EtapePolitique>('quoi');
  private readonly etapesVisitees = signal<Set<EtapePolitique>>(new Set<EtapePolitique>(['quoi']));
  private readonly etapesTouchees = signal<Set<EtapePolitique>>(new Set<EtapePolitique>());

  protected readonly etapesParcours = computed<EtapeParcours[]>(() => {
    const e = this.t.argentPoche.form.politique.etapes;
    return ETAPES.map(cle => ({ cle, titre: e[cle] }));
  });

  private readonly indexCourant = computed(() => Math.max(ETAPES.indexOf(this.etapeCourante()), 0));
  protected readonly peutAllerFin = computed(() =>
    this.etapesVisitees().has('compte') && this.etapeCourante() !== 'compte',
  );

  // ── Ouverture / initialisation ────────────────────────────────────────

  private readonly _initSurOuverture = effect(() => {
    const p = this.politique();
    const visible = this.visible();
    untracked(() => {
      if (!visible) return;
      this.aujourdHui.set(new Date());
      if (p) this.initialiserEdition(p); else this.initialiserCreation();
    });
  });

  private initialiserCreation(): void {
    this.form.reset({
      nom: '', membreId: null, compteId: null,
      dateDebut: premierDuMois(this.aujourdHui(), 1), dateFin: null,
      mode: 'VARIABLE', socle: 0, pourcentage: 50, plafond: 0, montantFixe: null,
    });
    this.etapeCourante.set('quoi');
    this.etapesVisitees.set(new Set<EtapePolitique>(['quoi']));
    this.etapesTouchees.set(new Set<EtapePolitique>());
    // Mode variable par défaut à la création : on arme le préremplissage
    // socle/plafond dès que membre et date de début seront renseignés.
    this._demandePrefill.set(true);
  }

  private initialiserEdition(p: PolitiqueArgentPocheDto): void {
    this.form.setValue({
      nom: p.nom,
      membreId: p.membreId,
      compteId: p.compteId,
      dateDebut: yearMonthVersDate(p.dateDebut),
      dateFin: p.dateFin ? yearMonthVersDate(p.dateFin) : null,
      mode: p.mode,
      socle: p.socle ?? 0,
      pourcentage: p.pourcentage ?? 0,
      plafond: p.plafond ?? 0,
      montantFixe: p.montantFixe ?? null,
    });
    this.etapeCourante.set('quoi');
    this.etapesVisitees.set(new Set<EtapePolitique>(ETAPES));
    this.etapesTouchees.set(new Set<EtapePolitique>());
    // Édition : les valeurs persistées font foi, jamais de préremplissage.
    this._demandePrefill.set(false);
  }

  // ── Étape « quoi » : membre et nom ────────────────────────────────────

  protected readonly optionsMembres = computed<OptionChoix<string>[]>(() =>
    this.membres().map(m => ({ value: m.id, titre: m.nom, couleur: normaliserCouleur(m.couleur) })),
  );

  protected choisirMembre(id: string | null): void {
    this.form.get('membreId')!.setValue(id);
    this.form.get('membreId')!.markAsDirty();
  }

  // ── Étape « formule » ─────────────────────────────────────────────────

  protected readonly estVariable = computed(() => this.formValue().mode !== 'FIXE');

  protected readonly optionsMode = computed<OptionChoix<ModePolitiqueArgentPoche>[]>(() => {
    const f = this.t.argentPoche.form.politique;
    return [
      { value: 'VARIABLE', titre: this.t.argentPoche.modes.VARIABLE, sousTitre: f.modeVariableAide },
      { value: 'FIXE', titre: this.t.argentPoche.modes.FIXE, sousTitre: f.modeFixeAide },
    ];
  });

  protected choisirMode(mode: ModePolitiqueArgentPoche | null): void {
    if (!mode) return;
    const ctrl = this.form.get('mode')!;
    ctrl.setValue(mode);
    ctrl.markAsDirty();
    // Choix explicite du mode variable : 50 % par défaut, et on arme le
    // préremplissage socle/plafond (appliqué dès que le reste à vivre moyen est
    // connu — voir `_prefillSocleEtPlafond`).
    if (mode === 'VARIABLE') {
      this.form.get('pourcentage')!.setValue(50);
      this._demandePrefill.set(true);
    }
  }

  /**
   * Préremplit socle et plafond à 20 % / 70 % du reste à vivre moyen de la
   * fenêtre, dès que celui-ci devient disponible. `Math.min`/`Math.max` garantit
   * plafond ≥ socle même si la moyenne est négative (contrainte du back).
   */
  private readonly _demandePrefill = signal(false);

  private readonly _prefillSocleEtPlafond = effect(() => {
    if (!this._demandePrefill()) return;
    const moyen = this.ravMoyen();
    if (moyen === null) return;
    untracked(() => {
      const vingtPct = Math.round(moyen * 0.2);
      const soixanteDixPct = Math.round(moyen * 0.7);
      this.form.patchValue({
        socle: Math.min(vingtPct, soixanteDixPct),
        plafond: Math.max(vingtPct, soixanteDixPct),
      });
      this._demandePrefill.set(false);
    });
  });

  // ── Étape « validité » : des mois, jamais des jours ───────────────────

  private readonly datesDebut = computed<Record<RaccourciDebut, Date>>(() => {
    const today = this.aujourdHui();
    return {
      CE_MOIS: premierDuMois(today),
      PROCHAIN_MOIS: premierDuMois(today, 1),
      DEBUT_ANNEE: debutDAnnee(today),
      DEBUT_ANNEE_PROCHAINE: debutDAnnee(today, 1),
    };
  });

  protected readonly raccourcisDebut = computed<OptionChoix<RaccourciDebut>[]>(() => {
    const f = this.t.argentPoche.form;
    const dates = this.datesDebut();
    const libelles: Record<RaccourciDebut, string> = {
      CE_MOIS: f.ceMois,
      PROCHAIN_MOIS: f.prochainMois,
      DEBUT_ANNEE: f.debutAnnee,
      DEBUT_ANNEE_PROCHAINE: f.debutAnneeProchaine,
    };
    return (Object.keys(libelles) as RaccourciDebut[]).map(cle => ({
      value: cle, titre: libelles[cle], sousTitre: moisAnnee(dates[cle], this.locale()),
    }));
  });

  protected readonly raccourciDebutActif = computed<RaccourciDebut | null>(() => {
    const debut = this.formValue().dateDebut ?? null;
    if (!debut) return null;
    const dates = this.datesDebut();
    return (Object.keys(dates) as RaccourciDebut[]).find(cle => memeJour(debut, dates[cle])) ?? null;
  });

  protected appliquerDebut(cle: RaccourciDebut | null): void {
    if (!cle) return;
    const ctrl = this.form.get('dateDebut')!;
    ctrl.setValue(this.datesDebut()[cle]);
    ctrl.markAsDirty();
  }

  /** Une politique se termine à la fin d'un mois : les raccourcis restent au mois. */
  private readonly datesFin = computed<Record<RaccourciFin, Date | null>>(() => {
    const debut = this.formValue().dateDebut ?? null;
    return {
      SANS_FIN: null,
      UN_AN: debut ? premierDuMois(finApresUnAn(debut)) : null,
      FIN_ANNEE: premierDuMois(finDeLAnnee(this.aujourdHui())),
    };
  });

  protected readonly raccourcisFin = computed<OptionChoix<RaccourciFin>[]>(() => {
    const f = this.t.argentPoche.form;
    const dates = this.datesFin();
    return [
      { value: 'SANS_FIN', titre: f.sansFin, sousTitre: this.t.argentPoche.form.politique.sansFinAide },
      { value: 'UN_AN', titre: f.unAn, sousTitre: dates.UN_AN ? moisAnnee(dates.UN_AN, this.locale()) : undefined, desactive: !dates.UN_AN },
      { value: 'FIN_ANNEE', titre: f.finAnnee, sousTitre: dates.FIN_ANNEE ? moisAnnee(dates.FIN_ANNEE, this.locale()) : undefined },
    ];
  });

  protected readonly raccourciFinActif = computed<RaccourciFin | null>(() => {
    const fin = this.formValue().dateFin ?? null;
    if (!fin) return 'SANS_FIN';
    const dates = this.datesFin();
    return (Object.keys(dates) as RaccourciFin[]).find(cle => cle !== 'SANS_FIN' && memeJour(fin, dates[cle])) ?? null;
  });

  protected appliquerFin(cle: RaccourciFin | null): void {
    if (!cle) return;
    const date = this.datesFin()[cle];
    if (cle !== 'SANS_FIN' && !date) return;
    const ctrl = this.form.get('dateFin')!;
    ctrl.setValue(cle === 'SANS_FIN' ? null : date);
    ctrl.markAsDirty();
  }

  // ── Étape « compte » ──────────────────────────────────────────────────

  protected readonly optionsComptes = computed<OptionChoix<string>[]>(() =>
    optionsComptes(this.comptes(), this.membres()),
  );

  protected choisirCompte(id: string | null): void {
    this.form.get('compteId')!.setValue(id);
    this.form.get('compteId')!.markAsDirty();
  }

  // ── Aperçu « 6 prochains mois » ───────────────────────────────────────

  /**
   * Fenêtre de 6 mois consécutifs démarrant à la date de début (ou au mois
   * courant si elle n'est pas renseignée), plafonnée à la date de fin.
   */
  private fenetreSixMois(dateDebut: Date | null, dateFin: Date | null): { annee: number; mois: number }[] {
    const debut = dateDebut ?? this.aujourdHui();
    const resultat: { annee: number; mois: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(debut.getFullYear(), debut.getMonth() + i, 1);
      if (dateFin && (d.getFullYear() > dateFin.getFullYear()
        || (d.getFullYear() === dateFin.getFullYear() && d.getMonth() > dateFin.getMonth()))) {
        break;
      }
      resultat.push({ annee: d.getFullYear(), mois: d.getMonth() + 1 });
    }
    return resultat;
  }

  /**
   * Clé de chargement du reste à vivre brut : seuls (membre, début, fin)
   * déclenchent un appel réseau — les champs de formule sont recalculés
   * localement, sans aller-retour serveur à chaque frappe.
   */
  private readonly _apercuCle = computed<{ foyerId: string; scenarioId: string; membreId: string; annees: number[] } | null>(() => {
    const v = this.formValue();
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    if (!this.visible() || !v.membreId || !foyerId || !scenarioId) return null;
    const annees = [...new Set(this.fenetreSixMois(v.dateDebut ?? null, v.dateFin ?? null).map(f => f.annee))];
    return { foyerId, scenarioId, membreId: v.membreId, annees };
  }, {
    equal: (a, b) => a === b || (a !== null && b !== null
      && a.foyerId === b.foyerId && a.scenarioId === b.scenarioId && a.membreId === b.membreId
      && a.annees.length === b.annees.length && a.annees.every((v, i) => v === b.annees[i])),
  });

  private readonly _apercuData = creerChargementReactif(this._apercuCle, ({ foyerId, scenarioId, membreId, annees }) =>
    forkJoin(annees.map(annee => this.resolutionSvc.ravBrutAnnee(foyerId, scenarioId, membreId, annee)))
      .pipe(switchMap(parAnnee => {
        const map = new Map<string, number>();
        parAnnee.forEach((liste, i) => liste.forEach((r: RavBrutMoisDto) => map.set(`${annees[i]}-${r.mois}`, r.rav)));
        return of(map);
      })),
  );

  protected readonly chargementApercu = computed(() => this._apercuData.chargement());

  protected readonly apercu = computed(() => {
    const v = this.formValue();
    const ravParMois = this._apercuData.donnees();
    if (!ravParMois) return [];
    return this.fenetreSixMois(v.dateDebut ?? null, v.dateFin ?? null).map(({ annee, mois }) => {
      const rav = ravParMois.get(`${annee}-${mois}`) ?? 0;
      const montant = calculerMontant(v.mode ?? 'VARIABLE', v.socle ?? null, v.pourcentage ?? null, v.plafond ?? null, v.montantFixe ?? null, rav);
      const couleurCss = couleurDe(classifier(v.mode ?? 'VARIABLE', v.socle ?? null, v.plafond ?? null, v.montantFixe ?? null, rav, montant));
      // Dénominateur toujours le RàV du mois : la barre continue de refléter
      // chaque variation du pourcentage tant que le montant reste sous le RàV.
      return {
        moisLibelle: moisAnnee(new Date(annee, mois - 1, 1), this.locale()),
        rav,
        montant,
        couleurCss,
        meterItems: [{ value: Math.max(0, Math.min(montant, rav)), color: couleurCss }] as MeterItem[],
        meterMax: Math.max(rav, 1e-9),
      };
    });
  });

  /** Moyenne des montants de la fenêtre : l'impact mensuel affiché dans la fiche. */
  private readonly montantMoyen = computed(() => {
    const lignes = this.apercu();
    if (!lignes.length) return null;
    return lignes.reduce((s, l) => s + l.montant, 0) / lignes.length;
  });

  /** Reste à vivre moyen de la fenêtre — base du préremplissage socle/plafond. */
  private readonly ravMoyen = computed(() => {
    const lignes = this.apercu();
    if (!lignes.length) return null;
    return lignes.reduce((s, l) => s + l.rav, 0) / lignes.length;
  });

  // ── Fiche ─────────────────────────────────────────────────────────────

  protected readonly ficheTitre = computed(() => this.formValue().nom?.trim() || this.t.poste.form.sansNom);

  protected readonly ficheSousTitre = computed(() => this.t.argentPoche.titre);

  protected readonly lignesFiche = computed<LigneFiche[]>(() => {
    const f = this.t.argentPoche.form.politique.fiche;
    const visitees = this.etapesVisitees();
    const valeurs: Record<EtapePolitique, string | null> = {
      quoi: this.nomMembre(),
      formule: this.resumeFormule(),
      validite: this.resumeValidite(),
      compte: this.libelleCompte(),
    };
    const libelles: Record<EtapePolitique, string> = {
      quoi: f.membre, formule: f.formule, validite: f.validite, compte: f.compte,
    };
    return ETAPES.map(cle => {
      const valeur = visitees.has(cle) ? valeurs[cle] : null;
      const etat = this.etapeCourante() === cle ? 'courante' : valeur ? 'faite' : 'vide';
      return { cle, libelle: libelles[cle], valeur, etat } as LigneFiche;
    });
  });

  protected readonly impactPrincipal = computed(() => {
    if (!this.etapesVisitees().has('formule')) return '…';
    const moyen = this.montantMoyen();
    return moyen === null ? '…' : this.montantPipe.transform(moyen);
  });

  protected readonly impactSecondaire = computed(() => this.t.argentPoche.form.politique.impactSecondaire);

  private nomMembre(): string | null {
    return this.membres().find(m => m.id === this.formValue().membreId)?.nom ?? null;
  }

  private libelleCompte(): string | null {
    return this.comptes().find(c => c.id === this.formValue().compteId)?.libelle ?? null;
  }

  private resumeFormule(): string | null {
    const v = this.formValue();
    const r = this.t.argentPoche.resume;
    if (v.mode === 'FIXE') {
      return v.montantFixe == null ? null : r.fixe.replace('{{montant}}', this.montantPipe.transform(v.montantFixe));
    }
    return r.variable
      .replace('{{pourcentage}}', String(v.pourcentage ?? 0))
      .replace('{{socle}}', this.montantPipe.transform(v.socle ?? 0))
      .replace('{{plafond}}', this.montantPipe.transform(v.plafond ?? 0));
  }

  private resumeValidite(): string | null {
    const v = this.formValue();
    if (!v.dateDebut) return null;
    const f = this.t.scenario.form;
    const debut = moisAnnee(v.dateDebut, this.locale());
    return v.dateFin
      ? f.resumePeriode.replace('{{debut}}', debut).replace('{{fin}}', moisAnnee(v.dateFin, this.locale()))
      : f.resumePeriodeOuverte.replace('{{debut}}', debut);
  }

  // ── Validation et navigation ──────────────────────────────────────────

  /**
   * Validation métier miroir de `ArgentPocheService` : mode FIXE ⇒ montant > 0,
   * mode VARIABLE ⇒ socle/pourcentage/plafond renseignés et plafond ≥ socle.
   */
  protected readonly erreurFormule = computed<string | null>(() => {
    if (!this.etapesTouchees().has('formule')) return null;
    return this.messageErreurFormule();
  });

  private messageErreurFormule(): string | null {
    const v = this.formValue();
    const e = this.t.argentPoche.erreurs;
    if (v.mode === 'FIXE') {
      return v.montantFixe == null || v.montantFixe <= 0 ? e.modeFixeMontantRequis : null;
    }
    if (v.socle == null || v.pourcentage == null || v.plafond == null) return e.modeVariableChampsRequis;
    if (v.plafond < v.socle) return e.plafondInferieurSocle;
    return null;
  }

  protected etapeValide(cle: EtapePolitique): boolean {
    switch (cle) {
      case 'quoi':     return this.form.get('nom')!.valid && this.form.get('membreId')!.valid;
      case 'formule':  return this.messageErreurFormule() === null;
      case 'validite': return this.form.get('dateDebut')!.valid;
      case 'compte':   return this.form.get('compteId')!.valid;
    }
  }

  private quitterEtape(cle: EtapePolitique): void {
    this.etapesTouchees.update(s => new Set(s).add(cle));
    if (cle === 'quoi') this.form.get('nom')!.markAsTouched();
    if (cle === 'validite') this.form.get('dateDebut')!.markAsTouched();
  }

  protected allerA(cible: string): void {
    const vers = ETAPES.indexOf(cible as EtapePolitique);
    if (vers < 0) return;
    const depuis = this.indexCourant();
    if (vers > depuis) {
      for (let i = depuis; i < vers; i++) {
        this.quitterEtape(ETAPES[i]);
        if (!this.etapeValide(ETAPES[i])) { this.positionner(ETAPES[i]); return; }
      }
    }
    this.positionner(ETAPES[vers]);
  }

  private positionner(cle: EtapePolitique): void {
    this.etapeCourante.set(cle);
    this.etapesVisitees.update(s => new Set(s).add(cle));
  }

  protected suivant(): void {
    this.allerA(ETAPES[Math.min(this.indexCourant() + 1, ETAPES.length - 1)]);
  }

  protected precedent(): void {
    this.positionner(ETAPES[Math.max(this.indexCourant() - 1, 0)]);
  }

  protected allerALaFin(): void {
    this.allerA('compte');
  }

  protected naviguerDepuisFiche(cle: string): void {
    if (this.etapesVisitees().has(cle as EtapePolitique)) this.positionner(cle as EtapePolitique);
    else this.allerA(cle);
  }

  protected fermer(): void {
    this.visibleChange.emit(false);
  }

  protected soumettre(): void {
    this.form.markAllAsTouched();
    for (const cle of ETAPES) {
      this.etapesTouchees.update(s => new Set(s).add(cle));
      if (!this.etapeValide(cle)) { this.positionner(cle); return; }
    }
    const v = this.form.getRawValue();
    this.enregistrer.emit({
      membreId:    v.membreId!,
      compteId:    v.compteId!,
      nom:         v.nom!,
      dateDebut:   dateVersYearMonth(v.dateDebut!),
      dateFin:     v.dateFin ? dateVersYearMonth(v.dateFin) : undefined,
      mode:        v.mode!,
      socle:       v.mode === 'VARIABLE' ? (v.socle ?? 0)       : undefined,
      pourcentage: v.mode === 'VARIABLE' ? (v.pourcentage ?? 0) : undefined,
      plafond:     v.mode === 'VARIABLE' ? (v.plafond ?? 0)     : undefined,
      montantFixe: v.mode === 'FIXE'     ? (v.montantFixe ?? 0) : undefined,
    });
  }

  protected readonly pastillesCompte = pastillesMembres;
}

/** "2026-03" → 1er mars 2026 (date locale). */
function yearMonthVersDate(ym: string): Date {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

/** Date → "2026-03". */
function dateVersYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Miroir exact de `ArgentPocheService.calculerFormule` : en mode VARIABLE, le
 * pourcentage s'applique au reste à vivre brut, le socle fait plancher et le
 * plafond fait plafond absolu.
 */
function calculerMontant(
  mode: ModePolitiqueArgentPoche,
  socle: number | null, pourcentage: number | null, plafond: number | null,
  montantFixe: number | null, rav: number,
): number {
  if (mode === 'FIXE') return montantFixe ?? 0;
  return Math.min(Math.max(rav * (pourcentage ?? 0) / 100, socle ?? 0), plafond ?? 0);
}

/** Classification du « risque » d'un mois vis-à-vis du reste à vivre disponible. */
function classifier(
  mode: ModePolitiqueArgentPoche,
  socle: number | null, plafond: number | null, montantFixe: number | null,
  rav: number, montant: number,
): 'rouge' | 'vert' | 'or' {
  if (mode === 'FIXE') return (montantFixe ?? 0) > rav ? 'rouge' : 'or';
  if (montant >= (plafond ?? 0)) return 'rouge';
  if (montant <= (socle ?? 0)) return 'vert';
  return 'or';
}

function couleurDe(couleur: 'rouge' | 'vert' | 'or'): string {
  switch (couleur) {
    case 'rouge': return 'var(--app-danger)';
    case 'vert':  return 'var(--app-success)';
    default:      return 'var(--app-argent-poche)';
  }
}
