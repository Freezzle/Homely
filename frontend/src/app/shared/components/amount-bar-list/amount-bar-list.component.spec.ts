import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateService } from '@ngx-translate/core';
import { ContexteService } from '../../../core/services/contexte.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AmountBarListComponent } from './amount-bar-list.component';

describe('AmountBarListComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AmountBarListComponent],
      providers: [
        provideNoopAnimations(),
        { provide: ContexteService, useValue: { deviseBase: signal('CHF') } },
        { provide: TranslateService, useValue: { currentLang: () => 'fr' } },
        { provide: I18nService, useValue: { currentLang: () => 'fr' } },
      ],
    }).compileComponents();
  });

  it('renders amounts with the provided reference and emphasis row', () => {
    const fixture = TestBed.createComponent(AmountBarListComponent);

    fixture.componentRef.setInput('items', [
      { key: 'charges', label: 'Charges', amount: 500, color: 'var(--app-charge)' },
      { key: 'disponible', label: 'Disponible', amount: 250, color: 'var(--app-neutre)', emphasis: true },
    ]);
    fixture.componentRef.setInput('reference', 1000);
    fixture.componentRef.setInput('devise', 'CHF');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const bars = Array.from(element.querySelectorAll<HTMLElement>('.bar'));

    expect(bars.length).toBe(2);
    expect(bars[0].getAttribute('style')).toContain('--fill: 50%');
    expect(bars[1].classList.contains('bar--emphasis')).toBeTrue();
    expect(element.textContent).toContain('Charges');
    expect(element.textContent).toContain('Disponible');
    expect(element.textContent).toContain('CHF');
  });

  it('falls back to the max item amount when no reference is provided', () => {
    const fixture = TestBed.createComponent(AmountBarListComponent);

    fixture.componentRef.setInput('items', [
      { key: 'revenus', label: 'Revenus', amount: 1200, color: 'var(--app-revenu)' },
      { key: 'charges', label: 'Charges', amount: 600, color: 'var(--app-charge)' },
    ]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const bars = Array.from(element.querySelectorAll<HTMLElement>('.bar'));

    expect(bars[0].getAttribute('style')).toContain('--fill: 100%');
    expect(bars[1].getAttribute('style')).toContain('--fill: 50%');
  });
});
