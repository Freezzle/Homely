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

/**
 * Base commune aux services REST référentiels dont le CRUD suit exactement le patron
 * `GET/POST/PUT/DELETE /api/foyers/{foyerId}/<ressource>[/{id}]` (ex. membres, comptes,
 * actifs). Mutualise ce squelette identique, auparavant recopié dans chaque service ;
 * les services aux besoins spécifiques (paramètres de requête, upsert...) restent
 * autonomes (voir `CategorieService`, `TauxChangeService`).
 */
abstract class RestCrudService<T, TReq> {
  protected constructor(
    private readonly http: HttpClient,
    private readonly ressourcePath: string,
  ) {}

  private urlListe(foyerId: string): string {
    return `/api/foyers/${foyerId}/${this.ressourcePath}`;
  }

  lister(foyerId: string) { return this.http.get<T[]>(this.urlListe(foyerId)); }
  creer(foyerId: string, req: TReq) { return this.http.post<T>(this.urlListe(foyerId), req); }
  modifier(foyerId: string, id: string, req: TReq) { return this.http.put<T>(`${this.urlListe(foyerId)}/${id}`, req); }
  supprimer(foyerId: string, id: string) { return this.http.delete<void>(`${this.urlListe(foyerId)}/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class FoyerService {
  constructor(private http: HttpClient) {}
  lister() { return this.http.get<FoyerDto[]>('/api/foyers'); }
  obtenir(id: string) { return this.http.get<FoyerDto>(`/api/foyers/${id}`); }
  modifier(id: string, req: FoyerRequest) { return this.http.put<FoyerDto>(`/api/foyers/${id}`, req); }
  supprimer(id: string) { return this.http.delete<void>(`/api/foyers/${id}`); }
  onboarding(req: FoyerOnboardingRequest) { return this.http.post<FoyerOnboardingResponse>('/api/foyers/onboarding', req); }
  listerAcces(foyerId: string) { return this.http.get<AccesFoyerDto[]>(`/api/foyers/${foyerId}/acces`); }
  inviter(foyerId: string, req: InviterAccesRequest) { return this.http.post<AccesFoyerDto>(`/api/foyers/${foyerId}/acces`, req); }
  changerRole(foyerId: string, accesId: string, req: ChangerRoleRequest) { return this.http.patch<AccesFoyerDto>(`/api/foyers/${foyerId}/acces/${accesId}`, req); }
  retirerAcces(foyerId: string, accesId: string) { return this.http.delete<void>(`/api/foyers/${foyerId}/acces/${accesId}`); }
}

@Injectable({ providedIn: 'root' })
export class MembreService extends RestCrudService<MembreDto, MembreRequest> {
  constructor(http: HttpClient) { super(http, 'membres'); }
}

@Injectable({ providedIn: 'root' })
export class CompteService extends RestCrudService<CompteDto, CompteRequest> {
  constructor(http: HttpClient) { super(http, 'comptes'); }
}

@Injectable({ providedIn: 'root' })
export class ActifService extends RestCrudService<ActifDto, ActifRequest> {
  constructor(http: HttpClient) { super(http, 'actifs'); }
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
export class TauxChangeService {
  constructor(private http: HttpClient) {}
  lister(foyerId: string) { return this.http.get<TauxChangeDto[]>(`/api/foyers/${foyerId}/taux-change`); }
  creerOuModifier(foyerId: string, req: TauxChangeRequest) { return this.http.put<TauxChangeDto>(`/api/foyers/${foyerId}/taux-change`, req); }
  supprimer(foyerId: string, id: string) { return this.http.delete<void>(`/api/foyers/${foyerId}/taux-change/${id}`); }
}
