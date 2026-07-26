import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ProjectionAnnuelleDto, VentilationsDto,
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

  mensuelle(foyerId: string, scenarioId: string, annee: number, mois: number) {
    return this.http.get<VentilationsDto>(
      `${this.base(foyerId, scenarioId)}/mensuelle`, { params: { annee, mois } }
    );
  }
}
