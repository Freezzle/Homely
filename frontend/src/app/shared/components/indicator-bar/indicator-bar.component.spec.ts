import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { IndicatorBarComponent } from './indicator-bar.component';
import { IndicatorMarker, IndicatorSegment, IndicatorTick } from './indicator-bar.model';

describe('IndicatorBarComponent', () => {
  let fixture: ComponentFixture<IndicatorBarComponent>;
  let component: IndicatorBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [IndicatorBarComponent] }).compileComponents();
    fixture = TestBed.createComponent(IndicatorBarComponent);
    component = fixture.componentInstance;
  });

  const setInputs = (inputs: {
    segments?: IndicatorSegment[];
    ticks?: IndicatorTick[];
    markers?: IndicatorMarker[];
    showTicks?: boolean;
    showTickLabels?: boolean;
    showMarkers?: boolean;
  }) => {
    fixture.componentRef.setInput('segments', inputs.segments ?? []);
    fixture.componentRef.setInput('ticks', inputs.ticks ?? []);
    fixture.componentRef.setInput('markers', inputs.markers ?? []);
    if (inputs.showTicks !== undefined) fixture.componentRef.setInput('showTicks', inputs.showTicks);
    if (inputs.showTickLabels !== undefined) fixture.componentRef.setInput('showTickLabels', inputs.showTickLabels);
    if (inputs.showMarkers !== undefined) fixture.componentRef.setInput('showMarkers', inputs.showMarkers);
    fixture.detectChanges();
  };

  it('rend une piste nue quand aucun segment n\'est fourni', () => {
    setInputs({});
    const segments = fixture.debugElement.queryAll(By.css('.indicator-bar__segment'));
    expect(segments.length).toBe(0);
    expect(fixture.debugElement.query(By.css('.indicator-bar__track'))).not.toBeNull();
  });

  it('applique les largeurs des segments et la variante', () => {
    setInputs({
      segments: [
        { widthPercent: 30, variant: 'good' },
        { widthPercent: 20, variant: 'warn' },
      ],
    });
    const segments = fixture.debugElement.queryAll(By.css('.indicator-bar__segment'));
    expect(segments.length).toBe(2);
    expect((segments[0].nativeElement as HTMLElement).style.width).toBe('30%');
    expect(segments[0].nativeElement.classList).toContain('variant-good');
    expect(segments[1].nativeElement.classList).toContain('variant-warn');
  });

  it('donne la priorité à `color` libre sur `variant`', () => {
    setInputs({ segments: [{ widthPercent: 50, variant: 'good', color: 'rgb(1, 2, 3)' }] });
    const seg = fixture.debugElement.query(By.css('.indicator-bar__segment')).nativeElement as HTMLElement;
    expect(seg.style.background).toContain('rgb(1, 2, 3)');
  });

  it('ne normalise pas les largeurs (somme < 100 laisse la piste visible)', () => {
    setInputs({ segments: [{ widthPercent: 40 }, { widthPercent: 30 }] });
    const segments = fixture.debugElement.queryAll(By.css('.indicator-bar__segment'));
    expect((segments[0].nativeElement as HTMLElement).style.width).toBe('40%');
    expect((segments[1].nativeElement as HTMLElement).style.width).toBe('30%');
  });

  it('rend les jalons et masque les étiquettes seulement quand `label` est absent', () => {
    setInputs({
      ticks: [
        { positionPercent: 25, label: '25' },
        { positionPercent: 75 },
      ],
    });
    expect(fixture.debugElement.queryAll(By.css('.indicator-bar__tick')).length).toBe(2);
    const labels = fixture.debugElement.queryAll(By.css('.indicator-bar__tick-label'));
    expect(labels.length).toBe(1);
    expect((labels[0].nativeElement as HTMLElement).textContent).toContain('25');
  });

  it('`showTicks = false` masque traits et étiquettes', () => {
    setInputs({ ticks: [{ positionPercent: 50, label: '50' }], showTicks: false });
    expect(fixture.debugElement.queryAll(By.css('.indicator-bar__tick')).length).toBe(0);
    expect(fixture.debugElement.queryAll(By.css('.indicator-bar__tick-label')).length).toBe(0);
  });

  it('`showTickLabels = false` conserve les traits mais retire les étiquettes', () => {
    setInputs({ ticks: [{ positionPercent: 50, label: '50' }], showTickLabels: false });
    expect(fixture.debugElement.queryAll(By.css('.indicator-bar__tick')).length).toBe(1);
    expect(fixture.debugElement.queryAll(By.css('.indicator-bar__tick-label')).length).toBe(0);
  });

  it('borne les positions hors de [0, 100]', () => {
    setInputs({ markers: [{ positionPercent: -20 }, { positionPercent: 140 }] });
    const markers = fixture.debugElement.queryAll(By.css('.indicator-bar__marker'));
    expect((markers[0].nativeElement as HTMLElement).style.left).toBe('0%');
    expect((markers[1].nativeElement as HTMLElement).style.left).toBe('100%');
  });

  it('applique les classes de bord en fonction de la position', () => {
    setInputs({
      markers: [
        { positionPercent: 2 },
        { positionPercent: 50 },
        { positionPercent: 98 },
      ],
    });
    const markers = fixture.debugElement.queryAll(By.css('.indicator-bar__marker'));
    expect(markers[0].nativeElement.classList).toContain('is-start');
    expect(markers[1].nativeElement.classList).toContain('is-center');
    expect(markers[2].nativeElement.classList).toContain('is-end');
  });

  it('remonte la seconde bulle quand deux bulles sont à moins de 22 % l\'une de l\'autre', () => {
    setInputs({ markers: [{ positionPercent: 40 }, { positionPercent: 45 }] });
    const markers = fixture.debugElement.queryAll(By.css('.indicator-bar__marker'));
    expect(markers[0].nativeElement.classList).not.toContain('is-lane-1');
    expect(markers[1].nativeElement.classList).toContain('is-lane-1');
    const bar = fixture.debugElement.query(By.css('.indicator-bar'));
    expect(bar.nativeElement.classList).toContain('has-stacked-markers');
  });

  it('ne remonte aucune bulle quand elles sont suffisamment espacées', () => {
    setInputs({ markers: [{ positionPercent: 40 }, { positionPercent: 80 }] });
    const markers = fixture.debugElement.queryAll(By.css('.indicator-bar__marker'));
    expect(markers[0].nativeElement.classList).not.toContain('is-lane-1');
    expect(markers[1].nativeElement.classList).not.toContain('is-lane-1');
    const bar = fixture.debugElement.query(By.css('.indicator-bar'));
    expect(bar.nativeElement.classList).not.toContain('has-stacked-markers');
  });

  it('rend le libellé de la bulle et la variante `primary` par défaut', () => {
    setInputs({ markers: [{ positionPercent: 50, label: '15,3 %' }] });
    const marker = fixture.debugElement.query(By.css('.indicator-bar__marker'));
    expect(marker.nativeElement.classList).toContain('kind-primary');
    expect(marker.nativeElement.classList).toContain('variant-neutral');
    expect((marker.nativeElement as HTMLElement).textContent).toContain('15,3 %');
  });

  it('`showMarkers = false` retire toutes les bulles', () => {
    setInputs({ markers: [{ positionPercent: 50, label: 'x' }], showMarkers: false });
    expect(fixture.debugElement.queryAll(By.css('.indicator-bar__marker')).length).toBe(0);
  });

  it('n\'ajoute pas de tige aux bulles `plain`', () => {
    setInputs({ markers: [{ positionPercent: 50, label: '37', kind: 'plain' }] });
    expect(fixture.debugElement.query(By.css('.indicator-bar__marker-stem'))).toBeNull();
  });

  it('propage l\'ariaLabel sur l\'hôte', () => {
    fixture.componentRef.setInput('ariaLabel', 'Taux d\'épargne : 15 %');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).getAttribute('aria-label')).toBe(
      'Taux d\'épargne : 15 %',
    );
    expect((fixture.nativeElement as HTMLElement).getAttribute('role')).toBe('img');
  });
});
