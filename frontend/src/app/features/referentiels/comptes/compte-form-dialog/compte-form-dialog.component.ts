import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { MessageModule } from 'primeng/message';
import { CompteDto, MembreDto } from '../../../../core/models/api.models';
import { ContexteService } from '../../../../core/services/contexte.service';
import { TauxChangeService } from '../../../../core/services/referentiel.service';
import { creerDevisesDisponibles } from '../../../../core/utils/devise-options.util';
import { MontantPipe } from '../../../../core/pipes/format.pipes';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { normaliserCouleur } from '../../../../shared/utils/couleur.util';
import { ParcoursGuideComponent } from '../../../../shared/components/parcours-guide/parcours-guide.component';
import { EtapeParcours, LigneFiche } from '../../../../shared/components/parcours-guide/parcours-guide.model';
import { InputNumberComponent, InputTextComponent, SelectComponent } from '../../../../shared/components/form-fields';

type EtapeCompte = 'quoi' | 'membres' | 'argent';
const ETAPES: readonly EtapeCompte[] = ['quoi', 'membres', 'argent'];

/** Requête envoyée à l'API — identique au contrat existant de l'écran. */
export interface CompteFormRequest {
  libelle: string;
  membreIds: string[];
  soldeInitial: number;
  devise?: string;
}

/**
 * Création et édition d'un compte bancaire, en parcours guidé.
 * L'enregistrement reste à la charge de l'écran parent, qui tient la liste.
 */
@Component({
  selector: 'app-compte-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, MessageModule, ParcoursGuideComponent,
    InputTextComponent, InputNumberComponent, SelectComponent,
  ],
  templateUrl: './compte-form-dialog.component.html',
  styleUrl: './compte-form-dialog.component.scss',
})
export class CompteFormDialogComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();
  private readonly fb = inject(FormBuilder);
  private readonly contexte = inject(ContexteService);
  private readonly tauxChangeSvc = inject(TauxChangeService);
  private readonly montantPipe = inject(MontantPipe);

  readonly visible = input<boolean>(false);
  readonly compte = input<CompteDto | null>(null);
  readonly membres = input.required<readonly MembreDto[]>();
  readonly enregistrementEnCours = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistrer = output<CompteFormRequest>();

  protected readonly modeEdition = computed(() => this.compte() !== null);

  readonly form = this.fb.group({
    libelle:      ['', Validators.required],
    membreIds:    [[] as string[], Validators.required],
    soldeInitial: [0],
    devise:       [this.contexte.deviseBase()],
  });

  protected readonly devises = creerDevisesDisponibles(this.contexte, this.tauxChangeSvc, this.form.get('devise'));

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.value)),
    { initialValue: this.form.value },
  );

  protected readonly etapeCourante = signal<EtapeCompte>('quoi');
  private readonly etapesVisitees = signal<Set<EtapeCompte>>(new Set<EtapeCompte>(['quoi']));
  private readonly etapesTouchees = signal<Set<EtapeCompte>>(new Set<EtapeCompte>());

  protected readonly etapesParcours = computed<EtapeParcours[]>(() => {
    const e = this.t.referentiels.compte.form.etapes;
    return ETAPES.map(cle => ({ cle, titre: e[cle] }));
  });

  private readonly indexCourant = computed(() => Math.max(ETAPES.indexOf(this.etapeCourante()), 0));
  protected readonly peutAllerFin = computed(() =>
    this.etapesVisitees().has('argent') && this.etapeCourante() !== 'argent',
  );

  private readonly _initSurOuverture = effect(() => {
    const c = this.compte();
    const visible = this.visible();
    untracked(() => {
      if (!visible) return;
      if (c) {
        // Seuls les membres actifs sont éditables ici ; les membres inactifs
        // rattachés au compte sont préservés côté serveur.
        const membreIdsActifs = c.membreIds.filter(id => this.membres().some(m => m.id === id));
        this.form.reset({
          libelle: c.libelle, membreIds: membreIdsActifs,
          soldeInitial: c.soldeInitial, devise: c.devise,
        });
        this.etapesVisitees.set(new Set<EtapeCompte>(ETAPES));
      } else {
        // À la création, tous les membres actifs sont rattachés par défaut.
        this.form.reset({
          libelle: '', membreIds: this.membres().map(m => m.id),
          soldeInitial: 0, devise: this.contexte.deviseBase(),
        });
        this.etapesVisitees.set(new Set<EtapeCompte>(['quoi']));
      }
      this.etapeCourante.set('quoi');
      this.etapesTouchees.set(new Set<EtapeCompte>());
    });
  });

  // ── Étape « membres » ─────────────────────────────────────────────────

  protected readonly membreIds = computed<string[]>(() => this.formValue().membreIds ?? []);

  protected estRattache(id: string): boolean {
    return this.membreIds().includes(id);
  }

  protected basculerMembre(id: string): void {
    const courants = this.membreIds();
    const suivants = courants.includes(id)
      ? courants.filter(x => x !== id)
      : this.membres().filter(m => m.id === id || courants.includes(m.id)).map(m => m.id);
    this.form.get('membreIds')!.setValue(suivants);
    this.form.get('membreIds')!.markAsDirty();
  }

  protected couleur(m: MembreDto): string {
    return normaliserCouleur(m.couleur);
  }

  protected initiales(nom: string): string {
    return nom.trim().split(/\s+/).map(mot => mot[0]).slice(0, 2).join('').toUpperCase();
  }

  protected readonly erreurMembres = computed<string | null>(() =>
    this.etapesTouchees().has('membres') && !this.membreIds().length
      ? this.t.referentiels.compte.membresRequis
      : null,
  );

  // ── Fiche ─────────────────────────────────────────────────────────────

  protected readonly ficheTitre = computed(() =>
    this.formValue().libelle?.trim() || this.t.poste.form.sansNom,
  );

  protected readonly lignesFiche = computed<LigneFiche[]>(() => {
    const f = this.t.referentiels.compte.form.fiche;
    const visitees = this.etapesVisitees();
    const v = this.formValue();
    const noms = this.membres().filter(m => this.membreIds().includes(m.id)).map(m => m.nom);
    const valeurs: Record<EtapeCompte, string | null> = {
      quoi: v.libelle?.trim() || null,
      membres: noms.length ? noms.join(' · ') : null,
      argent: this.t.referentiels.compte.form.resumeArgent
        .replace('{{solde}}', this.montantPipe.transform(v.soldeInitial ?? 0, v.devise ?? undefined))
        .replace('{{devise}}', v.devise ?? ''),
    };
    const libelles: Record<EtapeCompte, string> = { quoi: f.quoi, membres: f.membres, argent: f.argent };
    return ETAPES.map(cle => {
      const valeur = visitees.has(cle) ? valeurs[cle] : null;
      const etat = this.etapeCourante() === cle ? 'courante' : valeur ? 'faite' : 'vide';
      return { cle, libelle: libelles[cle], valeur, etat } as LigneFiche;
    });
  });

  protected readonly impactPrincipal = computed(() =>
    this.etapesVisitees().has('argent')
      ? this.montantPipe.transform(this.formValue().soldeInitial ?? 0, this.formValue().devise ?? undefined)
      : '…',
  );

  protected readonly impactSecondaire = computed(() =>
    this.etapesVisitees().has('argent') ? this.t.referentiels.compte.soldeInitial : '',
  );

  // ── Navigation ────────────────────────────────────────────────────────

  protected etapeValide(cle: EtapeCompte): boolean {
    switch (cle) {
      case 'quoi':    return this.form.get('libelle')!.valid;
      case 'membres': return this.membreIds().length > 0;
      case 'argent':  return true;
    }
  }

  protected allerA(cible: string): void {
    const vers = ETAPES.indexOf(cible as EtapeCompte);
    if (vers < 0) return;
    const depuis = this.indexCourant();
    if (vers > depuis) {
      for (let i = depuis; i < vers; i++) {
        this.etapesTouchees.update(s => new Set(s).add(ETAPES[i]));
        if (ETAPES[i] === 'quoi') this.form.get('libelle')!.markAsTouched();
        if (!this.etapeValide(ETAPES[i])) { this.positionner(ETAPES[i]); return; }
      }
    }
    this.positionner(ETAPES[vers]);
  }

  private positionner(cle: EtapeCompte): void {
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
    this.allerA('argent');
  }

  protected naviguerDepuisFiche(cle: string): void {
    if (this.etapesVisitees().has(cle as EtapeCompte)) this.positionner(cle as EtapeCompte);
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
      libelle: v.libelle!,
      membreIds: v.membreIds as string[],
      soldeInitial: v.soldeInitial ?? 0,
      devise: v.devise ?? undefined,
    });
  }
}
