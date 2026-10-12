import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { MessageModule } from 'primeng/message';
import { CategorieDto, TypeCategorie } from '../../../../core/models/api.models';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ParcoursGuideComponent } from '../../../../shared/components/parcours-guide/parcours-guide.component';
import { EtapeParcours, LigneFiche } from '../../../../shared/components/parcours-guide/parcours-guide.model';
import { ChoixCartesComponent } from '../../../../shared/components/choix-cartes/choix-cartes.component';
import { OptionChoix } from '../../../../shared/components/choix-cartes/option-choix.model';
import { InputTextComponent } from '../../../../shared/components/form-fields';

type EtapeCategorie = 'quoi' | 'type';
const ETAPES: readonly EtapeCategorie[] = ['quoi', 'type'];

/** Requête envoyée à l'API — identique au contrat existant de l'écran. */
export interface CategorieFormRequest {
  libelle: string;
  typePoste: TypeCategorie;
}

/**
 * Création et édition d'une catégorie, en parcours guidé.
 * L'enregistrement reste à la charge de l'écran parent, qui tient la liste.
 */
@Component({
  selector: 'app-categorie-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MessageModule, ParcoursGuideComponent, ChoixCartesComponent, InputTextComponent],
  templateUrl: './categorie-form-dialog.component.html',
})
export class CategorieFormDialogComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();
  private readonly fb = inject(FormBuilder);

  readonly visible = input<boolean>(false);
  readonly categorie = input<CategorieDto | null>(null);
  readonly enregistrementEnCours = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistrer = output<CategorieFormRequest>();

  protected readonly modeEdition = computed(() => this.categorie() !== null);

  readonly form = this.fb.group({
    libelle:   ['', Validators.required],
    typePoste: ['CHARGE' as TypeCategorie, Validators.required],
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.value)),
    { initialValue: this.form.value },
  );

  protected readonly etapeCourante = signal<EtapeCategorie>('quoi');
  private readonly etapesVisitees = signal<Set<EtapeCategorie>>(new Set<EtapeCategorie>(['quoi']));

  protected readonly etapesParcours = computed<EtapeParcours[]>(() => {
    const e = this.t.referentiels.categorie.form.etapes;
    return ETAPES.map(cle => ({ cle, titre: e[cle] }));
  });

  private readonly indexCourant = computed(() => Math.max(ETAPES.indexOf(this.etapeCourante()), 0));

  private readonly _initSurOuverture = effect(() => {
    const c = this.categorie();
    const visible = this.visible();
    untracked(() => {
      if (!visible) return;
      this.form.reset({ libelle: c?.libelle ?? '', typePoste: c?.typePoste ?? 'CHARGE' });
      this.etapeCourante.set('quoi');
      this.etapesVisitees.set(new Set<EtapeCategorie>(c ? ETAPES : ['quoi']));
    });
  });

  // ── Type de poste ─────────────────────────────────────────────────────

  protected readonly optionsType = computed<OptionChoix<TypeCategorie>[]>(() => {
    const libelles = this.t.referentiels.categorie.typeOptions;
    const aides = this.t.referentiels.categorie.form.typeAide;
    return (['REVENU', 'CHARGE', 'RESERVE'] as TypeCategorie[]).map(v => ({
      value: v, titre: libelles[v], sousTitre: aides[v],
    }));
  });

  protected choisirType(type: TypeCategorie | null): void {
    if (!type) return;
    this.form.get('typePoste')!.setValue(type);
    this.form.get('typePoste')!.markAsDirty();
  }

  // ── Fiche ─────────────────────────────────────────────────────────────

  protected readonly ficheTitre = computed(() =>
    this.formValue().libelle?.trim() || this.t.poste.form.sansNom,
  );

  protected readonly lignesFiche = computed<LigneFiche[]>(() => {
    const f = this.t.referentiels.categorie.form.fiche;
    const visitees = this.etapesVisitees();
    const type = this.formValue().typePoste;
    const valeurs: Record<EtapeCategorie, string | null> = {
      quoi: this.formValue().libelle?.trim() || null,
      type: type ? this.t.referentiels.categorie.typeOptions[type] : null,
    };
    const libelles: Record<EtapeCategorie, string> = { quoi: f.quoi, type: f.type };
    return ETAPES.map(cle => {
      const valeur = visitees.has(cle) ? valeurs[cle] : null;
      const etat = this.etapeCourante() === cle ? 'courante' : valeur ? 'faite' : 'vide';
      return { cle, libelle: libelles[cle], valeur, etat } as LigneFiche;
    });
  });

  // ── Navigation ────────────────────────────────────────────────────────

  protected etapeValide(cle: EtapeCategorie): boolean {
    return cle === 'quoi' ? this.form.get('libelle')!.valid : this.form.get('typePoste')!.valid;
  }

  protected allerA(cible: string): void {
    const vers = ETAPES.indexOf(cible as EtapeCategorie);
    if (vers < 0) return;
    const depuis = this.indexCourant();
    if (vers > depuis) {
      for (let i = depuis; i < vers; i++) {
        if (ETAPES[i] === 'quoi') this.form.get('libelle')!.markAsTouched();
        if (!this.etapeValide(ETAPES[i])) { this.positionner(ETAPES[i]); return; }
      }
    }
    this.positionner(ETAPES[vers]);
  }

  private positionner(cle: EtapeCategorie): void {
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
    if (this.etapesVisitees().has(cle as EtapeCategorie)) this.positionner(cle as EtapeCategorie);
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
    this.enregistrer.emit({ libelle: v.libelle!, typePoste: v.typePoste! });
  }
}
