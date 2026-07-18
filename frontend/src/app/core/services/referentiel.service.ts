import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  FoyerDto, FoyerRequest, FoyerOnboardingRequest, FoyerOnboardingResponse,
  AccesFoyerDto, InviterAccesRequest, ChangerRoleRequest,
  MembreDto, MembreRequest,
  CompteDto, CompteRequest,
  CategorieDto, CategorieRequest, TypeCategorie,
  ActifDto, ActifRequest,
  TauxChangeDto, TauxChangeRequest,
} from '../models/api.models';

/** T9.3 — Services HTTP référentiels scopés par foyer. */

@Injectable({ providedIn: 'root' })
export class FoyerService {
  constructor(private http: HttpClient) {}
  lister() { return this.http.get<FoyerDto[]>('/api/foyers'); }
  obtenir(id: string) { return this.http.get<FoyerDto>(`/api/foyers/${id}`); }
  creer(req: FoyerRequest) { return this.http.post<FoyerDto>('/api/foyers', req); }
  modifier(id: string, req: FoyerRequest) { return this.http.put<FoyerDto>(`/api/foyers/${id}`, req); }
  supprimer(id: string) { return this.http.delete<void>(`/api/foyers/${id}`); }
  onboarding(req: FoyerOnboardingRequest) { return this.http.post<FoyerOnboardingResponse>('/api/foyers/onboarding', req); }
  listerAcces(foyerId: string) { return this.http.get<AccesFoyerDto[]>(`/api/foyers/${foyerId}/acces`); }
  inviter(foyerId: string, req: InviterAccesRequest) { return this.http.post<AccesFoyerDto>(`/api/foyers/${foyerId}/acces`, req); }
  changerRole(foyerId: string, accesId: string, req: ChangerRoleRequest) { return this.http.patch<AccesFoyerDto>(`/api/foyers/${foyerId}/acces/${accesId}`, req); }
  retirerAcces(foyerId: string, accesId: string) { return this.http.delete<void>(`/api/foyers/${foyerId}/acces/${accesId}`); }
}

@Injectable({ providedIn: 'root' })
export class MembreService {
  constructor(private http: HttpClient) {}
  lister(foyerId: string) { return this.http.get<MembreDto[]>(`/api/foyers/${foyerId}/membres`); }
  creer(foyerId: string, req: MembreRequest) { return this.http.post<MembreDto>(`/api/foyers/${foyerId}/membres`, req); }
  modifier(foyerId: string, id: string, req: MembreRequest) { return this.http.put<MembreDto>(`/api/foyers/${foyerId}/membres/${id}`, req); }
  supprimer(foyerId: string, id: string) { return this.http.delete<void>(`/api/foyers/${foyerId}/membres/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class CompteService {
  constructor(private http: HttpClient) {}
  lister(foyerId: string) { return this.http.get<CompteDto[]>(`/api/foyers/${foyerId}/comptes`); }
  creer(foyerId: string, req: CompteRequest) { return this.http.post<CompteDto>(`/api/foyers/${foyerId}/comptes`, req); }
  modifier(foyerId: string, id: string, req: CompteRequest) { return this.http.put<CompteDto>(`/api/foyers/${foyerId}/comptes/${id}`, req); }
  supprimer(foyerId: string, id: string) { return this.http.delete<void>(`/api/foyers/${foyerId}/comptes/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class CategorieService {
  constructor(private http: HttpClient) {}
  lister(foyerId: string, typePoste?: TypeCategorie) {
    let params = new HttpParams();
    if (typePoste) params = params.set('typePoste', typePoste);
    return this.http.get<CategorieDto[]>(`/api/foyers/${foyerId}/categories`, { params });
  }
  creer(foyerId: string, req: CategorieRequest) { return this.http.post<CategorieDto>(`/api/foyers/${foyerId}/categories`, req); }
  modifier(foyerId: string, id: string, req: CategorieRequest) { return this.http.put<CategorieDto>(`/api/foyers/${foyerId}/categories/${id}`, req); }
  supprimer(foyerId: string, id: string, migrerVersCategorieId?: string) {
    let params = new HttpParams();
    if (migrerVersCategorieId) params = params.set('migrerVersCategorieId', migrerVersCategorieId);
    return this.http.delete<void>(`/api/foyers/${foyerId}/categories/${id}`, { params });
  }
}

@Injectable({ providedIn: 'root' })
export class ActifService {
  constructor(private http: HttpClient) {}
  lister(foyerId: string) { return this.http.get<ActifDto[]>(`/api/foyers/${foyerId}/actifs`); }
  creer(foyerId: string, req: ActifRequest) { return this.http.post<ActifDto>(`/api/foyers/${foyerId}/actifs`, req); }
  modifier(foyerId: string, id: string, req: ActifRequest) { return this.http.put<ActifDto>(`/api/foyers/${foyerId}/actifs/${id}`, req); }
  supprimer(foyerId: string, id: string) { return this.http.delete<void>(`/api/foyers/${foyerId}/actifs/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class TauxChangeService {
  constructor(private http: HttpClient) {}
  lister(foyerId: string) { return this.http.get<TauxChangeDto[]>(`/api/foyers/${foyerId}/taux-change`); }
  creerOuModifier(foyerId: string, req: TauxChangeRequest) { return this.http.put<TauxChangeDto>(`/api/foyers/${foyerId}/taux-change`, req); }
  supprimer(foyerId: string, id: string) { return this.http.delete<void>(`/api/foyers/${foyerId}/taux-change/${id}`); }
}
