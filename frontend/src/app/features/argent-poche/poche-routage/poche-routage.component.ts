import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompteDto, MembreDto } from '../../../core/models/api.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ChoixCartesComponent } from '../../../shared/components/choix-cartes/choix-cartes.component';
import { OptionChoix } from '../../../shared/components/choix-cartes/option-choix.model';
import { InputNumberComponent, SelectComponent } from '../../../shared/components/form-fields';
import { optionsComptes } from '../argent-poche-options.util';
import {
  LignePocheSaisie, lignePocheUnique, routagePocheValide, sommePoche,
} from './poche-routage.model';

/**
 * Saisie du routage d'un versement d'argent de poche : depuis quel **compte pivot**
 * l'argent part, et sur quel(s) **compte(s) de poche** il atterrit.
 *
 * <p>Deux modes de saisie, un seul stockage canonique (la liste de lignes) :
 * <b>simple</b> = un unique compte crédité à 100 %, <b>avancé</b> = N comptes avec
 * un pourcentage chacun (total 100 %).</p>
 *
 * <p>Pivot == unique contrepartie ⇒ auto-routage : aucun virement n'est simulé,
 * la dépense reste sur ce compte (cas le plus courant).</p>
 */
@Component({
  selector: 'app-poche-routage',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChoixCartesComponent, InputNumberComponent, SelectComponent, FormsModule],
  templateUrl: './poche-routage.component.html',
  styleUrl: './poche-routage.component.scss',
})
export class PocheRoutageComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly comptes = input.required<readonly CompteDto[]>();
  readonly membres = input.required<readonly MembreDto[]>();
  /** Membre bénéficiaire : restreint les comptes crédités proposés. */
  readonly membreId = input<string | null>(null);

  readonly comptePivotId = model<string | null>(null);
  readonly lignes = model<LignePocheSaisie[]>(lignePocheUnique(null));

  private readonly _avance = signal(false);

  /** Le mode avancé s'impose dès que plusieurs comptes sont crédités. */
  protected readonly avanceImpose = computed(() => this.lignes().length > 1);
  protected readonly modeAvance = computed(() => this._avance() || this.avanceImpose());

  protected readonly optionsPivot = computed<OptionChoix<string>[]>(() =>
    optionsComptes(this.comptes(), this.membres()),
  );

  /** Comptes crédités : ceux du membre bénéficiaire, à défaut tous ceux du foyer. */
  protected readonly optionsCredit = computed<OptionChoix<string>[]>(() => {
    const options = optionsComptes(this.comptes(), this.membres(), this.membreId());
    return options.length ? options : optionsComptes(this.comptes(), this.membres());
  });

  protected readonly optionsSelect = computed<{ label: string; value: string }[]>(() =>
    this.optionsCredit().map(o => ({ label: o.titre, value: o.value })),
  );

  protected readonly compteSimple = computed<string | null>(() => {
    const lignes = this.lignes();
    return lignes.length === 1 ? lignes[0].compteId : null;
  });

  protected readonly total = computed(() => sommePoche(this.lignes()));
  protected readonly valide = computed(() => routagePocheValide(this.lignes()));

  protected choisirPivot(id: string | null): void {
    this.comptePivotId.set(id);
  }

  protected choisirCompteSimple(id: string | null): void {
    this.lignes.set(lignePocheUnique(id));
  }

  protected majLigneCompte(index: number, compteId: string | null): void {
    this.lignes.update(l => l.map((ligne, i) => (i === index ? { ...ligne, compteId } : ligne)));
  }

  protected majLignePart(index: number, part: number | null): void {
    this.lignes.update(l => l.map((ligne, i) => (i === index ? { ...ligne, part: part ?? 0 } : ligne)));
  }

  protected ajouterLigne(): void {
    const lignes = this.lignes();
    const utilises = new Set(lignes.map(l => l.compteId));
    const libre = this.optionsSelect().find(o => !utilises.has(o.value));
    const partEgale = Math.round((100 / (lignes.length + 1)) * 100) / 100;
    // La dernière ligne absorbe le reliquat d'arrondi pour garder un total de 100 %.
    const reste = Math.round((100 - partEgale * lignes.length) * 100) / 100;
    this.lignes.set([
      ...lignes.map(l => ({ ...l, part: partEgale })),
      { compteId: libre?.value ?? null, part: reste },
    ]);
  }

  protected retirerLigne(index: number): void {
    const restantes = this.lignes().filter((_, i) => i !== index);
    this.lignes.set(restantes.length ? restantes : lignePocheUnique(null));
  }

  /**
   * Repli sur le mode simple : seul le premier compte est conservé, à 100 %.
   * Le bouton n'est proposé que si le routage tient réellement sur une ligne.
   */
  protected basculerAvance(actif: boolean): void {
    if (!actif) this.lignes.set(lignePocheUnique(this.lignes()[0]?.compteId ?? null));
    this._avance.set(actif);
  }
}
