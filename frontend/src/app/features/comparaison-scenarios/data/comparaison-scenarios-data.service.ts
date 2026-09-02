import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { ProjectionService } from '../../../core/services/projection.service';
import { PosteService } from '../../../core/services/scenario-poste.service';
import { ResolutionArgentPocheService } from '../../../core/services/argent-poche.service';
import { VentilationsDto } from '../../../core/models/api.models';
import { Perimetre, ScenarioComparaisonData } from './comparaison-scenarios.models';
import { construireDonneesScenario } from './comparaison-scenarios.util';

/**
 * Orchestre les appels HTTP nécessaires à l'écran de comparaison, en ne consommant que
 * des endpoints déjà existants (aucune modification backend) : chaque endpoint scopé
 * `scenarioId` est simplement appelé une fois par scénario comparé (doc feature §10).
 */
@Injectable({ providedIn: 'root' })
export class ComparaisonScenariosDataService {
  private readonly projectionSvc = inject(ProjectionService);
  private readonly posteSvc = inject(PosteService);
  private readonly resolutionSvc = inject(ResolutionArgentPocheService);

  /** Données agrégées d'un scénario pour l'année/périmètre sélectionnés. */
  chargerScenario(foyerId: string, scenarioId: string, annee: number, perimetre: Perimetre): Observable<ScenarioComparaisonData> {
    const poche$ = perimetre === 'foyer'
      ? this.resolutionSvc.resoudreFoyerAnnee(foyerId, scenarioId, annee)
      : this.resolutionSvc.resoudreAnnee(foyerId, scenarioId, perimetre, annee);

    return forkJoin({
      projection: this.projectionSvc.annuelle(foyerId, scenarioId, annee),
      ventilation: this.projectionSvc.ventilationAnnuelle(foyerId, scenarioId, annee),
      postes: this.posteSvc.lister(foyerId, scenarioId),
      poche: poche$,
    }).pipe(
      map(({ projection, ventilation, postes, poche }) =>
        construireDonneesScenario(projection, ventilation, postes, poche, perimetre)),
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
