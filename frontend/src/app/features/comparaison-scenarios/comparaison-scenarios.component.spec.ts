import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateService } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { ContexteService } from '../../core/services/contexte.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ScenarioService } from '../../core/services/scenario-poste.service';
import { CategorieService } from '../../core/services/referentiel.service';
import { ComparaisonScenariosDataService } from './data/comparaison-scenarios-data.service';
import { ComparaisonScenariosComponent } from './comparaison-scenarios.component';

const TRANSLATIONS = {
  mois: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  comparaisonScenarios: {
    filtres: { perimetreFoyer: 'Foyer' },
    indicateurs: { revenus: 'Revenus', charges: 'Charges', reserves: 'Réserves', argentPoche: 'Argent de poche', soldeDisponible: 'Solde disponible', noteReserves: '', noteArgentPoche: '' },
    cascade: { revenus: 'Revenus', charges: 'Charges', reserves: 'Réserves', rav: 'RàV', argentPoche: 'Argent de poche', soldeDisponible: 'Solde disponible' },
  },
};

describe('ComparaisonScenariosComponent — navigation mensuelle de la cascade', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComparaisonScenariosComponent],
      providers: [
        provideNoopAnimations(),
        { provide: TranslateService, useValue: { currentLang: () => 'fr' } },
        { provide: I18nService, useValue: { currentLang: () => 'fr', translations: () => TRANSLATIONS } },
        { provide: ContexteService, useValue: {
          foyerId: signal(null),
          membres: signal([]),
          deviseBase: signal('CHF'),
        } },
        { provide: ScenarioService, useValue: { lister: () => of([]) } },
        { provide: CategorieService, useValue: { lister: () => of([]) } },
        { provide: ComparaisonScenariosDataService, useValue: {
          chargerScenario: () => of(null),
          chargerVentilationsMensuelles: () => of([]),
        } },
      ],
    }).compileComponents();
  });

  it('avance et recule dans les mois avec un rebouclage 0..11', () => {
    const fixture = TestBed.createComponent(ComparaisonScenariosComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as {
      moisCascade: () => number;
      moisSuivant: () => void;
      moisPrecedent: () => void;
    };

    expect(cmp.moisCascade()).toBe(5); // défaut = mai (feature_5_bis §7)
    cmp.moisPrecedent();
    expect(cmp.moisCascade()).toBe(4);
    for (let i = 0; i < 5; i++) cmp.moisPrecedent();
    expect(cmp.moisCascade()).toBe(11); // rebouclage vers décembre
    cmp.moisSuivant();
    cmp.moisSuivant();
    expect(cmp.moisCascade()).toBe(1);
  });
});
