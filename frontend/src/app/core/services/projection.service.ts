import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ProjectionAnnuelleDto, VentilationsDto, VentilationAnnuelleDto, EvenementDto, TauxEffortMembreDto,
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

  /** Décomposition annuelle agrégée (somme des 12 mois) en une seule requête serveur —
   *  remplace un `forkJoin` de 12 appels {@link mensuelle}, utilisé pour la vue annuelle
   *  du dashboard (onglets par catégorie / par compte / cascade). */
  ventilationAnnuelle(foyerId: string, scenarioId: string, annee: number) {
    return this.http.get<VentilationAnnuelleDto>(
      `${this.base(foyerId, scenarioId)}/ventilation-annuelle`, { params: { annee } }
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

  /** Indicateur 04 — Taux d'effort par membre pour un mois donné (normal + pire cas). */
  tauxEffort(foyerId: string, scenarioId: string, annee: number, mois: number) {
    return this.http.get<TauxEffortMembreDto[]>(
      `${this.base(foyerId, scenarioId)}/taux-effort`, { params: { annee, mois } }
    );
  }

  /** Indicateur 04 — Variante annuelle : agrégats normal/pire cas sommés sur les 12
   *  mois de l'année, utilisée par le dashboard annuel. */
  tauxEffortAnnuel(foyerId: string, scenarioId: string, annee: number) {
    return this.http.get<TauxEffortMembreDto[]>(
      `${this.base(foyerId, scenarioId)}/taux-effort-annuel`, { params: { annee } }
    );
  }
}
