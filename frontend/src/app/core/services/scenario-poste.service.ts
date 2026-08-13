import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ScenarioDto, ScenarioRequest, PosteDto, PosteRequest, PosteRevisionRequest, PosteRevisionResponse,
         PosteClotureRequest, PosteDecalerDateEffetRequest, PosteDecalerDateEffetResponse,
         PosteActionGroupeeRequest, PosteSuppressionGroupeeRequest, PostePositionneDto,
         BesoinsPlaisirsDto,
         ObjectifDto, ObjectifRequest, RepartitionPeriodeDto, RepartitionPeriodeRequest } from '../models/api.models';

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
  reviser(foyerId: string, scenarioId: string, posteId: string, req: PosteRevisionRequest) {
    return this.http.post<PosteRevisionResponse>(
      `${this.base(foyerId, scenarioId)}/${posteId}/reviser-montant`, req
    );
  }
  annulerRevision(foyerId: string, scenarioId: string, posteId: string) {
    return this.http.post<PosteDto>(
      `${this.base(foyerId, scenarioId)}/${posteId}/annuler-revision`, {}
    );
  }
  decalerDateEffet(foyerId: string, scenarioId: string, posteId: string, req: PosteDecalerDateEffetRequest) {
    return this.http.post<PosteDecalerDateEffetResponse>(
      `${this.base(foyerId, scenarioId)}/${posteId}/decaler-date-effet`, req
    );
  }
  cloturer(foyerId: string, scenarioId: string, posteId: string, req: PosteClotureRequest) {
    return this.http.post<PosteDto>(
      `${this.base(foyerId, scenarioId)}/${posteId}/cloturer`, req
    );
  }
  reactiver(foyerId: string, scenarioId: string, posteId: string) {
    return this.http.post<PosteDto>(
      `${this.base(foyerId, scenarioId)}/${posteId}/reactiver`, {}
    );
  }
  actionsGroupees(foyerId: string, scenarioId: string, req: PosteActionGroupeeRequest) {
    return this.http.post<PosteDto[]>(
      `${this.base(foyerId, scenarioId)}/actions-groupees`, req
    );
  }
  supprimerGroupe(foyerId: string, scenarioId: string, req: PosteSuppressionGroupeeRequest) {
    return this.http.post<void>(
      `${this.base(foyerId, scenarioId)}/supprimer-groupe`, req
    );
  }
  /** Matrice budgétaire "Nécessité vs Priorité d'action" (dashboard annuel et mensuel) :
   *  postes déjà filtrés (non obsolètes, dédupliqués par chaîne de révisions) et
   *  positionnés (scores 0-100, poids du montant, quadrant) côté serveur. `mois` absent
   *  -> cumul annuel ; sinon ne considère que ce mois (postes actifs ce mois-là,
   *  montant réel de ce seul mois). Si `membreId` est fourni, ne renvoie que les postes
   *  qui le concernent. */
  matriceBudgetaire(foyerId: string, scenarioId: string, annee: number, mois?: number, membreId?: string) {
    const params: Record<string, string | number> = { annee };
    if (mois !== undefined) { params['mois'] = mois; }
    if (membreId) { params['membreId'] = membreId; }
    return this.http.get<PostePositionneDto[]>(
      `${this.base(foyerId, scenarioId)}/matrice-budgetaire`, { params }
    );
  }
  /** Indicateur dashboard "Plaisirs vs Besoins" : répartition des charges pour la
   *  période demandée. `mois` absent -> cumul annuel ; sinon uniquement ce mois. Si
   *  `membreId` est fourni, ne compte que la quote-part effective du membre. */
  besoinsPlaisirs(foyerId: string, scenarioId: string, annee: number, mois?: number, membreId?: string) {
    const params: Record<string, string | number> = { annee };
    if (mois !== undefined) { params['mois'] = mois; }
    if (membreId) { params['membreId'] = membreId; }
    return this.http.get<BesoinsPlaisirsDto>(
      `${this.base(foyerId, scenarioId)}/besoins-plaisirs`, { params }
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

