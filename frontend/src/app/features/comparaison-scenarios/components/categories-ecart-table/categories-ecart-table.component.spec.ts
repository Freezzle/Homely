import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateService } from '@ngx-translate/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { CategorieEcartRow } from '../../data/comparaison-scenarios.models';
import { CategoriesEcartTableComponent } from './categories-ecart-table.component';

const ROWS: CategorieEcartRow[] = [
  { categorieId: 'c1', libelle: 'Logement', type: 'CHARGE', totalA: 1000, totalB: 1200, ecart: 200, impact: -1, effet: -200 },
  { categorieId: 'c2', libelle: 'Salaire', type: 'REVENU', totalA: 3000, totalB: 3000, ecart: 0, impact: 1, effet: 0 },
  { categorieId: 'c3', libelle: 'Loisirs', type: 'CHARGE', totalA: 200, totalB: 100, ecart: -100, impact: -1, effet: 100 },
];

describe('CategoriesEcartTableComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoriesEcartTableComponent],
      providers: [
        provideNoopAnimations(),
        { provide: TranslateService, useValue: { currentLang: () => 'fr' } },
        { provide: I18nService, useValue: {
          currentLang: () => 'fr',
          translations: () => ({
            commun: { tous: 'Tous' },
            referentiels: { categorie: { typeOptions: { REVENU: 'Revenu', CHARGE: 'Charge', RESERVE: 'Réserve' } } },
            comparaisonScenarios: {
              categories: {
                colonneCategorie: 'Catégorie', colonneType: 'Type', colonneEcart: 'Écart', colonnePoids: 'Poids',
                ecartsUniquement: 'Écarts uniquement', aucunEcart: 'Rien',
              },
            },
          }),
        } },
      ],
    }).compileComponents();
  });

  it('filtre par type de poste', () => {
    const fixture = TestBed.createComponent(CategoriesEcartTableComponent);
    fixture.componentRef.setInput('rows', ROWS);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as {
      filtreType: { set: (v: string) => void };
      rowsFiltrees: () => CategorieEcartRow[];
    };
    cmp.filtreType.set('CHARGE');
    expect(cmp.rowsFiltrees().every(r => r.type === 'CHARGE')).toBe(true);
    expect(cmp.rowsFiltrees().length).toBe(2);
  });

  it('filtre "écarts uniquement" exclut les lignes à écart nul', () => {
    const fixture = TestBed.createComponent(CategoriesEcartTableComponent);
    fixture.componentRef.setInput('rows', ROWS);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as {
      ecartsUniquement: { set: (v: boolean) => void };
      rowsFiltrees: () => CategorieEcartRow[];
    };
    cmp.ecartsUniquement.set(true);
    expect(cmp.rowsFiltrees().some(r => r.ecart === 0)).toBe(false);
    expect(cmp.rowsFiltrees().length).toBe(2);
  });

  it('trie par amplitude d\'écart décroissante par défaut', () => {
    const fixture = TestBed.createComponent(CategoriesEcartTableComponent);
    fixture.componentRef.setInput('rows', ROWS);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { rowsTriees: () => CategorieEcartRow[] };
    expect(cmp.rowsTriees().map(r => r.categorieId)).toEqual(['c1', 'c3', 'c2']);
  });
});
