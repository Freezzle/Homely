import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ScenarioDto, ScenarioRequest, PosteDto, PosteRequest, ObjectifDto, ObjectifRequest,
         RepartitionPeriodeDto, RepartitionPeriodeRequest } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ScenarioService {
  constructor(private http: HttpClient) {}
  private base(foyerId: string) { return `/api/foyers/${foyerId}/scenarios`; }
  lister(foyerId: string) { return this.http.get<ScenarioDto[]>(this.base(foyerId)); }
  obtenir(foyerId: string, id: string) { return this.http.get<ScenarioDto>(`${this.base(foyerId)}/${id}`); }
  creer(foyerId: string, req: ScenarioRequest) { return this.http.post<ScenarioDto>(this.base(foyerId), req); }
  modifier(foyerId: string, id: string, req: ScenarioRequest) { return this.http.put<ScenarioDto>(`${this.base(foyerId)}/${id}`, req); }
  supprimer(foyerId: string, id: string) { return this.http.delete<void>(`${this.base(foyerId)}/${id}`); }
  dupliquer(foyerId: string, id: string) { return this.http.post<ScenarioDto>(`${this.base(foyerId)}/${id}:dupliquer`, {}); }
  definirReference(foyerId: string, id: string) { return this.http.post<ScenarioDto>(`${this.base(foyerId)}/${id}:definir-reference`, {}); }
}

@Injectable({ providedIn: 'root' })
export class PosteService {
  constructor(private http: HttpClient) {}
  private base(foyerId: string, scenarioId: string) {
    return `/api/foyers/${foyerId}/scenarios/${scenarioId}/postes`;
  }
  lister(foyerId: string, scenarioId: string) { return this.http.get<PosteDto[]>(this.base(foyerId, scenarioId)); }
  creer(foyerId: string, scenarioId: string, req: PosteRequest) { return this.http.post<PosteDto>(this.base(foyerId, scenarioId), req); }
  modifier(foyerId: string, scenarioId: string, id: string, req: PosteRequest) { return this.http.put<PosteDto>(`${this.base(foyerId, scenarioId)}/${id}`, req); }
  supprimer(foyerId: string, scenarioId: string, id: string) { return this.http.delete<void>(`${this.base(foyerId, scenarioId)}/${id}`); }
  apercu(foyerId: string, scenarioId: string, posteId: string, annee: number) {
    return this.http.get<{ annee: number; contributions: { mois: number; contribution: number; }[] }>(
      `/api/foyers/${foyerId}/scenarios/${scenarioId}/postes/${posteId}/apercu`, { params: { annee } }
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ObjectifService {
  constructor(private http: HttpClient) {}
  private base(foyerId: string, scenarioId: string) {
    return `/api/foyers/${foyerId}/scenarios/${scenarioId}/objectifs`;
  }
  lister(foyerId: string, scenarioId: string) { return this.http.get<ObjectifDto[]>(this.base(foyerId, scenarioId)); }
  creer(foyerId: string, scenarioId: string, req: ObjectifRequest) { return this.http.post<ObjectifDto>(this.base(foyerId, scenarioId), req); }
  modifier(foyerId: string, scenarioId: string, id: string, req: ObjectifRequest) { return this.http.put<ObjectifDto>(`${this.base(foyerId, scenarioId)}/${id}`, req); }
  supprimer(foyerId: string, scenarioId: string, id: string) { return this.http.delete<void>(`${this.base(foyerId, scenarioId)}/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class RepartitionPeriodeService {
  constructor(private http: HttpClient) {}
  private base(foyerId: string, scenarioId: string) {
    return `/api/foyers/${foyerId}/scenarios/${scenarioId}/periodes`;
  }
  lister(foyerId: string, scenarioId: string) {
    return this.http.get<RepartitionPeriodeDto[]>(this.base(foyerId, scenarioId));
  }
  creer(foyerId: string, scenarioId: string, req: RepartitionPeriodeRequest) {
    return this.http.post<RepartitionPeriodeDto>(this.base(foyerId, scenarioId), req);
  }
  modifier(foyerId: string, scenarioId: string, id: string, req: RepartitionPeriodeRequest) {
    return this.http.put<RepartitionPeriodeDto>(`${this.base(foyerId, scenarioId)}/${id}`, req);
  }
  supprimer(foyerId: string, scenarioId: string, id: string) {
    return this.http.delete<void>(`${this.base(foyerId, scenarioId)}/${id}`);
  }
}

