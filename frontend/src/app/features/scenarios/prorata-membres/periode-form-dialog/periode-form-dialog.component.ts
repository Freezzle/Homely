import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { MessageModule } from 'primeng/message';
import { TranslateService } from '@ngx-translate/core';
import { MembreDto, RepartitionPeriodeDto } from '../../../../core/models/api.models';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { localeDeLangue } from '../../../../core/i18n/locale.util';
import { parseIsoDateLocal, toIsoDateLocal } from '../../../../core/utils/date.util';
import { arrondirSommeRepartition, sommeRepartitionValide } from '../../../../core/utils/repartition.util';
import { normaliserCouleur } from '../../../../shared/utils/couleur.util';
import { ParcoursGuideComponent } from '../../../../shared/components/parcours-guide/parcours-guide.component';
import { EtapeParcours, LigneFiche } from '../../../../shared/components/parcours-guide/parcours-guide.model';
import { ChoixPucesComponent } from '../../../../shared/components/choix-puces/choix-puces.component';
import { OptionChoix } from '../../../../shared/components/choix-cartes/option-choix.model';
import { DatePickerComponent, InputNumberComponent } from '../../../../shared/components/form-fields';
import {
  dateLisible, debutDAnnee, finDeLAnnee, memeJour, premierDuMois,
} from '../../../postes/poste-form-dialog/poste-form-etapes';

type EtapePeriode = 'periode' | 'parts';
type RaccourciDebut = 'CE_MOIS' | 'PROCHAIN_MOIS' | 'DEBUT_ANNEE' | 'DEBUT_ANNEE_PROCHAINE';
type RaccourciFin = 'SANS_FIN' | 'FIN_ANNEE';
type Preset = 'CINQUANTE' | 'TOUT_A' | 'TOUT_B';

const ETAPES: readonly EtapePeriode[] = ['periode', 'parts'];

/** Requête envoyée à l'API — identique au contrat existant de l'écran. */
export interface RepartitionPeriodeRequest {
  debut?: string;
  fin?: string;
  parts: { membreId: string; quotePart: number }[];
}

const arrondirPart = (v: number): number => Math.round(v * 100) / 100;

/**
 * Création et édition d'une période de répartition (prorata), en parcours guidé.
 * Les dates d'une période existante ne se modifient pas ici : elles passent par
 * les actions dédiées « Réviser les taux » et « Décaler la date d'effet ».
 */
@Component({
  selector: 'app-periode-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, MessageModule,
    ParcoursGuideComponent, ChoixPucesComponent,
    DatePickerComponent, InputNumberComponent,
  ],
  templateUrl: './periode-form-dialog.component.html',
  styleUrl: './periode-form-dialog.component.scss',
})
export class PeriodeFormDialogComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  readonly visible = input<boolean>(false);
  readonly periode = input<RepartitionPeriodeDto | null>(null);
  readonly membres = input.required<readonly MembreDto[]>();
  /** Périodes existantes du scénario : sert au contrôle de chevauchement. */
  readonly periodes = input<readonly RepartitionPeriodeDto[]>([]);
  readonly enregistrementEnCours = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistrer = output<RepartitionPeriodeRequest>();

  protected readonly locale = computed(() => localeDeLangue(this.translate.currentLang()));
  protected readonly modeEdition = computed(() => this.periode() !== null);

  readonly form = this.fb.group({
    debut: [null as Date | null, Validators.required],
    fin:   [null as Date | null],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parts: this.fb.array([] as any[]),
  });

  get partsArray() { return this.form.get('parts') as FormArray; }

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.value)),
    { initialValue: this.form.value },
  );

  private readonly aujourdHui = signal(new Date());

  protected readonly etapeCourante = signal<EtapePeriode>('periode');
  private readonly etapesVisitees = signal<Set<EtapePeriode>>(new Set<EtapePeriode>(['periode']));
  private readonly etapesTouchees = signal<Set<EtapePeriode>>(new Set<EtapePeriode>());

  protected readonly etapesParcours = computed<EtapeParcours[]>(() => {
    const e = this.t.scenario.form.etapes;
    return ETAPES.map(cle => ({ cle, titre: e[cle] }));
  });

  private readonly indexCourant = computed(() => Math.max(ETAPES.indexOf(this.etapeCourante()), 0));

  protected readonly deuxMembres = computed(() => this.membres().length === 2);
  protected readonly membreA = computed(() => this.membres()[0]);
  protected readonly membreB = computed(() => this.membres()[1]);

  // ── Ouverture / initialisation ────────────────────────────────────────

  private readonly _initSurOuverture = effect(() => {
    const p = this.periode();
    const visible = this.visible();
    untracked(() => {
      if (!visible) return;
      this.aujourdHui.set(new Date());
      if (p) this.initialiserEdition(p); else this.initialiserCreation();
    });
  });

  private initialiserCreation(): void {
    this.form.reset({ debut: null, fin: null });
    this.form.get('debut')!.enable();
    this.form.get('fin')!.enable();
    this.initialiserParts();
    this.etapeCourante.set('periode');
    this.etapesVisitees.set(new Set<EtapePeriode>(['periode']));
    this.etapesTouchees.set(new Set<EtapePeriode>());
  }

  private initialiserEdition(p: RepartitionPeriodeDto): void {
    this.form.patchValue({
      debut: p.debut ? parseIsoDateLocal(p.debut) : null,
      fin:   p.fin   ? parseIsoDateLocal(p.fin)   : null,
    });
    // Les dates d'une période existante ne se modifient plus ici : elles passent
    // par « Réviser les taux » / « Décaler la date d'effet ».
    this.form.get('debut')!.disable();
    this.form.get('fin')!.disable();
    this.initialiserParts(p.parts.map(pp => ({ membreId: pp.membreId, quotePart: arrondirPart(pp.quotePart * 100) })));
    this.etapeCourante.set('periode');
    this.etapesVisitees.set(new Set<EtapePeriode>(ETAPES));
    this.etapesTouchees.set(new Set<EtapePeriode>());
  }

  private initialiserParts(existantes?: { membreId: string; quotePart: number }[]): void {
    const membres = this.membres();
    while (this.partsArray.length > membres.length) this.partsArray.removeAt(this.partsArray.length - 1);
    membres.forEach((m, i) => {
      const ex = existantes?.find(e => e.membreId === m.id);
      const quotePart = ex ? ex.quotePart : arrondirPart(100 / Math.max(membres.length, 1));
      if (i < this.partsArray.length) {
        this.partsArray.at(i).patchValue({ membreId: m.id, quotePart });
      } else {
        this.partsArray.push(this.fb.group({ membreId: [m.id], quotePart: [quotePart] }));
      }
    });
  }

  // ── Étape « période » ─────────────────────────────────────────────────

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
    const f = this.t.poste.form;
    const dates = this.datesDebut();
    const libelles: Record<RaccourciDebut, string> = {
      CE_MOIS: f.ceMois,
      PROCHAIN_MOIS: f.prochainMois,
      DEBUT_ANNEE: f.debutAnnee,
      DEBUT_ANNEE_PROCHAINE: f.debutAnneeProchaine,
    };
    return (Object.keys(libelles) as RaccourciDebut[]).map(cle => ({
      value: cle, titre: libelles[cle], sousTitre: dateLisible(dates[cle], this.locale()),
    }));
  });

  protected readonly raccourciDebutActif = computed<RaccourciDebut | null>(() => {
    const debut = this.valeurDebut();
    if (!debut) return null;
    const dates = this.datesDebut();
    return (Object.keys(dates) as RaccourciDebut[]).find(cle => memeJour(debut, dates[cle])) ?? null;
  });

  protected appliquerDebut(cle: RaccourciDebut | null): void {
    if (!cle) return;
    const ctrl = this.form.get('debut')!;
    ctrl.setValue(this.datesDebut()[cle]);
    ctrl.markAsDirty();
  }

  private readonly datesFin = computed<Record<RaccourciFin, Date | null>>(() => ({
    SANS_FIN: null,
    FIN_ANNEE: finDeLAnnee(this.aujourdHui()),
  }));

  protected readonly raccourcisFin = computed<OptionChoix<RaccourciFin>[]>(() => {
    const f = this.t.scenario.form;
    const dates = this.datesFin();
    return [
      { value: 'SANS_FIN', titre: f.sansFin, sousTitre: f.sansFinAide },
      {
        value: 'FIN_ANNEE',
        titre: this.t.poste.form.finAnnee,
        sousTitre: dates.FIN_ANNEE ? dateLisible(dates.FIN_ANNEE, this.locale()) : undefined,
      },
    ];
  });

  protected readonly raccourciFinActif = computed<RaccourciFin | null>(() => {
    const fin = this.valeurFin();
    if (!fin) return 'SANS_FIN';
    return memeJour(fin, this.datesFin().FIN_ANNEE) ? 'FIN_ANNEE' : null;
  });

  protected appliquerFin(cle: RaccourciFin | null): void {
    if (!cle) return;
    const ctrl = this.form.get('fin')!;
    ctrl.setValue(cle === 'SANS_FIN' ? null : this.datesFin()[cle]);
    ctrl.markAsDirty();
  }

  /** Les contrôles sont désactivés en édition : `value` les omettrait. */
  private valeurDebut(): Date | null {
    this.formValue();
    return (this.form.getRawValue().debut as Date | null) ?? null;
  }

  private valeurFin(): Date | null {
    this.formValue();
    return (this.form.getRawValue().fin as Date | null) ?? null;
  }

  /**
   * Miroir côté UX des règles serveur (docs/01 §6.5) : fin ≥ début, pas de
   * chevauchement entre périodes, au plus une période ouverte par scénario.
   */
  protected readonly erreurPeriode = computed<string | null>(() => {
    const debut = this.valeurDebut();
    if (!debut) return null;
    const fin = this.valeurFin();

    if (fin && fin.getTime() < debut.getTime()) return this.t.scenario.periodeFinAvantDebut;

    const autres = this.periodes().filter(p => p.id !== this.periode()?.id);
    const debutTime = debut.getTime();
    const finTime = fin ? fin.getTime() : Number.POSITIVE_INFINITY;

    for (const p of autres) {
      if (!p.debut) continue;
      const pDebutTime = parseIsoDateLocal(p.debut).getTime();
      const pFinTime = p.fin ? parseIsoDateLocal(p.fin).getTime() : Number.POSITIVE_INFINITY;
      // Deux intervalles se chevauchent si debut <= pFin ET pDebut <= fin
      // (bornes incluses : la fin d'une période et le début de la suivante ne
      // doivent pas tomber le même jour).
      if (debutTime <= pFinTime && pDebutTime <= finTime) return this.t.scenario.periodeChevauche;
    }

    if (!fin && autres.some(p => !p.fin)) return this.t.scenario.periodeOuverteDejaExistante;

    return null;
  });

  // ── Étape « parts » ───────────────────────────────────────────────────

  protected readonly parts = computed<number[]>(() => {
    this.formValue();
    return this.partsArray.controls.map(c => arrondirPart(c.get('quotePart')?.value ?? 0));
  });

  protected readonly somme = computed(() => arrondirSommeRepartition(this.parts().reduce((s, v) => s + v, 0)));
  protected readonly sommeValide = computed(() => sommeRepartitionValide(this.somme()));

  /** Valeur du curseur pendant le glissement (avant validation du choix). */
  private readonly curseurEnCours = signal<number | null>(null);

  protected readonly partA = computed(() => this.curseurEnCours() ?? this.parts()[0] ?? 0);
  protected readonly partB = computed(() => arrondirPart(100 - this.partA()));

  protected readonly presets = computed<OptionChoix<Preset>[]>(() => {
    const f = this.t.scenario.form;
    return [
      { value: 'TOUT_A', titre: f.toutMembre.replace('{{nom}}', this.membreA()?.nom ?? '') },
      { value: 'CINQUANTE', titre: f.cinquante },
      { value: 'TOUT_B', titre: f.toutMembre.replace('{{nom}}', this.membreB()?.nom ?? '') },
    ];
  });

  protected readonly presetActif = computed<Preset | null>(() => {
    const a = this.parts()[0] ?? 0;
    if (a === 100) return 'TOUT_A';
    if (a === 0) return 'TOUT_B';
    if (a === 50) return 'CINQUANTE';
    return null;
  });

  protected readonly curseurAria = computed(() =>
    this.t.poste.form.curseurValeur
      .replace('{{a}}', this.membreA()?.nom ?? '')
      .replace('{{partA}}', String(this.partA()))
      .replace('{{b}}', this.membreB()?.nom ?? '')
      .replace('{{partB}}', String(this.partB())),
  );

  protected readonly curseurLabel = computed(() =>
    this.t.poste.form.curseurRepartition
      .replace('{{a}}', this.membreA()?.nom ?? '')
      .replace('{{b}}', this.membreB()?.nom ?? ''),
  );

  protected onCurseurInput(event: Event): void {
    this.curseurEnCours.set(Number((event.target as HTMLInputElement).value));
  }

  protected onCurseurChange(event: Event): void {
    this.curseurEnCours.set(null);
    this.appliquerDuo(arrondirPart(Number((event.target as HTMLInputElement).value)));
  }

  protected appliquerPreset(preset: Preset | null): void {
    if (!preset) return;
    this.appliquerDuo(preset === 'TOUT_A' ? 100 : preset === 'TOUT_B' ? 0 : 50);
  }

  private appliquerDuo(partA: number): void {
    this.partsArray.at(0).patchValue({ quotePart: partA });
    this.partsArray.at(1).patchValue({ quotePart: arrondirPart(100 - partA) });
    this.form.markAsDirty();
  }

  protected couleur(membre: MembreDto): string {
    return normaliserCouleur(membre.couleur);
  }

  protected initiales(nom: string): string {
    return nom.trim().split(/\s+/).map(mot => mot[0]).slice(0, 2).join('').toUpperCase();
  }

  protected nomMembre(index: number): string {
    return this.membres()[index]?.nom ?? '';
  }

  // ── Fiche ─────────────────────────────────────────────────────────────

  protected readonly ficheTitre = computed(() => this.t.prorata.titre);

  protected readonly lignesFiche = computed<LigneFiche[]>(() => {
    const f = this.t.scenario.form.fiche;
    const visitees = this.etapesVisitees();
    const valeurs: Record<EtapePeriode, string | null> = {
      periode: this.resumePeriode(),
      parts: this.resumeParts(),
    };
    const libelles: Record<EtapePeriode, string> = { periode: f.periode, parts: f.parts };
    return ETAPES.map(cle => {
      const valeur = visitees.has(cle) ? valeurs[cle] : null;
      const etat = this.etapeCourante() === cle ? 'courante' : valeur ? 'faite' : 'vide';
      return { cle, libelle: libelles[cle], valeur, etat } as LigneFiche;
    });
  });

  private resumePeriode(): string | null {
    const debut = this.valeurDebut();
    if (!debut) return null;
    const f = this.t.scenario.form;
    const fin = this.valeurFin();
    const debutLisible = dateLisible(debut, this.locale());
    return fin
      ? f.resumePeriode.replace('{{debut}}', debutLisible).replace('{{fin}}', dateLisible(fin, this.locale()))
      : f.resumePeriodeOuverte.replace('{{debut}}', debutLisible);
  }

  private resumeParts(): string | null {
    const parts = this.parts();
    if (!parts.length) return null;
    return this.membres().map((m, i) => `${m.nom} ${Math.round(parts[i] ?? 0)} %`).join(' · ');
  }

  // ── Validation et navigation ──────────────────────────────────────────

  protected readonly erreurParts = computed<string | null>(() =>
    this.etapesTouchees().has('parts') && !this.sommeValide() ? this.t.commun.repartitionInvalide : null,
  );

  protected etapeValide(cle: EtapePeriode): boolean {
    switch (cle) {
      case 'periode': return this.valeurDebut() !== null && this.erreurPeriode() === null;
      case 'parts':   return this.sommeValide();
    }
  }

  protected allerA(cible: string): void {
    const vers = ETAPES.indexOf(cible as EtapePeriode);
    if (vers < 0) return;
    const depuis = this.indexCourant();
    if (vers > depuis) {
      for (let i = depuis; i < vers; i++) {
        this.etapesTouchees.update(s => new Set(s).add(ETAPES[i]));
        if (ETAPES[i] === 'periode') this.form.get('debut')!.markAsTouched();
        if (!this.etapeValide(ETAPES[i])) { this.positionner(ETAPES[i]); return; }
      }
    }
    this.positionner(ETAPES[vers]);
  }

  private positionner(cle: EtapePeriode): void {
    this.etapeCourante.set(cle);
    this.etapesVisitees.update(s => new Set(s).add(cle));
  }

  protected suivant(): void {
    this.allerA(ETAPES[Math.min(this.indexCourant() + 1, ETAPES.length - 1)]);
  }

  protected precedent(): void {
    this.positionner(ETAPES[Math.max(this.indexCourant() - 1, 0)]);
  }

  protected naviguerDepuisFiche(cle: string): void {
    if (this.etapesVisitees().has(cle as EtapePeriode)) this.positionner(cle as EtapePeriode);
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
      debut: v.debut ? toIsoDateLocal(v.debut as Date) : undefined,
      fin:   v.fin   ? toIsoDateLocal(v.fin as Date)   : undefined,
      parts: this.partsArray.controls.map(c => ({
        membreId: c.get('membreId')!.value,
        quotePart: Math.round((c.get('quotePart')!.value ?? 0) * 100) / 10000,
      })),
    });
  }
}
