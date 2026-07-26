import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// PrimeNG
import { StepperModule } from 'primeng/stepper';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

// App
import { FoyerService, MembreService } from '../../../core/services/referentiel.service';
import { ContexteService } from '../../../core/services/contexte.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { FoyerOnboardingRequest } from '../../../core/models/api.models';

// ── Modèles internes du wizard ──────────────────────────────────────────────

interface MembreLocal {
  nom: string;
  couleur: string;
  ordre: number; // 1-based, correspond à l'index dans la liste
}

interface CompteLocal {
  libelle: string;
  soldeInitial: number;
  membreOrdres: number[];
}

interface CategorieLocal {
  libelle: string;
  typePoste: 'REVENU' | 'CHARGE' | 'RESERVE';
}

interface RepartitionLocal {
  membreOrdre: number;
  nomMembre: string;
  quotePart: number; // en pourcentage (0-100)
}

interface ScenarioLocal {
  nom: string;
  anneeDepart: number;
  tresorerieInitiale: number;
  repartitions: RepartitionLocal[];
}

@Component({
  selector: 'app-foyer-creation',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    StepperModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    MultiSelectModule,
    MessageModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './foyer-creation.component.html',
})
export class FoyerCreationComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  readonly t = this.i18n.translations();
  private foyerSvc = inject(FoyerService);
  private membreSvc = inject(MembreService);
  private contexte = inject(ContexteService);
  private router = inject(Router);
  private toast = inject(MessageService);

  // ── État global du wizard ────────────────────────────────────────────────
  etapeActive = signal<number>(1);
  enCours = signal(false);

  // ── Étape 0 : Foyer ──────────────────────────────────────────────────────
  foyerNom = signal<string>(this.t.foyer.onboarding.defaults.foyerNom);
  foyerDevise = signal<string>('CHF');

  readonly devises = ['CHF', 'EUR', 'USD', 'GBP', 'CAD'];

  // ── Étape 1 : Membres ────────────────────────────────────────────────────
  membres = signal<MembreLocal[]>([
    { nom: this.i18n.instant('foyer.onboarding.defaults.membreNomTemplate', { index: 1 }), couleur: '#6366f1', ordre: 1 },
  ]);

  readonly membreOptions = computed(() =>
    this.membres().map(m => ({ label: m.nom || this.i18n.instant('foyer.onboarding.defaults.membreNomTemplate', { index: m.ordre }), value: m.ordre }))
  );

  // ── Étape 2 : Comptes ────────────────────────────────────────────────────
  comptes = signal<CompteLocal[]>([]);

  // ── Étape 3 : Catégories ─────────────────────────────────────────────────
  categoriesRevenu = signal<CategorieLocal[]>(
    this.t.foyer.onboarding.defaults.categories.revenu.map(l => ({ libelle: l, typePoste: 'REVENU' as const }))
  );
  categoriesCharge = signal<CategorieLocal[]>(
    this.t.foyer.onboarding.defaults.categories.charge.map(l => ({ libelle: l, typePoste: 'CHARGE' as const }))
  );
  categoriesReserve = signal<CategorieLocal[]>(
    this.t.foyer.onboarding.defaults.categories.reserve.map(l => ({ libelle: l, typePoste: 'RESERVE' as const }))
  );

  // Labels traduits des colonnes de catégories
  readonly revenuLabel = this.t.projection.revenus;
  readonly chargeLabel = this.t.projection.charges;
  readonly reserveLabel = this.t.projection.reserves;

  // ── Étape 4 : Scénario ───────────────────────────────────────────────────
  scenario = signal<ScenarioLocal>({
    nom: this.t.foyer.onboarding.defaults.scenarioNom,
    anneeDepart: new Date().getFullYear(),
    tresorerieInitiale: 0,
    repartitions: [],
  });

  readonly annees: number[] = Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - 5 + i);

  // Computed
  readonly sommeRepartitions = computed(() =>
    this.scenario().repartitions.reduce((acc, r) => acc + (r.quotePart ?? 0), 0)
  );
  readonly repartitionValide = computed(() => Math.abs(this.sommeRepartitions() - 100) < 0.01);

  // ── Validation par étape ─────────────────────────────────────────────────
  readonly etape1Valide = computed(() =>
                                       this.foyerNom().trim().length > 0 &&
    this.membres().length >= 1 &&
    this.membres().every(m => m.nom.trim().length > 0)
  );
  readonly etape2Valide = computed(() =>
    this.comptes().length >= 1 &&
    this.comptes().every(c => c.libelle.trim().length > 0 && c.membreOrdres.length > 0)
  );
  readonly etape4Valide = computed(() =>
    this.scenario().nom.trim().length > 0 && this.repartitionValide()
  );

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // les comptes et répartitions seront initialisés à l'entrée des étapes 2 et 4
  }

  // ── Helpers de mise à jour réactive ─────────────────────────────────────

  updateMembreNom(i: number, val: string): void {
    this.membres.update(list => list.map((m, idx) => idx === i ? { ...m, nom: val } : m));
  }

  updateMembreCouleur(i: number, val: string): void {
    this.membres.update(list => list.map((m, idx) => idx === i ? { ...m, couleur: val } : m));
  }

  updateCompteLibelle(i: number, val: string): void {
    this.comptes.update(list => list.map((c, idx) => idx === i ? { ...c, libelle: val } : c));
  }

  updateCompteSolde(i: number, val: number | null): void {
    this.comptes.update(list => list.map((c, idx) => idx === i ? { ...c, soldeInitial: val ?? 0 } : c));
  }

  updateCompteMembreOrdres(i: number, val: number[]): void {
    this.comptes.update(list => list.map((c, idx) => idx === i ? { ...c, membreOrdres: val } : c));
  }

  updateCategorieLibelle(type: 'REVENU' | 'CHARGE' | 'RESERVE', i: number, val: string): void {
    const mapper = (list: CategorieLocal[]) =>
      list.map((c, idx) => idx === i ? { ...c, libelle: val } : c);
    if (type === 'REVENU') this.categoriesRevenu.update(mapper);
    else if (type === 'CHARGE') this.categoriesCharge.update(mapper);
    else this.categoriesReserve.update(mapper);
  }

  updateScenarioNom(val: string): void {
    this.scenario.update(s => ({ ...s, nom: val }));
  }

  updateScenarioAnnee(val: number): void {
    this.scenario.update(s => ({ ...s, anneeDepart: val }));
  }

  updateScenarioTresorerie(val: number | null): void {
    this.scenario.update(s => ({ ...s, tresorerieInitiale: val ?? 0 }));
  }

  updateRepartition(membreOrdre: number, quotePart: number | null): void {
    this.scenario.update(s => ({
      ...s,
      repartitions: s.repartitions.map(r =>
        r.membreOrdre === membreOrdre ? { ...r, quotePart: quotePart ?? 0 } : r
      ),
    }));
  }

  // ── Actions étape 1 ──────────────────────────────────────────────────────
  ajouterMembre(): void {
    if (this.membres().length >= 3) return;
    const ordre = this.membres().length + 1;
    this.membres.update(list => [
      ...list,
      {
        nom: this.i18n.instant('foyer.onboarding.defaults.membreNomTemplate', { index: ordre }),
        couleur: '#6366f1',
        ordre,
      },
    ]);
  }

  supprimerMembre(index: number): void {
    if (this.membres().length <= 1) return;
    this.membres.update(list => {
      const updated = list.filter((_, i) => i !== index);
      // Ré-indexer les ordres locaux
      return updated.map((m, i) => ({ ...m, ordre: i + 1 }));
    });
  }

  // ── Transition vers étape 2 (initialiser les comptes) ────────────────────
  entrerEtape2(): void {
    if (this.comptes().length > 0) return; // ne pas réinitialiser si déjà rempli
    const comptes: CompteLocal[] = this.membres().map(m => ({
      libelle: `${this.t.foyer.onboarding.defaults.compteLibelle}`,
      soldeInitial: 0,
      membreOrdres: [m.ordre],
    }));
    this.comptes.set(comptes);
  }

  // ── Actions étape 2 ──────────────────────────────────────────────────────
  ajouterCompte(): void {
    if (this.comptes().length >= 10) return;
    this.comptes.update(list => [
      ...list,
      {
        libelle: this.t.foyer.onboarding.defaults.compteLibelle,
        soldeInitial: 0,
        membreOrdres: this.membres().length > 0 ? [this.membres()[0].ordre] : [],
      },
    ]);
  }

  supprimerCompte(index: number): void {
    if (this.comptes().length <= 1) return;
    this.comptes.update(list => list.filter((_, i) => i !== index));
  }

  // ── Actions étape 3 ──────────────────────────────────────────────────────
  ajouterCategorie(type: 'REVENU' | 'CHARGE' | 'RESERVE'): void {
    const item: CategorieLocal = { libelle: '', typePoste: type };
    if (type === 'REVENU') this.categoriesRevenu.update(l => [...l, item]);
    else if (type === 'CHARGE') this.categoriesCharge.update(l => [...l, item]);
    else this.categoriesReserve.update(l => [...l, item]);
  }

  supprimerCategorie(type: 'REVENU' | 'CHARGE' | 'RESERVE', index: number): void {
    if (type === 'REVENU') this.categoriesRevenu.update(l => l.filter((_, i) => i !== index));
    else if (type === 'CHARGE') this.categoriesCharge.update(l => l.filter((_, i) => i !== index));
    else this.categoriesReserve.update(l => l.filter((_, i) => i !== index));
  }

  // ── Transition vers étape 4 (initialiser les répartitions) ───────────────
  entrerEtape4(): void {
    const nb = this.membres().length;
    const repartitions: RepartitionLocal[] = this.membres().map((m) => ({
      membreOrdre: m.ordre,
      nomMembre: m.nom || this.i18n.instant('foyer.onboarding.defaults.membreNomTemplate', { index: m.ordre }),
      quotePart: nb === 1 ? 100 : nb === 2 ? 50 : 0,
    }));
    this.scenario.update(s => ({ ...s, repartitions }));
  }

  // ── Soumission finale ─────────────────────────────────────────────────────
  creer(): void {
    if (!this.etape4Valide()) return;
    this.enCours.set(true);

    const sc = this.scenario();
    const req: FoyerOnboardingRequest = {
      nom: this.foyerNom().trim(),
      deviseBase: this.foyerDevise(),
      membres: this.membres().map(m => ({ nom: m.nom.trim(), couleur: m.couleur })),
      comptes: this.comptes().map(c => ({
        libelle: c.libelle.trim(),
        soldeInitial: c.soldeInitial ?? 0,
        membreOrdres: c.membreOrdres,
      })),
      categories: [
        ...this.categoriesRevenu().filter(c => c.libelle.trim()).map(c => ({ libelle: c.libelle.trim(), typePoste: 'REVENU' as const })),
        ...this.categoriesCharge().filter(c => c.libelle.trim()).map(c => ({ libelle: c.libelle.trim(), typePoste: 'CHARGE' as const })),
        ...this.categoriesReserve().filter(c => c.libelle.trim()).map(c => ({ libelle: c.libelle.trim(), typePoste: 'RESERVE' as const })),
      ],
      scenario: {
        nom: sc.nom.trim(),
        anneeDepart: sc.anneeDepart,
        tresorerieInitiale: sc.tresorerieInitiale ?? 0,
        repartitions: sc.repartitions.map(r => ({
          membreOrdre: r.membreOrdre,
          quotePart: r.quotePart / 100, // le backend attend une valeur décimale (0.0 – 1.0)
        })),
      },
    };

    this.foyerSvc.onboarding(req).subscribe({
      next: res => {
        this.enCours.set(false);
        this.contexte.setFoyer(res.foyer);
        this.membreSvc.lister(res.foyer.id).subscribe({
          next: membres => {
            this.contexte.setMembres(membres);
            this.contexte.notifierRefresh();
            this.router.navigate(['/f', res.foyer.id, 'dashboard-mensuel']);
          },
          error: () => {
            this.contexte.notifierRefresh();
            this.router.navigate(['/f', res.foyer.id, 'dashboard-mensuel']);
          },
        });
      },
      error: () => {
        this.enCours.set(false);
        this.toast.add({ severity: 'error', summary: this.t.commun.erreur, life: 5000 });
      },
    });
  }
}


