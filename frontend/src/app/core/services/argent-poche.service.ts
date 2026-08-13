import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  PolitiqueArgentPocheDto, PolitiqueArgentPocheRequest,
  AllocationArgentPocheDto, AllocationArgentPocheRequest,
  ResolutionArgentPocheDto, RavBrutMoisDto, ResolutionArgentPocheFoyerMoisDto,
} from '../models/api.models';

/**
 * Service HTTP typé de l'argent de poche (politiques récurrentes + allocations
 * ponctuelles + endpoint de résolution). Scopé foyer + scénario, en cohérence
 * avec {@link ObjectifService}.
 */
@Injectable({ providedIn: 'root' })
export class PolitiqueArgentPocheService {
  constructor(private http: HttpClient) {}
  private base(foyerId: string, scenarioId: string) {
    return `/api/foyers/${foyerId}/scenarios/${scenarioId}/argent-poche/politiques`;
  }
  lister(foyerId: string, scenarioId: string) {
    return this.http.get<PolitiqueArgentPocheDto[]>(this.base(foyerId, scenarioId));
  }
  creer(foyerId: string, scenarioId: string, req: PolitiqueArgentPocheRequest) {
    return this.http.post<PolitiqueArgentPocheDto>(this.base(foyerId, scenarioId), req);
  }
  modifier(foyerId: string, scenarioId: string, id: string, req: PolitiqueArgentPocheRequest) {
    return this.http.put<PolitiqueArgentPocheDto>(`${this.base(foyerId, scenarioId)}/${id}`, req);
  }
  supprimer(foyerId: string, scenarioId: string, id: string) {
    return this.http.delete<void>(`${this.base(foyerId, scenarioId)}/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class AllocationArgentPocheService {
  constructor(private http: HttpClient) {}
  private base(foyerId: string, scenarioId: string) {
    return `/api/foyers/${foyerId}/scenarios/${scenarioId}/argent-poche/allocations`;
  }
  lister(foyerId: string, scenarioId: string) {
    return this.http.get<AllocationArgentPocheDto[]>(this.base(foyerId, scenarioId));
  }
  /** Utilisé par l'action rapide du dashboard (PR6) pour précharger l'allocation
   *  existante (compte, raison) avant édition, l'id seul (fourni par la
   *  résolution) ne portant pas ces champs. */
  obtenir(foyerId: string, scenarioId: string, id: string) {
    return this.http.get<AllocationArgentPocheDto>(`${this.base(foyerId, scenarioId)}/${id}`);
  }
  creer(foyerId: string, scenarioId: string, req: AllocationArgentPocheRequest) {
    return this.http.post<AllocationArgentPocheDto>(this.base(foyerId, scenarioId), req);
  }
  modifier(foyerId: string, scenarioId: string, id: string, req: AllocationArgentPocheRequest) {
    return this.http.put<AllocationArgentPocheDto>(`${this.base(foyerId, scenarioId)}/${id}`, req);
  }
  supprimer(foyerId: string, scenarioId: string, id: string) {
    return this.http.delete<void>(`${this.base(foyerId, scenarioId)}/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class ResolutionArgentPocheService {
  constructor(private http: HttpClient) {}
  /**
   * Résolution du montant d'argent de poche pour un couple {@code (membre, mois)}.
   * Utilisé par le widget dashboard (PR5) et par la popin d'allocation pour
   * afficher la valeur "actuelle" issue de la politique en vigueur.
   *
   * @param mois au format ISO {@code "YYYY-MM"}
   */
  resoudre(foyerId: string, scenarioId: string, membreId: string, mois: string) {
    const params = new HttpParams().set('membreId', membreId).set('mois', mois);
    return this.http.get<ResolutionArgentPocheDto>(
      `/api/foyers/${foyerId}/scenarios/${scenarioId}/argent-poche/resolution`,
      { params },
    );
  }
  /**
   * Résolution sur 12 mois (une année complète) — évite le N+1 côté dashboard
   * lorsqu'on veut afficher le cumul annuel. Retourne les 12 mois {@code janvier→
   * décembre} dans l'ordre.
   */
  resoudreAnnee(foyerId: string, scenarioId: string, membreId: string, annee: number) {
    const params = new HttpParams().set('membreId', membreId).set('annee', annee);
    return this.http.get<ResolutionArgentPocheDto[]>(
      `/api/foyers/${foyerId}/scenarios/${scenarioId}/argent-poche/resolution-annee`,
      { params },
    );
  }
  /**
   * RàV <b>brut</b> (avant tout retrait d'argent de poche), sur 12 mois, pour un
   * membre — indépendant de toute politique/allocation persistée. Utilisé par
   * l'aperçu "6 prochains mois" de la popin politique : la formule (mode, socle,
   * pourcentage, plafond) du formulaire <b>en cours d'édition</b> est appliquée
   * côté client sur ces valeurs, pour prévisualiser une politique même non
   * encore enregistrée.
   */
  ravBrutAnnee(foyerId: string, scenarioId: string, membreId: string, annee: number) {
    const params = new HttpParams().set('membreId', membreId).set('annee', annee);
    return this.http.get<RavBrutMoisDto[]>(
      `/api/foyers/${foyerId}/scenarios/${scenarioId}/argent-poche/rav-brut`,
      { params },
    );
  }
  /**
   * Résolution d'argent de poche agrégée à l'échelle du foyer sur 12 mois —
   * somme des résolutions de tous les membres actifs du scénario. Utilisé par
   * le widget dashboard en mode <b>foyer</b> (KPI, graphique, barre).
   */
  resoudreFoyerAnnee(foyerId: string, scenarioId: string, annee: number) {
    const params = new HttpParams().set('annee', annee);
    return this.http.get<ResolutionArgentPocheFoyerMoisDto[]>(
      `/api/foyers/${foyerId}/scenarios/${scenarioId}/argent-poche/resolution-foyer-annee`,
      { params },
    );
  }
}
