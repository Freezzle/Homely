import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { MessageModule } from 'primeng/message';
import { TranslateService } from '@ngx-translate/core';
import { ContexteService } from '../../../core/services/contexte.service';
import { ResolutionArgentPocheService } from '../../../core/services/argent-poche.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../core/i18n/locale.util';
import { MontantPipe } from '../../../core/pipes/format.pipes';
import {
  AllocationArgentPocheDto, CompteDto, MembreDto, SourceArgentPoche,
} from '../../../core/models/api.models';
import { normaliserCouleur } from '../../../shared/utils/couleur.util';
import { ParcoursGuideComponent } from '../../../shared/components/parcours-guide/parcours-guide.component';
import { EtapeParcours, LigneFiche } from '../../../shared/components/parcours-guide/parcours-guide.model';
import { ChoixCartesComponent } from '../../../shared/components/choix-cartes/choix-cartes.component';
import { ChoixPucesComponent } from '../../../shared/components/choix-puces/choix-puces.component';
import { OptionChoix } from '../../../shared/components/choix-cartes/option-choix.model';
import { DatePickerComponent, InputNumberComponent, InputTextComponent } from '../../../shared/components/form-fields';
import { ButtonComponent } from '../../../shared/components/button/button.component';
import { optionsComptes } from '../argent-poche-options.util';
import { memeJour, moisAnnee, premierDuMois } from '../../postes/poste-form-dialog/poste-form-etapes';

type EtapeAllocation = 'quoi' | 'combien' | 'compte';
type RaccourciMois = 'CE_MOIS' | 'PROCHAIN_MOIS';

const ETAPES: readonly EtapeAllocation[] = ['quoi', 'combien', 'compte'];

/** Requête envoyée à l'API — identique au contrat existant de l'écran. */
export interface AllocationArgentPocheRequest {
  membreId: string;
  compteId: string;
  mois: string;
  montant: number;
  raison?: string;
}

/**
 * Création et édition d'une allocation ponctuelle d'argent de poche, en parcours
 * guidé. L'enregistrement reste à la charge de l'écran parent, qui tient la liste.
 */
@Component({
  selector: 'app-allocation-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, MessageModule, MontantPipe, ButtonComponent,
    ParcoursGuideComponent, ChoixCartesComponent, ChoixPucesComponent,
    InputTextComponent, InputNumberComponent, DatePickerComponent,
  ],
  templateUrl: './allocation-form-dialog.component.html',
  styleUrl: './allocation-form-dialog.component.scss',
})
export class AllocationFormDialogComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();
  private readonly fb = inject(FormBuilder);
  private readonly contexte = inject(ContexteService);
  private readonly resolutionSvc = inject(ResolutionArgentPocheService);
  private readonly translate = inject(TranslateService);
  private readonly montantPipe = inject(MontantPipe);

  readonly visible = input<boolean>(false);
  readonly allocation = input<AllocationArgentPocheDto | null>(null);
  readonly membres = input.required<readonly MembreDto[]>();
  readonly comptes = input.required<readonly CompteDto[]>();
  readonly enregistrementEnCours = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistrer = output<AllocationArgentPocheRequest>();

  protected readonly locale = computed(() => localeDeLangue(this.translate.currentLang()));
  protected readonly modeEdition = computed(() => this.allocation() !== null);

  readonly form = this.fb.group({
    membreId: [null as string | null, Validators.required],
    compteId: [null as string | null, Validators.required],
    mois:     [null as Date | null,   Validators.required],
    montant:  [0,                     [Validators.required, Validators.min(0.01)]],
    raison:   [''],
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.value)),
    { initialValue: this.form.value },
  );

  private readonly aujourdHui = signal(new Date());

  protected readonly etapeCourante = signal<EtapeAllocation>('quoi');
  private readonly etapesVisitees = signal<Set<EtapeAllocation>>(new Set<EtapeAllocation>(['quoi']));
  private readonly etapesTouchees = signal<Set<EtapeAllocation>>(new Set<EtapeAllocation>());

  /** Montant prévu par la politique en vigueur pour le couple (membre, mois). */
  private readonly _resolution = signal<{ montant: number; source: SourceArgentPoche } | null>(null);
  protected readonly resolution = this._resolution.asReadonly();

  protected readonly etapesParcours = computed<EtapeParcours[]>(() => {
    const e = this.t.argentPoche.form.allocation.etapes;
    return ETAPES.map(cle => ({ cle, titre: e[cle] }));
  });

  private readonly indexCourant = computed(() => Math.max(ETAPES.indexOf(this.etapeCourante()), 0));
  protected readonly peutAllerFin = computed(() =>
    this.etapesVisitees().has('compte') && this.etapeCourante() !== 'compte',
  );

  // ── Ouverture / initialisation ────────────────────────────────────────

  private readonly _initSurOuverture = effect(() => {
    const a = this.allocation();
    const visible = this.visible();
    untracked(() => {
      if (!visible) return;
      this.aujourdHui.set(new Date());
      this._resolution.set(null);
      if (a) {
        this.form.setValue({
          membreId: a.membreId,
          compteId: a.compteId,
          mois: yearMonthVersDate(a.mois),
          montant: a.montant,
          raison: a.raison ?? '',
        });
        this.etapesVisitees.set(new Set<EtapeAllocation>(ETAPES));
      } else {
        this.form.reset({ membreId: null, compteId: null, mois: premierDuMois(this.aujourdHui()), montant: 0, raison: '' });
        this.etapesVisitees.set(new Set<EtapeAllocation>(['quoi']));
      }
      this.etapeCourante.set('quoi');
      this.etapesTouchees.set(new Set<EtapeAllocation>());
    });
  });

  /**
   * Rappelle le montant que donnerait la politique en vigueur pour (membre,
   * mois) : l'utilisateur voit l'écart qu'il s'apprête à créer. Rechargé dès
   * que l'un des deux change, et uniquement quand la popin est ouverte.
   */
  private readonly _chargerResolution = effect(() => {
    const v = this.formValue();
    const foyerId = this.contexte.foyerId();
    const scenarioId = this.contexte.scenarioId();
    const visible = this.visible();
    const mois = v.mois instanceof Date ? dateVersYearMonth(v.mois) : null;
    const membreId = v.membreId ?? null;
    untracked(() => {
      if (!visible || !foyerId || !scenarioId || !membreId || !mois) {
        this._resolution.set(null);
        return;
      }
      this.resolutionSvc.resoudre(foyerId, scenarioId, membreId, mois).subscribe({
        next: r => this._resolution.set({ montant: r.montant, source: r.source }),
        error: () => this._resolution.set(null),
      });
    });
  });

  // ── Étape « quoi » : membre et mois ───────────────────────────────────

  protected readonly optionsMembres = computed<OptionChoix<string>[]>(() =>
    this.membres().map(m => ({ value: m.id, titre: m.nom, couleur: normaliserCouleur(m.couleur) })),
  );

  protected choisirMembre(id: string | null): void {
    this.form.get('membreId')!.setValue(id);
    this.form.get('membreId')!.markAsDirty();
  }

  private readonly datesMois = computed<Record<RaccourciMois, Date>>(() => ({
    CE_MOIS: premierDuMois(this.aujourdHui()),
    PROCHAIN_MOIS: premierDuMois(this.aujourdHui(), 1),
  }));

  protected readonly raccourcisMois = computed<OptionChoix<RaccourciMois>[]>(() => {
    const f = this.t.argentPoche.form;
    const dates = this.datesMois();
    return [
      { value: 'CE_MOIS', titre: f.ceMois, sousTitre: moisAnnee(dates.CE_MOIS, this.locale()) },
      { value: 'PROCHAIN_MOIS', titre: f.prochainMois, sousTitre: moisAnnee(dates.PROCHAIN_MOIS, this.locale()) },
    ];
  });

  protected readonly raccourciMoisActif = computed<RaccourciMois | null>(() => {
    const mois = this.formValue().mois ?? null;
    if (!mois) return null;
    const dates = this.datesMois();
    return (Object.keys(dates) as RaccourciMois[]).find(cle => memeJour(mois, dates[cle])) ?? null;
  });

  protected appliquerMois(cle: RaccourciMois | null): void {
    if (!cle) return;
    const ctrl = this.form.get('mois')!;
    ctrl.setValue(this.datesMois()[cle]);
    ctrl.markAsDirty();
  }

  // ── Étape « combien » ─────────────────────────────────────────────────

  protected reprendreMontantTheorique(): void {
    const r = this._resolution();
    if (!r) return;
    this.form.get('montant')!.setValue(r.montant);
    this.form.get('montant')!.markAsDirty();
  }

  // ── Étape « compte » ──────────────────────────────────────────────────

  protected readonly optionsComptes = computed<OptionChoix<string>[]>(() =>
    optionsComptes(this.comptes(), this.membres()),
  );

  protected choisirCompte(id: string | null): void {
    this.form.get('compteId')!.setValue(id);
    this.form.get('compteId')!.markAsDirty();
  }

  // ── Fiche ─────────────────────────────────────────────────────────────

  protected readonly ficheTitre = computed(() =>
    this.nomMembre() ?? this.t.argentPoche.form.allocation.badge,
  );

  protected readonly lignesFiche = computed<LigneFiche[]>(() => {
    const f = this.t.argentPoche.form.allocation.fiche;
    const visitees = this.etapesVisitees();
    const valeurs: Record<EtapeAllocation, string | null> = {
      quoi: this.resumeMembreMois(),
      combien: this.resumeMontant(),
      compte: this.libelleCompte(),
    };
    const libelles: Record<EtapeAllocation, string> = {
      quoi: f.membreMois, combien: f.montant, compte: f.compte,
    };
    return ETAPES.map(cle => {
      const valeur = visitees.has(cle) ? valeurs[cle] : null;
      const etat = this.etapeCourante() === cle ? 'courante' : valeur ? 'faite' : 'vide';
      return { cle, libelle: libelles[cle], valeur, etat } as LigneFiche;
    });
  });

  protected readonly impactPrincipal = computed(() => {
    if (!this.etapesVisitees().has('combien')) return '…';
    const montant = this.formValue().montant ?? 0;
    return montant ? this.montantPipe.transform(montant) : '…';
  });

  protected readonly impactSecondaire = computed(() => this.t.argentPoche.form.allocation.impactSecondaire);

  private nomMembre(): string | null {
    return this.membres().find(m => m.id === this.formValue().membreId)?.nom ?? null;
  }

  private libelleCompte(): string | null {
    return this.comptes().find(c => c.id === this.formValue().compteId)?.libelle ?? null;
  }

  private resumeMembreMois(): string | null {
    const nom = this.nomMembre();
    const mois = this.formValue().mois ?? null;
    if (!nom && !mois) return null;
    return [nom, mois ? moisAnnee(mois, this.locale()) : null].filter(Boolean).join(' · ');
  }

  private resumeMontant(): string | null {
    const v = this.formValue();
    if (!v.montant) return null;
    const base = this.montantPipe.transform(v.montant);
    return v.raison ? `${base} · ${v.raison}` : base;
  }

  // ── Validation et navigation ──────────────────────────────────────────

  protected etapeValide(cle: EtapeAllocation): boolean {
    switch (cle) {
      case 'quoi':    return this.form.get('membreId')!.valid && this.form.get('mois')!.valid;
      case 'combien': return this.form.get('montant')!.valid;
      case 'compte':  return this.form.get('compteId')!.valid;
    }
  }

  private quitterEtape(cle: EtapeAllocation): void {
    this.etapesTouchees.update(s => new Set(s).add(cle));
    if (cle === 'quoi') this.form.get('mois')!.markAsTouched();
    if (cle === 'combien') this.form.get('montant')!.markAsTouched();
  }

  protected allerA(cible: string): void {
    const vers = ETAPES.indexOf(cible as EtapeAllocation);
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

  private positionner(cle: EtapeAllocation): void {
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
    if (this.etapesVisitees().has(cle as EtapeAllocation)) this.positionner(cle as EtapeAllocation);
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
      membreId: v.membreId!,
      compteId: v.compteId!,
      mois:     dateVersYearMonth(v.mois!),
      montant:  v.montant!,
      raison:   v.raison || undefined,
    });
  }
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
