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
import { InputNumberComponent, SelectComponent } from '../../../../../shared/components/form-fields';
import { LigneRoutage, RepartitionSaisie } from './repartition-saisie.model';
import { arrondirPart, calculerParts } from './repartition.util';
import { ligneUnique, routageMembreValide, routageMultiComptes, sommeRoutage } from './routage.util';

type Preset = 'TOUT_A' | 'PRORATA' | 'CINQUANTE' | 'INVERSE' | 'TOUT_B';

/**
 * Saisie de la répartition d'un poste : qui porte quelle part, sur quel **compte pivot**
 * la transaction a lieu, et quels comptes **contreparties** l'alimentent (CHARGE/RESERVE)
 * ou qu'il alimente (REVENU) — cf. `docs/01-principes-et-moteur.md` §8 bis.
 *
 * Trois rendus de répartition selon la taille du foyer (1 membre, 2 membres avec curseur,
 * 3 membres et plus). Ne fait aucun appel réseau : le conteneur fournit les membres, les
 * comptes et les quotes-parts du scénario.
 */
@Component({
  selector: 'app-poste-repartition',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ChoixCartesComponent, ChoixPucesComponent, InputNumberComponent, SelectComponent,
    MontantPipe, FormsModule,
  ],
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

  /**
   * Les parts d'une répartition AUTO/REVERSE_AUTO sont recalculées à chaque période
   * selon les revenus du scénario : afficher un pourcentage figé serait trompeur.
   * L'UI les remplace alors par une mention « dynamique ».
   */
  protected readonly repartitionDynamique = computed(() => {
    const type = this.valeur().typeRepartition;
    return type === 'AUTO' || type === 'REVERSE_AUTO';
  });

  protected readonly libellePartA = computed(() =>
    this.repartitionDynamique() ? this.t.poste.form.partDynamique : `${this.partA()} %`,
  );
  protected readonly libellePartB = computed(() =>
    this.repartitionDynamique() ? this.t.poste.form.partDynamique : `${this.partB()} %`,
  );

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
    this.repartitionDynamique()
      ? this.t.poste.form.curseurValeurDynamique
          .replace('{{a}}', this.membreA()?.nom ?? '')
          .replace('{{b}}', this.membreB()?.nom ?? '')
      : this.t.poste.form.curseurValeur
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
      routage: this.routageNettoye(selection),
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
      routage: this.routageNettoye(selection),
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

  /**
   * Aperçu « Dylan 60 % · Camille 40 % » pour un type donné. Les types AUTO et
   * REVERSE_AUTO n'affichent aucun chiffre : leurs parts dépendent de la période.
   */
  private apercuParts(type: TypeRepartition): string {
    if (type === 'AUTO' || type === 'REVERSE_AUTO') return this.t.poste.form.repartitionDynamique;
    const parts = this.partsCalculees(this.valeur().selection, type);
    return this.membresSelectionnes()
      .map(m => `${m.nom} ${Math.round(parts[m.id] ?? 0)} %`)
      .join(' · ');
  }

  // ── Compte pivot ──────────────────────────────────────────────────────

  /** Membres qui portent effectivement une part : seuls eux ont besoin d'un routage. */
  protected readonly membresAvecPart = computed(() =>
    this.membres().filter(m => this.valeur().selection.includes(m.id) && (this.valeur().parts[m.id] ?? 0) > 0),
  );

  /** « Prélevé sur » / « Versé sur » / « Mis de côté sur » selon le type du poste. */
  protected readonly libellePivot = computed(() => this.t.poste.form.depuis[this.type()]);
  protected readonly aidePivot = computed(() => this.t.poste.form.comptePivotAide[this.type()]);

  /** « Alimenté par » (CHARGE/RESERVE) ou « Redistribué vers » (REVENU). */
  protected readonly libelleContreparties = computed(() => this.t.poste.form.contreparties[this.type()]);
  protected readonly aideContreparties = computed(() => this.t.poste.form.contrepartiesAide[this.type()]);

  /**
   * Cartes de comptes : chaque compte porte les pastilles des membres qui y sont
   * rattachés (plus leurs noms en sous-titre), pour distinguer d'un coup d'œil un
   * compte personnel d'un compte partagé.
   *
   * Le compte pivot n'est volontairement pas restreint aux comptes du membre : une
   * charge peut être débitée d'un compte dont le payeur n'est pas titulaire.
   */
  protected optionsComptes(membreId?: string): OptionChoix<string>[] {
    const liste = membreId
      ? this.comptes().filter(c => c.membreIds?.includes(membreId))
      : this.comptes();
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

  protected choisirPivot(compteId: string | null): void {
    this.majValeur({ comptePivot: compteId });
  }

  // ── Routage (comptes contreparties) ───────────────────────────────────

  protected libelleContrepartiesMembre(nom: string): string {
    return this.t.poste.form.contrepartiesMembre
      .replace('{{libelle}}', this.libelleContreparties())
      .replace('{{nom}}', nom);
  }

  /** Options du `app-select` d'une ligne de routage : comptes rattachés au membre. */
  protected optionsSelect(membreId: string): { label: string; value: string }[] {
    return this.comptes()
      .filter(c => c.membreIds?.includes(membreId))
      .map(c => ({ label: c.libelle, value: c.id }));
  }

  protected lignes(membreId: string): readonly LigneRoutage[] {
    return this.valeur().routage[membreId] ?? [];
  }

  /** Compte du mode simple : la ligne unique du membre (null si plusieurs). */
  protected compteSimple(membreId: string): string | null {
    const l = this.lignes(membreId);
    return l.length === 1 ? l[0].compteId : null;
  }

  protected choisirCompteSimple(membreId: string, compteId: string | null): void {
    this.majRoutageMembre(membreId, ligneUnique(compteId));
  }

  protected majLigneCompte(membreId: string, index: number, compteId: string | null): void {
    this.majRoutageMembre(membreId,
      this.lignes(membreId).map((l, i) => (i === index ? { ...l, compteId } : l)));
  }

  protected majLignePart(membreId: string, index: number, part: number | null): void {
    this.majRoutageMembre(membreId,
      this.lignes(membreId).map((l, i) => (i === index ? { ...l, part: part ?? 0 } : l)));
  }

  /**
   * Ajoute une contrepartie et répartit les parts à égalité : un ajout ne doit jamais
   * laisser le membre avec un total invalide.
   */
  protected ajouterLigne(membreId: string): void {
    const lignes = this.lignes(membreId);
    const dejaUtilises = new Set(lignes.map(l => l.compteId));
    const libre = this.optionsSelect(membreId).find(o => !dejaUtilises.has(o.value));
    const partEgale = Math.round((100 / (lignes.length + 1)) * 100) / 100;
    const reparties = lignes.map(l => ({ ...l, part: partEgale }));
    // La dernière ligne absorbe le reliquat d'arrondi pour garder un total de 100 %.
    const reste = Math.round((100 - partEgale * lignes.length) * 100) / 100;
    this.majRoutageMembre(membreId, [...reparties, { compteId: libre?.value ?? null, part: reste }]);
  }

  protected retirerLigne(membreId: string, index: number): void {
    const restantes = this.lignes(membreId).filter((_, i) => i !== index);
    if (!restantes.length) return;
    if (restantes.length === 1) {
      this.majRoutageMembre(membreId, ligneUnique(restantes[0].compteId));
      return;
    }
    // Le reliquat de la ligne retirée revient à la dernière ligne restante.
    const correction = Math.round((100 - sommeRoutage(restantes)) * 100) / 100;
    this.majRoutageMembre(membreId, restantes.map((l, i) =>
      i === restantes.length - 1 ? { ...l, part: Math.round((l.part + correction) * 100) / 100 } : l,
    ));
  }

  protected total(membreId: string): number {
    return sommeRoutage(this.lignes(membreId));
  }

  protected routageValide(membreId: string): boolean {
    return routageMembreValide(this.lignes(membreId));
  }

  protected basculerRoutageAvance(avance: boolean): void {
    if (avance) {
      this.majValeur({ routageAvance: true });
      return;
    }
    // Retour au mode simple : on ne garde que le compte majoritaire de chaque membre.
    const routage: Record<string, readonly LigneRoutage[]> = {};
    for (const id of Object.keys(this.valeur().routage)) {
      const lignes = [...this.lignes(id)].sort((a, b) => b.part - a.part);
      routage[id] = ligneUnique(lignes[0]?.compteId ?? null);
    }
    this.majValeur({ routageAvance: false, routage });
  }

  /** Le mode avancé est imposé dès qu'un membre porte plusieurs comptes. */
  protected readonly avanceImpose = computed(() =>
    routageMultiComptes(this.valeur().routage, this.valeur().selection),
  );

  protected readonly modeAvance = computed(() => this.valeur().routageAvance || this.avanceImpose());

  private majRoutageMembre(membreId: string, lignes: readonly LigneRoutage[]): void {
    this.majValeur({ routage: { ...this.valeur().routage, [membreId]: lignes } });
  }

  /** Un membre hors répartition perd son routage ; un nouveau membre en reçoit un par défaut. */
  private routageNettoye(selection: readonly string[]): Record<string, readonly LigneRoutage[]> {
    const routage: Record<string, readonly LigneRoutage[]> = {};
    for (const m of this.membres()) {
      if (!selection.includes(m.id)) continue;
      const existantes = this.valeur().routage[m.id];
      routage[m.id] = existantes?.length ? existantes : ligneUnique(this.compteParDefaut(m.id));
    }
    return routage;
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
