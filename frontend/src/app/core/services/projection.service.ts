import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ProjectionAnnuelleDto, VentilationsDto, VentilationAnnuelleDto, EvenementDto, TauxEffortMembreDto,
  CompteRecapMensuelDto, ComptePosteDetailDto, ProrataPartageMembreDto,
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

  /** Récapitulatif mensuel de trésorerie par compte (dashboard, vue membre) : virements
   *  entrants simulés, entrées/sorties échues, solde restant. */
  comptesRecap(foyerId: string, scenarioId: string, annee: number, mois: number, membreId: string) {
    return this.http.get<CompteRecapMensuelDto[]>(
      `${this.base(foyerId, scenarioId)}/comptes-recap`, { params: { annee, mois, membreId } }
    );
  }

  /** Variante annuelle de {@link comptesRecap} (dashboard, vue membre annuelle) : flux
   *  sommés sur les 12 mois de l'année, solde restant = instantané fin décembre. */
  comptesRecapAnnuel(foyerId: string, scenarioId: string, annee: number, membreId: string) {
    return this.http.get<CompteRecapMensuelDto[]>(
      `${this.base(foyerId, scenarioId)}/comptes-recap-annuel`, { params: { annee, membreId } }
    );
  }

  /** Détail poste par poste (+ argent de poche éventuel) alimentant un compte donné —
   *  utilisé quand une carte de compte est sélectionnée dans la vue "Hub & Rayons". */
  comptePostes(foyerId: string, scenarioId: string, annee: number, mois: number, membreId: string, compteId: string) {
    return this.http.get<ComptePosteDetailDto[]>(
      `${this.base(foyerId, scenarioId)}/comptes-recap/postes`, { params: { annee, mois, membreId, compteId } }
    );
  }

  /** Indicateur "Prorata des postes partagés" — mois donné : prorata moyen appliqué
   *  (pondéré par montant) vs prorata théorique selon les revenus, par membre. */
  prorataPartage(foyerId: string, scenarioId: string, annee: number, mois: number) {
    return this.http.get<ProrataPartageMembreDto[]>(
      `${this.base(foyerId, scenarioId)}/prorata-partage`, { params: { annee, mois } }
    );
  }

  /** Indicateur "Prorata des postes partagés" — variante annuelle (somme des 12 mois). */
  prorataPartageAnnuel(foyerId: string, scenarioId: string, annee: number) {
    return this.http.get<ProrataPartageMembreDto[]>(
      `${this.base(foyerId, scenarioId)}/prorata-partage-annuel`, { params: { annee } }
    );
  }
}
