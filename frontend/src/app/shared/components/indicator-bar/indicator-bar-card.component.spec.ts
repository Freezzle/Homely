import { CommonModule } from '@angular/common';
import { Component, ViewChild, TemplateRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { I18nService } from '../../../core/i18n/i18n.service';
import { IndicatorCardComponent } from './indicator-bar-card.component';

const i18nStub = {
  translations: () => ({
    shared: {
      indicatorBar: {
        aide: 'Détail du calcul',
        aideAriaLabel: 'Afficher le détail du calcul de {titre}',
      },
    },
  }),
  currentLang: () => 'fr',
};

describe('IndicatorCardComponent', () => {
  let fixture: ComponentFixture<IndicatorCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IndicatorCardComponent],
      providers: [
        provideNoopAnimations(),
        { provide: I18nService, useValue: i18nStub },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(IndicatorCardComponent);
    fixture.componentRef.setInput('title', "Taux d'épargne");
  });

  it('rend le titre en h3 par défaut', () => {
    fixture.detectChanges();
    const h3 = fixture.debugElement.query(By.css('h3.indicator-bar-card__title'));
    expect(h3).not.toBeNull();
    expect((h3.nativeElement as HTMLElement).textContent).toContain('Taux d\'épargne');
  });

  it('respecte `headingLevel`', () => {
    fixture.componentRef.setInput('headingLevel', 2);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('h2.indicator-bar-card__title'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('h3.indicator-bar-card__title'))).toBeNull();
  });

  it('rend le sous-titre uniquement s\'il est fourni', () => {
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.indicator-bar-card__subtitle'))).toBeNull();
    fixture.componentRef.setInput('subtitle', 'Sous-titre');
    fixture.detectChanges();
    const sub = fixture.debugElement.query(By.css('.indicator-bar-card__subtitle'));
    expect(sub).not.toBeNull();
    expect((sub.nativeElement as HTMLElement).textContent).toContain('Sous-titre');
  });

  it('ne rend aucun pied de carte si ni `formula` ni `help`', () => {
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.indicator-bar-card__footer'))).toBeNull();
  });

  it('rend la formule dans le pied sans icône si `help` absent', () => {
    fixture.componentRef.setInput('formula', 'épargne ÷ revenu');
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.indicator-bar-card__formula'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.indicator-bar-card__help-btn'))).toBeNull();
  });

  it('rend le bouton d\'aide si `help` est fourni', () => {
    fixture.componentRef.setInput('help', 'Détail…');
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('.indicator-bar-card__help-btn'));
    expect(btn).not.toBeNull();
    expect((btn.nativeElement as HTMLButtonElement).getAttribute('type')).toBe('button');
    const label = (btn.nativeElement as HTMLButtonElement).getAttribute('aria-label');
    expect(label).toContain('Taux d\'épargne');
  });

  it('a un aria-label calculé par défaut incluant le titre et les libellés des bulles', () => {
    fixture.componentRef.setInput('markers', [
      { positionPercent: 20, label: '3,9 %' },
      { positionPercent: 60, label: '15,3 %' },
    ]);
    fixture.detectChanges();
    const bar = fixture.debugElement.query(By.css('app-indicator-bar')).nativeElement as HTMLElement;
    const aria = bar.getAttribute('aria-label') ?? '';
    expect(aria).toContain('Taux d\'épargne');
    expect(aria).toContain('3,9 %');
    expect(aria).toContain('15,3 %');
  });

  it('propage l\'aria-label explicite quand il est fourni', () => {
    fixture.componentRef.setInput('ariaLabel', 'Résumé personnalisé');
    fixture.detectChanges();
    const bar = fixture.debugElement.query(By.css('app-indicator-bar')).nativeElement as HTMLElement;
    expect(bar.getAttribute('aria-label')).toBe('Résumé personnalisé');
  });
});

@Component({
  standalone: true,
  imports: [CommonModule, IndicatorCardComponent],
  template: `
    <ng-template #tpl><span class="tpl-content">Aide riche</span></ng-template>
    <app-indicator-card title="Taux" [help]="tpl"></app-indicator-card>
  `,
})
class HostComponent {
  @ViewChild('tpl') tpl!: TemplateRef<unknown>;
}

describe('IndicatorCardComponent (TemplateRef help)', () => {
  it('accepte un TemplateRef comme contenu d\'aide', () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideNoopAnimations(),
        { provide: I18nService, useValue: i18nStub },
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('.indicator-bar-card__help-btn'));
    expect(btn).not.toBeNull();
  });
});
