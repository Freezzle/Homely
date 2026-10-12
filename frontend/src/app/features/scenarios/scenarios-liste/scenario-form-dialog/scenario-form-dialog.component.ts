import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { MessageModule } from 'primeng/message';
import { MembreDto, ScenarioDto } from '../../../../core/models/api.models';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { MontantPipe } from '../../../../core/pipes/format.pipes';
import { arrondirSommeRepartition, sommeRepartitionValide } from '../../../../core/utils/repartition.util';
import { normaliserCouleur } from '../../../../shared/utils/couleur.util';
import { ParcoursGuideComponent } from '../../../../shared/components/parcours-guide/parcours-guide.component';
import { EtapeParcours, LigneFiche } from '../../../../shared/components/parcours-guide/parcours-guide.model';
import { ChoixPucesComponent } from '../../../../shared/components/choix-puces/choix-puces.component';
import { OptionChoix } from '../../../../shared/components/choix-cartes/option-choix.model';
import { InputNumberComponent, InputTextComponent } from '../../../../shared/components/form-fields';

type EtapeScenario = 'quoi' | 'projection' | 'repartition';
type Preset = 'CINQUANTE' | 'TOUT_A' | 'TOUT_B';

const arrondirPart = (v: number): number => Math.round(v * 100) / 100;

/** Requête envoyée à l'API — identique au contrat existant de l'écran. */
export interface ScenarioFormRequest {
  nom: string;
  anneeDepart: number;
  tresorerieInitiale: number;
  horizonAnnees: number;
  repartitions: { membreId: string; quotePart: number }[];
}

/**
 * Création et édition d'un scénario, en parcours guidé. L'étape « Répartition »
 * n'existe qu'à la création d'un foyer à plusieurs membres : en édition, la
 * répartition se gère via les périodes de prorata dédiées.
 */
@Component({
  selector: 'app-scenario-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, FormsModule, MessageModule,
    ParcoursGuideComponent, ChoixPucesComponent, InputTextComponent, InputNumberComponent,
  ],
  templateUrl: './scenario-form-dialog.component.html',
  styleUrl: './scenario-form-dialog.component.scss',
})
export class ScenarioFormDialogComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();
  private readonly fb = inject(FormBuilder);
  private readonly montantPipe = inject(MontantPipe);

  readonly visible = input<boolean>(false);
  readonly scenario = input<ScenarioDto | null>(null);
  readonly membres = input.required<readonly MembreDto[]>();
  readonly enregistrementEnCours = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistrer = output<ScenarioFormRequest>();

  protected readonly modeEdition = computed(() => this.scenario() !== null);

  readonly form = this.fb.group({
    nom:                ['', Validators.required],
    anneeDepart:        [new Date().getFullYear(), Validators.required],
    tresorerieInitiale: [0],
    horizonAnnees:      [9, [Validators.required, Validators.min(1)]],
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.value)),
    { initialValue: this.form.value },
  );

  /** membreId → quote-part en % (0–100). Saisie seulement à la création. */
  private readonly parts = signal<Record<string, number>>({});

  protected readonly etapeCourante = signal<EtapeScenario>('quoi');
  private readonly etapesVisitees = signal<Set<EtapeScenario>>(new Set<EtapeScenario>(['quoi']));
  private readonly etapesTouchees = signal<Set<EtapeScenario>>(new Set<EtapeScenario>());

  /**
   * L'étape « Répartition » n'a de sens qu'à la création d'un foyer à plusieurs
   * membres : en édition elle relève des périodes de prorata, et en mono-membre
   * les 100 % sont implicites.
   */
  protected readonly etapes = computed<EtapeScenario[]>(() =>
    this.modeEdition() || this.membres().length <= 1
      ? ['quoi', 'projection']
      : ['quoi', 'projection', 'repartition'],
  );

  protected readonly etapesParcours = computed<EtapeParcours[]>(() => {
    const e = this.t.scenario.form.etapes;
    return this.etapes().map(cle => ({ cle, titre: e[cle] }));
  });

  private readonly indexCourant = computed(() => Math.max(this.etapes().indexOf(this.etapeCourante()), 0));

  protected readonly deuxMembres = computed(() => this.membres().length === 2);
  protected readonly membreA = computed(() => this.membres()[0]);
  protected readonly membreB = computed(() => this.membres()[1]);

  // ── Ouverture / initialisation ────────────────────────────────────────

  private readonly _initSurOuverture = effect(() => {
    const s = this.scenario();
    const visible = this.visible();
    untracked(() => {
      if (!visible) return;
      if (s) {
        this.form.reset({
          nom: s.nom, anneeDepart: s.anneeDepart,
          tresorerieInitiale: s.tresorerieInitiale, horizonAnnees: s.horizonAnnees,
        });
        this.parts.set({});
        this.etapesVisitees.set(new Set<EtapeScenario>(this.etapes()));
      } else {
        this.form.reset({
          nom: '', anneeDepart: new Date().getFullYear(),
          tresorerieInitiale: 0, horizonAnnees: 9,
        });
        this.parts.set(this.partsInitiales());
        this.etapesVisitees.set(new Set<EtapeScenario>(['quoi']));
      }
      this.etapeCourante.set('quoi');
      this.etapesTouchees.set(new Set<EtapeScenario>());
    });
  });

  /** Un seul membre : 100 % implicite. Plusieurs : on propose une part égale. */
  private partsInitiales(): Record<string, number> {
    const membres = this.membres();
    const parts: Record<string, number> = {};
    if (!membres.length) return parts;
    if (membres.length === 1) {
      parts[membres[0].id] = 100;
      return parts;
    }
    const part = arrondirPart(100 / membres.length);
    membres.forEach((m, i) => {
      parts[m.id] = i === membres.length - 1 ? arrondirPart(100 - part * (membres.length - 1)) : part;
    });
    return parts;
  }

  // ── Étape « répartition » ─────────────────────────────────────────────

  protected readonly somme = computed(() =>
    arrondirSommeRepartition(this.membres().reduce((s, m) => s + (this.parts()[m.id] ?? 0), 0)),
  );
  protected readonly sommeValide = computed(() => sommeRepartitionValide(this.somme()));

  /** Valeur du curseur pendant le glissement (avant validation du choix). */
  private readonly curseurEnCours = signal<number | null>(null);

  protected readonly partA = computed(() => this.curseurEnCours() ?? (this.parts()[this.membreA()?.id] ?? 0));
  protected readonly partB = computed(() => arrondirPart(100 - this.partA()));

  protected partDe(membreId: string): number {
    return this.parts()[membreId] ?? 0;
  }

  protected majPart(membreId: string, valeur: number | null): void {
    this.parts.update(p => ({ ...p, [membreId]: arrondirPart(valeur ?? 0) }));
    this.form.markAsDirty();
  }

  protected readonly presets = computed<OptionChoix<Preset>[]>(() => {
    const f = this.t.scenario.form;
    return [
      { value: 'TOUT_A', titre: f.toutMembre.replace('{{nom}}', this.membreA()?.nom ?? '') },
      { value: 'CINQUANTE', titre: f.cinquante },
      { value: 'TOUT_B', titre: f.toutMembre.replace('{{nom}}', this.membreB()?.nom ?? '') },
    ];
  });

  protected readonly presetActif = computed<Preset | null>(() => {
    const a = this.parts()[this.membreA()?.id] ?? 0;
    if (a === 100) return 'TOUT_A';
    if (a === 0) return 'TOUT_B';
    if (a === 50) return 'CINQUANTE';
    return null;
  });

  protected readonly curseurLabel = computed(() =>
    this.t.poste.form.curseurRepartition
      .replace('{{a}}', this.membreA()?.nom ?? '')
      .replace('{{b}}', this.membreB()?.nom ?? ''),
  );

  protected readonly curseurAria = computed(() =>
    this.t.poste.form.curseurValeur
      .replace('{{a}}', this.membreA()?.nom ?? '')
      .replace('{{partA}}', String(this.partA()))
      .replace('{{b}}', this.membreB()?.nom ?? '')
      .replace('{{partB}}', String(this.partB())),
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
    this.parts.set({ [this.membreA().id]: partA, [this.membreB().id]: arrondirPart(100 - partA) });
    this.form.markAsDirty();
  }

  protected couleur(m: MembreDto): string {
    return normaliserCouleur(m.couleur);
  }

  protected initiales(nom: string): string {
    return nom.trim().split(/\s+/).map(mot => mot[0]).slice(0, 2).join('').toUpperCase();
  }

  protected readonly erreurParts = computed<string | null>(() =>
    this.etapesTouchees().has('repartition') && !this.sommeValide()
      ? this.t.commun.repartitionInvalide
      : null,
  );

  // ── Fiche ─────────────────────────────────────────────────────────────

  protected readonly ficheTitre = computed(() =>
    this.formValue().nom?.trim() || this.t.poste.form.sansNom,
  );

  protected readonly lignesFiche = computed<LigneFiche[]>(() => {
    const f = this.t.scenario.form.fiche;
    const visitees = this.etapesVisitees();
    const v = this.formValue();
    const valeurs: Record<EtapeScenario, string | null> = {
      quoi: v.nom?.trim() || null,
      projection: this.t.scenario.form.resumeProjection
        .replace('{{annee}}', String(v.anneeDepart ?? ''))
        .replace('{{horizon}}', String(v.horizonAnnees ?? ''))
        .replace('{{tresorerie}}', this.montantPipe.transform(v.tresorerieInitiale ?? 0)),
      repartition: this.resumeParts(),
    };
    const libelles: Record<EtapeScenario, string> = {
      quoi: f.quoi, projection: f.projection, repartition: f.repartition,
    };
    return this.etapes().map(cle => {
      const valeur = visitees.has(cle) ? valeurs[cle] : null;
      const etat = this.etapeCourante() === cle ? 'courante' : valeur ? 'faite' : 'vide';
      return { cle, libelle: libelles[cle], valeur, etat } as LigneFiche;
    });
  });

  private resumeParts(): string | null {
    const membres = this.membres();
    if (!membres.length) return null;
    return membres.map(m => `${m.nom} ${Math.round(this.parts()[m.id] ?? 0)} %`).join(' · ');
  }

  // ── Navigation ────────────────────────────────────────────────────────

  protected etapeValide(cle: EtapeScenario): boolean {
    switch (cle) {
      case 'quoi':        return this.form.get('nom')!.valid;
      case 'projection':  return this.form.get('anneeDepart')!.valid && this.form.get('horizonAnnees')!.valid;
      case 'repartition': return this.sommeValide();
    }
  }

  protected allerA(cible: string): void {
    const etapes = this.etapes();
    const vers = etapes.indexOf(cible as EtapeScenario);
    if (vers < 0) return;
    const depuis = this.indexCourant();
    if (vers > depuis) {
      for (let i = depuis; i < vers; i++) {
        this.etapesTouchees.update(s => new Set(s).add(etapes[i]));
        if (etapes[i] === 'quoi') this.form.get('nom')!.markAsTouched();
        if (!this.etapeValide(etapes[i])) { this.positionner(etapes[i]); return; }
      }
    }
    this.positionner(etapes[vers]);
  }

  private positionner(cle: EtapeScenario): void {
    this.etapeCourante.set(cle);
    this.etapesVisitees.update(s => new Set(s).add(cle));
  }

  protected suivant(): void {
    const etapes = this.etapes();
    this.allerA(etapes[Math.min(this.indexCourant() + 1, etapes.length - 1)]);
  }

  protected precedent(): void {
    const etapes = this.etapes();
    this.positionner(etapes[Math.max(this.indexCourant() - 1, 0)]);
  }

  protected naviguerDepuisFiche(cle: string): void {
    if (this.etapesVisitees().has(cle as EtapeScenario)) this.positionner(cle as EtapeScenario);
    else this.allerA(cle);
  }

  protected fermer(): void {
    this.visibleChange.emit(false);
  }

  protected soumettre(): void {
    this.form.markAllAsTouched();
    for (const cle of this.etapes()) {
      this.etapesTouchees.update(s => new Set(s).add(cle));
      if (!this.etapeValide(cle)) { this.positionner(cle); return; }
    }
    const v = this.form.getRawValue();
    // En édition, la répartition n'est jamais envoyée : elle se gère via les
    // périodes de prorata dédiées.
    const repartitions = this.modeEdition()
      ? []
      : this.membres()
          .filter(m => (this.parts()[m.id] ?? 0) > 0)
          .map(m => ({ membreId: m.id, quotePart: Math.round((this.parts()[m.id] ?? 0) * 100) / 10000 }));
    this.enregistrer.emit({
      nom: v.nom!,
      anneeDepart: v.anneeDepart!,
      tresorerieInitiale: v.tresorerieInitiale ?? 0,
      horizonAnnees: v.horizonAnnees!,
      repartitions,
    });
  }
}
