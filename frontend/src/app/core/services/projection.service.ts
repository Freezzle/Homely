import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ProjectionAnnuelleDto, VentilationsDto, EvenementDto,
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

  /** Si membreId est fourni, le backend ne renvoie que les événements où sa quote-part
   *  effective est > 0 ce mois-là, avec les montants déjà proratisés. */
  evenements(foyerId: string, scenarioId: string, annee: number, membreId?: string) {
    const params: Record<string, string | number> = { annee };
    if (membreId) { params['membreId'] = membreId; }
    return this.http.get<EvenementDto[]>(
      `${this.base(foyerId, scenarioId)}/evenements`, { params }
    );
  }
}
