import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith } from 'rxjs';
import { MessageModule } from 'primeng/message';
import { TauxChangeDto } from '../../../../core/models/api.models';
import { ContexteService } from '../../../../core/services/contexte.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ParcoursGuideComponent } from '../../../../shared/components/parcours-guide/parcours-guide.component';
import { EtapeParcours, LigneFiche } from '../../../../shared/components/parcours-guide/parcours-guide.model';
import { InputNumberComponent, InputTextComponent } from '../../../../shared/components/form-fields';

type EtapeTaux = 'devise' | 'taux';
const ETAPES: readonly EtapeTaux[] = ['devise', 'taux'];

/** Requête envoyée à l'API — identique au contrat existant de l'écran. */
export interface TauxChangeFormRequest {
  devise: string;
  tauxVersBase: number;
}

/**
 * Création et édition d'un taux de change, en parcours guidé.
 * L'enregistrement reste à la charge de l'écran parent, qui tient la liste.
 */
@Component({
  selector: 'app-taux-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MessageModule, ParcoursGuideComponent, InputTextComponent, InputNumberComponent],
  templateUrl: './taux-form-dialog.component.html',
})
export class TauxFormDialogComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();
  private readonly fb = inject(FormBuilder);
  private readonly contexte = inject(ContexteService);

  readonly visible = input<boolean>(false);
  readonly taux = input<TauxChangeDto | null>(null);
  readonly enregistrementEnCours = input<boolean>(false);

  readonly visibleChange = output<boolean>();
  readonly enregistrer = output<TauxChangeFormRequest>();

  protected readonly modeEdition = computed(() => this.taux() !== null);

  readonly form = this.fb.group({
    devise:       ['', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    tauxVersBase: [1, [Validators.required, Validators.min(0.000001)]],
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.value)),
    { initialValue: this.form.value },
  );

  protected readonly etapeCourante = signal<EtapeTaux>('devise');
  private readonly etapesVisitees = signal<Set<EtapeTaux>>(new Set<EtapeTaux>(['devise']));

  protected readonly etapesParcours = computed<EtapeParcours[]>(() => {
    const e = this.t.referentiels.taux.form.etapes;
    return ETAPES.map(cle => ({ cle, titre: e[cle] }));
  });

  private readonly indexCourant = computed(() => Math.max(ETAPES.indexOf(this.etapeCourante()), 0));

  private readonly _initSurOuverture = effect(() => {
    const tx = this.taux();
    const visible = this.visible();
    untracked(() => {
      if (!visible) return;
      this.form.reset({ devise: tx?.devise ?? '', tauxVersBase: tx?.tauxVersBase ?? 1 });
      this.appliquerVerrouTauxBase(tx?.devise ?? '');
      this.etapeCourante.set('devise');
      this.etapesVisitees.set(new Set<EtapeTaux>(tx ? ETAPES : ['devise']));
    });
  });

  /**
   * Le taux de la devise de base vers elle-même vaut toujours 1 par définition
   * (docs/01 §7) : on verrouille le champ dès que la devise saisie correspond.
   */
  private readonly _verrouSurDevise = effect(() => {
    const devise = this.formValue().devise ?? '';
    untracked(() => this.appliquerVerrouTauxBase(devise));
  });

  private appliquerVerrouTauxBase(devise: string | null | undefined): void {
    const ctrl = this.form.get('tauxVersBase')!;
    if ((devise ?? '').trim().toUpperCase() === this.contexte.deviseBase()) {
      ctrl.setValue(1, { emitEvent: false });
      ctrl.disable({ emitEvent: false });
    } else if (ctrl.disabled) {
      ctrl.enable({ emitEvent: false });
    }
  }

  protected readonly estDeviseBase = computed(() =>
    (this.formValue().devise ?? '').trim().toUpperCase() === this.contexte.deviseBase(),
  );

  protected readonly aideEgalite = computed(() =>
    this.i18n.instant('referentiels.taux.egaliteTauxVersBase', {
      devise: (this.formValue().devise || '?').toUpperCase(),
      deviseBase: this.contexte.deviseBase(),
    }),
  );

  // ── Fiche ─────────────────────────────────────────────────────────────

  protected readonly ficheTitre = computed(() =>
    (this.formValue().devise || '').toUpperCase() || this.t.referentiels.taux.devise,
  );

  protected readonly lignesFiche = computed<LigneFiche[]>(() => {
    const f = this.t.referentiels.taux.form.fiche;
    const visitees = this.etapesVisitees();
    const v = this.form.getRawValue();
    const valeurs: Record<EtapeTaux, string | null> = {
      devise: v.devise ? v.devise.toUpperCase() : null,
      taux: v.tauxVersBase == null ? null : String(v.tauxVersBase),
    };
    const libelles: Record<EtapeTaux, string> = { devise: f.devise, taux: f.taux };
    return ETAPES.map(cle => {
      const valeur = visitees.has(cle) ? valeurs[cle] : null;
      const etat = this.etapeCourante() === cle ? 'courante' : valeur ? 'faite' : 'vide';
      return { cle, libelle: libelles[cle], valeur, etat } as LigneFiche;
    });
  });

  // ── Navigation ────────────────────────────────────────────────────────

  protected etapeValide(cle: EtapeTaux): boolean {
    return cle === 'devise' ? this.form.get('devise')!.valid : this.form.get('tauxVersBase')!.valid;
  }

  protected allerA(cible: string): void {
    const vers = ETAPES.indexOf(cible as EtapeTaux);
    if (vers < 0) return;
    const depuis = this.indexCourant();
    if (vers > depuis) {
      for (let i = depuis; i < vers; i++) {
        if (ETAPES[i] === 'devise') this.form.get('devise')!.markAsTouched();
        if (!this.etapeValide(ETAPES[i])) { this.positionner(ETAPES[i]); return; }
      }
    }
    this.positionner(ETAPES[vers]);
  }

  private positionner(cle: EtapeTaux): void {
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
    if (this.etapesVisitees().has(cle as EtapeTaux)) this.positionner(cle as EtapeTaux);
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
    const devise = v.devise!.toUpperCase();
    // Garde-fou : le taux de la devise de base vers elle-même est toujours 1,
    // même si le contrôle a été réactivé par un patch programmatique.
    const tauxVersBase = devise === this.contexte.deviseBase() ? 1 : v.tauxVersBase!;
    this.enregistrer.emit({ devise, tauxVersBase });
  }
}
