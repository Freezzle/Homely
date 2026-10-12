import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CompteDto, MembreDto, TypePoste, TypeRepartition } from '../../../../../core/models/api.models';
import { I18nService } from '../../../../../core/i18n/i18n.service';
import { MontantPipe } from '../../../../../core/pipes/format.pipes';
import { arrondirSommeRepartition, sommeRepartitionValide } from '../../../../../core/utils/repartition.util';
import { normaliserCouleur } from '../../../../../shared/utils/couleur.util';
import { ChoixCartesComponent } from '../../../../../shared/components/choix-cartes/choix-cartes.component';
import { ChoixPucesComponent } from '../../../../../shared/components/choix-puces/choix-puces.component';
import { OptionChoix } from '../../../../../shared/components/choix-cartes/option-choix.model';
import { InputNumberComponent } from '../../../../../shared/components/form-fields';
import { RepartitionSaisie } from './repartition-saisie.model';
import { arrondirPart, calculerParts } from './repartition.util';

type Preset = 'TOUT_A' | 'PRORATA' | 'CINQUANTE' | 'INVERSE' | 'TOUT_B';

/**
 * Saisie de la répartition d'un poste : qui porte quelle part, et depuis quel
 * compte. Trois rendus selon la taille du foyer (1 membre, 2 membres avec
 * curseur, 3 membres et plus). Ne fait aucun appel réseau : le conteneur
 * fournit les membres, les comptes et les quotes-parts du scénario.
 */
@Component({
  selector: 'app-poste-repartition',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChoixCartesComponent, ChoixPucesComponent, InputNumberComponent, MontantPipe, FormsModule],
  templateUrl: './poste-repartition.component.html',
  styleUrl: './poste-repartition.component.scss',
})
export class PosteRepartitionComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.translations();

  readonly membres = input.required<readonly MembreDto[]>();
  readonly comptes = input.required<readonly CompteDto[]>();
  /** membreId → quote-part du scénario (0–1). */
  readonly partsAuto = input.required<Readonly<Record<string, number>>>();
  readonly montant = input<number>(0);
  readonly devise = input<string>('');
  readonly type = input<TypePoste>('CHARGE');

  readonly valeur = model.required<RepartitionSaisie>();

  /** Valeur du curseur pendant le glissement (avant validation du choix). */
  private readonly curseurEnCours = signal<number | null>(null);

  protected readonly monoMembre = computed(() => this.membres().length <= 1);
  protected readonly deuxMembres = computed(() => this.membres().length === 2);
  protected readonly plusieursMembres = computed(() => this.membres().length > 2);

  protected readonly membreA = computed(() => this.membres()[0]);
  protected readonly membreB = computed(() => this.membres()[1]);

  // ── Cas à deux membres ────────────────────────────────────────────────

  /** Part du premier membre selon le scénario (0–100). */
  protected readonly partProrataA = computed(() => arrondirPart((this.partsAuto()[this.membreA()?.id] ?? 0.5) * 100));
  /** Part du premier membre en répartition inversée : le complément, pour un foyer à deux. */
  protected readonly partInverseA = computed(() => arrondirPart(100 - this.partProrataA()));

  protected readonly partA = computed(() => {
    const enCours = this.curseurEnCours();
    if (enCours !== null) return enCours;
    return arrondirPart(this.valeur().parts[this.membreA()?.id] ?? 0);
  });
  protected readonly partB = computed(() => arrondirPart(100 - this.partA()));

  protected readonly montantA = computed(() => (this.montant() * this.partA()) / 100);
  protected readonly montantB = computed(() => (this.montant() * this.partB()) / 100);

  protected readonly presetActif = computed<Preset | null>(() => {
    const v = this.valeur();
    const part = arrondirPart(v.parts[this.membreA()?.id] ?? 0);
    if (v.typeRepartition === 'AUTO') return 'PRORATA';
    if (v.typeRepartition === 'REVERSE_AUTO') return 'INVERSE';
    if (part === 100) return 'TOUT_A';
    if (part === 0) return 'TOUT_B';
    if (part === 50) return 'CINQUANTE';
    return null;
  });

  protected readonly presets = computed<OptionChoix<Preset>[]>(() => {
    const f = this.t.poste.form;
    return [
      { value: 'TOUT_A', titre: f.toutMembre.replace('{{nom}}', this.membreA()?.nom ?? '') },
      { value: 'PRORATA', titre: f.auProrata },
      { value: 'CINQUANTE', titre: f.cinquante },
      { value: 'INVERSE', titre: f.inverse },
      { value: 'TOUT_B', titre: f.toutMembre.replace('{{nom}}', this.membreB()?.nom ?? '') },
    ];
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

  /**
   * Fin de glissement : la valeur décide du type de répartition. Une valeur qui
   * tombe pile sur la part du scénario vaut AUTO (le prorata est prioritaire sur
   * une part fixe identique), son complément vaut REVERSE_AUTO.
   */
  protected onCurseurChange(event: Event): void {
    const v = arrondirPart(Number((event.target as HTMLInputElement).value));
    this.curseurEnCours.set(null);
    const type: TypeRepartition =
      v === this.partProrataA() ? 'AUTO' : v === this.partInverseA() ? 'REVERSE_AUTO' : 'CUSTOM';
    this.appliquerDeuxMembres(v, type);
  }

  protected appliquerPreset(preset: Preset | null): void {
    if (!preset) return;
    switch (preset) {
      case 'TOUT_A':     return this.appliquerDeuxMembres(100, 'CUSTOM');
      case 'TOUT_B':     return this.appliquerDeuxMembres(0, 'CUSTOM');
      case 'CINQUANTE':  return this.appliquerDeuxMembres(50, 'CUSTOM');
      case 'PRORATA':    return this.appliquerDeuxMembres(this.partProrataA(), 'AUTO');
      case 'INVERSE':    return this.appliquerDeuxMembres(this.partInverseA(), 'REVERSE_AUTO');
    }
  }

  private appliquerDeuxMembres(partA: number, typeRepartition: TypeRepartition): void {
    const a = this.membreA().id;
    const b = this.membreB().id;
    const partB = arrondirPart(100 - partA);
    // 100 / 0 : un seul membre porte le poste, l'autre sort de la répartition.
    const selection = partA === 100 ? [a] : partA === 0 ? [b] : [a, b];
    this.majValeur({
      typeRepartition,
      selection,
      parts: { [a]: partA, [b]: partB },
      comptes: this.comptesNettoyes(selection),
    });
  }

  // ── Cas à trois membres ou plus ───────────────────────────────────────

  protected readonly typeOptions = computed<OptionChoix<TypeRepartition>[]>(() => {
    const o = this.t.poste.typeRepartitionOptions;
    return [
      { value: 'AUTO', titre: o.AUTO, sousTitre: this.apercuParts('AUTO') },
      { value: 'REVERSE_AUTO', titre: o.REVERSE_AUTO, sousTitre: this.apercuParts('REVERSE_AUTO') },
      { value: 'CUSTOM', titre: o.CUSTOM, sousTitre: this.apercuParts('CUSTOM') },
    ];
  });

  protected readonly membresSelectionnes = computed(() =>
    this.membres().filter(m => this.valeur().selection.includes(m.id)),
  );

  protected readonly somme = computed(() =>
    arrondirSommeRepartition(this.membresSelectionnes().reduce((s, m) => s + (this.valeur().parts[m.id] ?? 0), 0)),
  );

  protected readonly sommeValide = computed(() => sommeRepartitionValide(this.somme()));

  protected estSelectionne(membreId: string): boolean {
    return this.valeur().selection.includes(membreId);
  }

  protected basculerMembre(membreId: string): void {
    const courante = this.valeur().selection;
    if (courante.includes(membreId) && courante.length === 1) return;
    const selection = courante.includes(membreId)
      ? courante.filter(id => id !== membreId)
      : this.membres().filter(m => m.id === membreId || courante.includes(m.id)).map(m => m.id);
    this.majValeur({
      selection,
      parts: this.partsCalculees(selection, this.valeur().typeRepartition),
      comptes: this.comptesNettoyes(selection),
    });
  }

  protected choisirType(type: TypeRepartition | null): void {
    if (!type) return;
    this.majValeur({
      typeRepartition: type,
      parts: this.partsCalculees(this.valeur().selection, type),
    });
  }

  protected majPart(membreId: string, part: number | null): void {
    this.majValeur({ parts: { ...this.valeur().parts, [membreId]: arrondirPart(part ?? 0) } });
  }

  /**
   * Quotes-parts dérivées de la sélection et du type — délégué à la fonction pure
   * partagée avec le conteneur (`repartition.util.ts`).
   */
  private partsCalculees(selection: readonly string[], type: TypeRepartition): Record<string, number> {
    return calculerParts(this.membres(), selection, type, this.partsAuto());
  }

  /** Aperçu « Dylan 500,00 CHF · Camille 300,00 CHF » pour un type donné. */
  private apercuParts(type: TypeRepartition): string {
    const parts = this.partsCalculees(this.valeur().selection, type);
    return this.membresSelectionnes()
      .map(m => `${m.nom} ${Math.round(parts[m.id] ?? 0)} %`)
      .join(' · ');
  }

  // ── Comptes ───────────────────────────────────────────────────────────

  /** Membres qui portent effectivement une part : seuls eux ont besoin d'un compte. */
  protected readonly membresAvecPart = computed(() =>
    this.membres().filter(m => this.valeur().selection.includes(m.id) && (this.valeur().parts[m.id] ?? 0) > 0),
  );

  /** Comptes accessibles à tous les membres porteurs d'une part. */
  protected readonly comptesCommuns = computed(() => {
    const ids = this.membresAvecPart().map(m => m.id);
    if (!ids.length) return [];
    return this.comptes().filter(c => ids.every(id => c.membreIds?.includes(id)));
  });

  protected readonly compteUnique = computed(() => {
    const ids = this.membresAvecPart().map(m => m.id);
    const valeurs = new Set(ids.map(id => this.valeur().comptes[id] ?? null));
    return valeurs.size === 1 ? [...valeurs][0] : null;
  });

  /** Vrai quand un seul groupe « Payé depuis » suffit (comptes communs disponibles). */
  protected readonly compteCommunPossible = computed(() =>
    this.comptesCommuns().length > 0 && this.membresAvecPart().length > 1,
  );

  protected readonly libelleDepuis = computed(() => this.t.poste.form.depuis[this.type()]);

  /**
   * Cartes de comptes : chaque compte porte les pastilles des membres qui y sont
   * rattachés (plus leurs noms en sous-titre), pour distinguer d'un coup d'œil un
   * compte personnel d'un compte partagé.
   */
  protected optionsComptes(membreId?: string): OptionChoix<string>[] {
    const liste = membreId
      ? this.comptes().filter(c => c.membreIds?.includes(membreId))
      : this.comptesCommuns();
    return liste.map(c => {
      const rattaches = this.membres().filter(m => c.membreIds?.includes(m.id));
      return {
        value: c.id,
        titre: c.libelle,
        sousTitre: rattaches.map(m => m.nom).join(' · ') || undefined,
        pastilles: rattaches.map(m => ({ couleur: this.couleur(m), libelle: m.nom })),
      };
    });
  }

  protected libelleDepuisMembre(nom: string): string {
    return this.t.poste.form.depuisMembre
      .replace('{{libelle}}', this.libelleDepuis())
      .replace('{{nom}}', nom);
  }

  protected compteDe(membreId: string): string | null {
    return this.valeur().comptes[membreId] ?? null;
  }

  protected choisirCompte(membreId: string, compteId: string | null): void {
    this.majValeur({ comptes: { ...this.valeur().comptes, [membreId]: compteId } });
  }

  protected choisirCompteCommun(compteId: string | null): void {
    const comptes = { ...this.valeur().comptes };
    for (const m of this.membresAvecPart()) comptes[m.id] = compteId;
    this.majValeur({ comptes });
  }

  protected basculerComptesSepares(separes: boolean): void {
    this.majValeur({ comptesSepares: separes });
  }

  /** Un membre hors répartition ne garde pas de compte de ventilation. */
  private comptesNettoyes(selection: readonly string[]): Record<string, string | null> {
    const comptes: Record<string, string | null> = { ...this.valeur().comptes };
    for (const m of this.membres()) {
      if (!selection.includes(m.id)) comptes[m.id] = null;
      else if (!comptes[m.id]) comptes[m.id] = this.compteParDefaut(m.id);
    }
    return comptes;
  }

  private compteParDefaut(membreId: string): string | null {
    const accessibles = this.comptes().filter(c => c.membreIds?.includes(membreId));
    return accessibles[0]?.id ?? this.comptes()[0]?.id ?? null;
  }

  private majValeur(patch: Partial<RepartitionSaisie>): void {
    this.valeur.set({ ...this.valeur(), ...patch });
  }

  protected couleur(membre: MembreDto): string {
    return normaliserCouleur(membre.couleur);
  }

  protected initiales(nom: string): string {
    return nom.trim().split(/\s+/).map(mot => mot[0]).slice(0, 2).join('').toUpperCase();
  }
}
