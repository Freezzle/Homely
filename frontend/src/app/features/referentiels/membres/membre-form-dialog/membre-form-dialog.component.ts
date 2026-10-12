import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { MessageModule } from 'primeng/message';
import { MembreDto } from '../../../../core/models/api.models';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { normaliserCouleur } from '../../../../shared/utils/couleur.util';
import { ParcoursGuideComponent } from '../../../../shared/components/parcours-guide/parcours-guide.component';
import { EtapeParcours, LigneFiche } from '../../../../shared/components/parcours-guide/parcours-guide.model';
import { PaletteCouleursComponent } from '../../../../shared/components/palette-couleurs/palette-couleurs.component';
import { ColorInputComponent, InputTextComponent } from '../../../../shared/components/form-fields';

type EtapeMembre = 'quoi' | 'couleur';
const ETAPES: readonly EtapeMembre[] = ['quoi', 'couleur'];

/** Requête envoyée à l'API — identique au contrat existant de l'écran. */
export interface MembreFormRequest {
  nom: string;
  couleur: string;
}

/**
 * Création et édition d'un membre du foyer, en parcours guidé.
 * L'enregistrement reste à la charge de l'écran parent, qui tient la liste.
 */
@Component({
  selector: 'app-membre-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, MessageModule,
    ParcoursGuideComponent, PaletteCouleursComponent, InputTextComponent, ColorInputComponent,
  ],
  templateUrl: './membre-form-dialog.component.html',
  styleUrl: './membre-form-dialog.component.scss',
})
export class MembreFormDialogComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();
  private readonly fb = inject(FormBuilder);

  readonly visible = input<boolean>(false);
  readonly membre = input<MembreDto | null>(null);
  readonly enregistrementEnCours = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistrer = output<MembreFormRequest>();

  protected readonly modeEdition = computed(() => this.membre() !== null);

  readonly form = this.fb.group({
    nom:     ['', Validators.required],
    couleur: ['#64748b', Validators.required],
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.value)),
    { initialValue: this.form.value },
  );

  protected readonly etapeCourante = signal<EtapeMembre>('quoi');
  private readonly etapesVisitees = signal<Set<EtapeMembre>>(new Set<EtapeMembre>(['quoi']));

  protected readonly etapesParcours = computed<EtapeParcours[]>(() => {
    const e = this.t.referentiels.membre.form.etapes;
    return ETAPES.map(cle => ({ cle, titre: e[cle] }));
  });

  private readonly indexCourant = computed(() => Math.max(ETAPES.indexOf(this.etapeCourante()), 0));

  private readonly _initSurOuverture = effect(() => {
    const m = this.membre();
    const visible = this.visible();
    untracked(() => {
      if (!visible) return;
      this.form.reset({ nom: m?.nom ?? '', couleur: normaliserCouleur(m?.couleur) });
      this.etapeCourante.set('quoi');
      this.etapesVisitees.set(new Set<EtapeMembre>(m ? ETAPES : ['quoi']));
    });
  });

  // ── Couleur ───────────────────────────────────────────────────────────

  protected readonly couleur = computed(() => normaliserCouleur(this.formValue().couleur));

  protected choisirCouleur(hex: string | null): void {
    if (!hex) return;
    this.form.get('couleur')!.setValue(hex);
    this.form.get('couleur')!.markAsDirty();
  }

  // ── Fiche ─────────────────────────────────────────────────────────────

  protected readonly ficheTitre = computed(() =>
    this.formValue().nom?.trim() || this.t.poste.form.sansNom,
  );

  protected readonly lignesFiche = computed<LigneFiche[]>(() => {
    const f = this.t.referentiels.membre.form.fiche;
    const visitees = this.etapesVisitees();
    const valeurs: Record<EtapeMembre, string | null> = {
      quoi: this.formValue().nom?.trim() || null,
      couleur: this.couleur().toUpperCase(),
    };
    const libelles: Record<EtapeMembre, string> = { quoi: f.quoi, couleur: f.couleur };
    return ETAPES.map(cle => {
      const valeur = visitees.has(cle) ? valeurs[cle] : null;
      const etat = this.etapeCourante() === cle ? 'courante' : valeur ? 'faite' : 'vide';
      return { cle, libelle: libelles[cle], valeur, etat } as LigneFiche;
    });
  });

  // ── Navigation ────────────────────────────────────────────────────────

  protected etapeValide(cle: EtapeMembre): boolean {
    return cle === 'quoi' ? this.form.get('nom')!.valid : this.form.get('couleur')!.valid;
  }

  protected allerA(cible: string): void {
    const vers = ETAPES.indexOf(cible as EtapeMembre);
    if (vers < 0) return;
    const depuis = this.indexCourant();
    if (vers > depuis) {
      for (let i = depuis; i < vers; i++) {
        if (ETAPES[i] === 'quoi') this.form.get('nom')!.markAsTouched();
        if (!this.etapeValide(ETAPES[i])) { this.positionner(ETAPES[i]); return; }
      }
    }
    this.positionner(ETAPES[vers]);
  }

  private positionner(cle: EtapeMembre): void {
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
    if (this.etapesVisitees().has(cle as EtapeMembre)) this.positionner(cle as EtapeMembre);
    else this.allerA(cle);
  }

  protected fermer(): void {
    this.visibleChange.emit(false);
  }

  protected soumettre(): void {
    this.form.markAllAsTouched();
    for (const cle of ETAPES) {
      if (!this.etapeValide(cle)) { this.positionner(cle); return; }
    }
    const v = this.form.getRawValue();
    this.enregistrer.emit({ nom: v.nom!, couleur: v.couleur! });
  }
}
