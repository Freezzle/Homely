import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { ProjectionService } from '../../../core/services/projection.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { VentilationsDto } from '../../../core/models/api.models';
import { Perimetre, ScenarioComparaisonData } from './comparaison-scenarios.models';
import { construireDonneesScenario } from './comparaison-scenarios.util';

/**
 * Orchestre les appels HTTP nécessaires à l'écran de comparaison, en ne consommant que
 * des endpoints déjà existants (aucune modification backend) : chaque endpoint scopé
 * `scenarioId` est simplement appelé une fois par scénario comparé (doc feature §10).
 *
 * L'argent de poche n'est **pas** re-fetché depuis `/argent-poche/resolution-*` : il est
 * dérivé du même agrégat de projection (`ravBrut − soldeDisponible`) pour garantir que
 * la cascade budgétaire (§7) reste arithmétiquement cohérente (`Rev − Ch − Res = RàV`,
 * `RàV − Poche = Solde`) — sinon un écart d'arrondi entre les deux endpoints casserait
 * les équations affichées.
 */
@Injectable({ providedIn: 'root' })
export class ComparaisonScenariosDataService {
  private readonly projectionSvc = inject(ProjectionService);
  private readonly posteSvc = inject(PosteService);

  /** Données agrégées d'un scénario pour l'année/périmètre sélectionnés. */
  chargerScenario(foyerId: string, scenarioId: string, annee: number, perimetre: Perimetre): Observable<ScenarioComparaisonData> {
    return forkJoin({
      projection: this.projectionSvc.annuelle(foyerId, scenarioId, annee),
      ventilation: this.projectionSvc.ventilationAnnuelle(foyerId, scenarioId, annee),
      postes: this.posteSvc.lister(foyerId, scenarioId),
    }).pipe(
      map(({ projection, ventilation, postes }) =>
        construireDonneesScenario(projection, ventilation, postes, perimetre)),
    );
  }

  /** Détail mensuel par catégorie des 12 mois de l'année — nécessaire à la carte de
   *  chaleur (doc feature §8), non couvert par la ventilation annuelle agrégée. */
  chargerVentilationsMensuelles(foyerId: string, scenarioId: string, annee: number): Observable<VentilationsDto[]> {
    const appels = Array.from({ length: 12 }, (_, i) =>
      this.projectionSvc.mensuelle(foyerId, scenarioId, annee, i + 1));
    return forkJoin(appels);
  }
}
