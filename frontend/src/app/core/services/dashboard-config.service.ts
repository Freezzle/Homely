import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { SeuilsDashboardDto } from '../models/api.models';

export const SEUILS_DASHBOARD_PAR_DEFAUT: SeuilsDashboardDto = {
  moisARisqueSoldeMin: 500,
  tauxEffortCorrect: 75,
  tauxEffortTendu: 90,
  tauxEffortSature: 95,
  tauxEffortSoutenu: 70,
  tauxEffortCritique: 85,
  besoinsPlaisirsBudget: 50,
  posteAOptimiserScore: 66,
};

@Injectable({ providedIn: 'root' })
export class DashboardConfigService {
  private readonly http = inject(HttpClient);

  readonly seuils = toSignal(
    this.http.get<SeuilsDashboardDto>('/api/dashboard/seuils').pipe(
      catchError(() => of(SEUILS_DASHBOARD_PAR_DEFAUT)),
    ),
    { initialValue: SEUILS_DASHBOARD_PAR_DEFAUT },
  );
}
