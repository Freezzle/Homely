import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { dateInterceptor } from './date.interceptor';

describe('dateInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;

  // UTC+2 (été en Suisse) : getTimezoneOffset() = UTC - local, en minutes.
  const OFFSET_UTC_PLUS_2 = -120;

  /**
   * Construit une Date dont le wall-clock (une fois getTimezoneOffset mocké à `offset`)
   * correspond exactement aux champs fournis, indépendamment du fuseau réel de la
   * machine qui exécute les tests.
   */
  function localDateUnderOffset(
    offset: number,
    y: number,
    m: number,
    d: number,
    h = 0,
    mi = 0,
    s = 0
  ): Date {
    return new Date(Date.UTC(y, m, d, h, mi, s) + offset * 60000);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([dateInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('sérialise une Date locale à minuit en ISO UTC du même jour', () => {
    spyOn(Date.prototype, 'getTimezoneOffset').and.returnValue(OFFSET_UTC_PLUS_2);
    const dateMinuitLocale = localDateUnderOffset(OFFSET_UTC_PLUS_2, 2026, 9, 1);

    httpClient.post('/api/test', { dateDebut: dateMinuitLocale }).subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.body.dateDebut).toBe('2026-10-01T00:00:00.000Z');
    req.flush({});
  });

  it("préserve l'heure locale (showTime) dans le body sortant", () => {
    spyOn(Date.prototype, 'getTimezoneOffset').and.returnValue(OFFSET_UTC_PLUS_2);
    const dateAvecHeure = localDateUnderOffset(OFFSET_UTC_PLUS_2, 2026, 9, 1, 14, 30, 0);

    httpClient.post('/api/test', { horodatage: dateAvecHeure }).subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(req.request.body.horodatage).toBe('2026-10-01T14:30:00.000Z');
    req.flush({});
  });

  it('re-parse une réponse à minuit UTC exact en Date locale du même jour', () => {
    httpClient.get('/api/test').subscribe(res => {
      const body = res as { dateDebut: Date };
      expect(body.dateDebut instanceof Date).toBeTrue();
      expect(body.dateDebut.getFullYear()).toBe(2026);
      expect(body.dateDebut.getMonth()).toBe(9); // 0-indexé : octobre
      expect(body.dateDebut.getDate()).toBe(1);
    });

    const req = httpMock.expectOne('/api/test');
    req.flush({ dateDebut: '2026-10-01T00:00:00Z' });
  });

  it('ne modifie pas un timestamp réel (heure ≠ minuit UTC)', () => {
    httpClient.get('/api/test').subscribe(res => {
      const body = res as { horodatage: unknown };
      expect(body.horodatage).toBe('2026-10-01T14:30:00Z');
    });

    const req = httpMock.expectOne('/api/test');
    req.flush({ horodatage: '2026-10-01T14:30:00Z' });
  });

  it('convertit récursivement les objets imbriqués et les tableaux (sortant et entrant)', () => {
    spyOn(Date.prototype, 'getTimezoneOffset').and.returnValue(OFFSET_UTC_PLUS_2);
    const d = localDateUnderOffset(OFFSET_UTC_PLUS_2, 2026, 9, 1);

    httpClient
      .post('/api/test', { poste: { dates: [d, { debut: d }] } })
      .subscribe(res => {
        const body = res as { postes: Array<{ debut: Date }> };
        expect(body.postes[0].debut instanceof Date).toBeTrue();
        expect(body.postes[0].debut.getDate()).toBe(1);
      });

    const req = httpMock.expectOne('/api/test');
    expect(req.request.body.poste.dates[0]).toBe('2026-10-01T00:00:00.000Z');
    expect(req.request.body.poste.dates[1].debut).toBe('2026-10-01T00:00:00.000Z');
    req.flush({ postes: [{ debut: '2026-10-01T00:00:00Z' }] });
  });

  it('laisse un body FormData inchangé', () => {
    const formData = new FormData();
    formData.append('fichier', new Blob(['contenu']), 'test.txt');

    httpClient.post('/api/upload', formData).subscribe();

    const req = httpMock.expectOne('/api/upload');
    expect(req.request.body).toBe(formData);
    req.flush({});
  });
});
