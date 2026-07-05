import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  ProjectionAnnuelleDto, TresorerieDto, VentilationsDto,
  PatrimoineDto, ComparaisonDto, ApercuPosteDto
} from '../models/api.models';

/** T9.3 — Service HTTP projection scopé par foyer/scénario. */
@Injectable({ providedIn: 'root' })
export class ProjectionService {
  constructor(private http: HttpClient) {}

  private base(foyerId: string, scenarioId: string) {
    return `/api/foyers/${foyerId}/scenarios/${scenarioId}/projection`;
  }

  annuelle(foyerId: string, scenarioId: string, annee: number) {
    return this.http.get<ProjectionAnnuelleDto>(
      `${this.base(foyerId, scenarioId)}/annuelle`, { params: { annee } }
    );
  }

  annuelleComplete(foyerId: string, scenarioId: string) {
    return this.http.get<ProjectionAnnuelleDto[]>(
      `${this.base(foyerId, scenarioId)}/annuelle-complete`
    );
  }

  tresorerie(foyerId: string, scenarioId: string) {
    return this.http.get<TresorerieDto>(
      `${this.base(foyerId, scenarioId)}/tresorerie`
    );
  }

  mensuelle(foyerId: string, scenarioId: string, annee: number, mois: number) {
    return this.http.get<VentilationsDto>(
      `${this.base(foyerId, scenarioId)}/mensuelle`, { params: { annee, mois } }
    );
  }

  patrimoine(foyerId: string, scenarioId: string) {
    return this.http.get<PatrimoineDto>(
      `${this.base(foyerId, scenarioId)}/patrimoine`
    );
  }

  comparaison(foyerId: string, scenarioIds: string[]) {
    const params = new HttpParams().set('scenarioIds', scenarioIds.join(','));
    return this.http.get<ComparaisonDto>(
      `/api/foyers/${foyerId}/projection/comparaison`, { params }
    );
  }

  apercuPoste(foyerId: string, scenarioId: string, posteId: string, annee: number) {
    return this.http.get<ApercuPosteDto>(
      `/api/foyers/${foyerId}/scenarios/${scenarioId}/postes/${posteId}/apercu`,
      { params: { annee } }
    );
  }
}
