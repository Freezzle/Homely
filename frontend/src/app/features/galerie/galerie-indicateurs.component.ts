import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CarteInfoComponent } from '../../shared/components/carte-info/carte-info.component';
import {
  ElementComparaison,
  EtapeEntonnoir,
  IndicateurBarreEmpileeComponent,
  IndicateurBarresLigneComponent,
  IndicateurComparaisonComponent,
  IndicateurCourbesMultiplesComponent,
  IndicateurDonutComponent,
  IndicateurDoubleCourbeComponent,
  IndicateurEntonnoirComponent,
  IndicateurGaufreComponent,
  IndicateurHeatmapComponent,
  IndicateurHistogrammeComponent,
  IndicateurNiveauComponent,
  IndicateurNombreTendanceComponent,
  IndicateurProgressionComponent,
  IndicateurSparklineComponent,
  LigneBarresLigne,
  SegmentBarresLigne,
  SerieCourbe,
} from '../../shared/components/indicateurs';

/**
 * Galerie du design system : un exemple de chaque `app-indicateur-*` dans la carte
 * standard `app-carte-info`, plus des conteneurs large et étroit pour contrôler les
 * container queries. Page de démonstration interne (route publique `/galerie`) : ses
 * libellés sont volontairement en dur, seule exception assumée à la règle « tout en
 * clés i18n » — aucune donnée réelle n'y transite.
 */
@Component({
  selector: 'app-galerie-indicateurs',
  standalone: true,
  imports: [
    CarteInfoComponent,
    IndicateurHistogrammeComponent,
    IndicateurDonutComponent,
    IndicateurHeatmapComponent,
    IndicateurNombreTendanceComponent,
    IndicateurProgressionComponent,
    IndicateurSparklineComponent,
    IndicateurComparaisonComponent,
    IndicateurBarreEmpileeComponent,
    IndicateurNiveauComponent,
    IndicateurDoubleCourbeComponent,
    IndicateurEntonnoirComponent,
    IndicateurGaufreComponent,
    IndicateurCourbesMultiplesComponent,
    IndicateurBarresLigneComponent,
  ],
  templateUrl: './galerie-indicateurs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalerieIndicateursComponent {
  readonly valeurs = [4200, 5100, 3800, 6200, 5900, 7100, 4400, 5200, 6800, 7300, 5000, 6100];
  readonly libelles = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  readonly serie = [12, 18, 15, 22, 19, 28, 24, 31, 27, 35, 30, 38];
  readonly seriePrecedente = [14, 16, 17, 19, 21, 22, 23, 25, 24, 26, 28, 29];

  readonly segments = [
    { libelle: 'Logement', valeur: 34 },
    { libelle: 'Impôts', valeur: 27 },
    { libelle: 'Alimentation', valeur: 19 },
    { libelle: 'Santé', valeur: 12 },
    { libelle: 'Transport', valeur: 8 },
  ];

  readonly cellules = this.libelles.map((libelle, index) => ({
    libelle,
    ton: (['succes', 'info', 'attention', 'danger'] as const)[index % 4],
    infobulle: `Mois ${libelle}`,
  }));

  readonly legendeHeatmap = [
    { libelle: 'Sain', ton: 'succes' as const },
    { libelle: 'Correct', ton: 'info' as const },
    { libelle: 'Attention', ton: 'attention' as const },
    { libelle: 'Déficit', ton: 'danger' as const },
  ];

  /** Illustre le ton et la valeur secondaire par étape (usage réel : carte « Répartition »). */
  readonly etapes: EtapeEntonnoir[] = [
    { libelle: 'Revenus', valeurAffichee: "11'230.00 CHF", valeurSecondaire: '100%', largeurPourcent: 100, ton: 'revenu' },
    { libelle: 'Charges', valeurAffichee: "5'222.67 CHF", valeurSecondaire: '47%', largeurPourcent: 47, ton: 'charge' },
    { libelle: 'Réserves', valeurAffichee: '410.00 CHF', valeurSecondaire: '4%', largeurPourcent: 4, ton: 'reserve' },
    { libelle: 'Argent de poche', valeurAffichee: '300.00 CHF', valeurSecondaire: '3%', largeurPourcent: 3, ton: 'argent-poche' },
    { libelle: 'Solde restant', valeurAffichee: "5'297.33 CHF", valeurSecondaire: '47%', largeurPourcent: 47, ton: 'neutre' },
  ];

  readonly segmentsGaufre = [
    { libelle: 'Besoins', compte: 42 },
    { libelle: 'Plaisirs', compte: 20 },
    { libelle: 'Épargne', compte: 18 },
  ];

  /** Mode tableau (usage réel : carte « Comparaison de période » de l'Aperçu). */
  readonly elementsComparaison: ElementComparaison[] = [
    { cle: 'revenus', libelle: 'Revenus', valeurPrecedente: "11'230 CHF", valeurActuelle: "11'480 CHF", delta: 0.022, ton: 'revenu' },
    { cle: 'charges', libelle: 'Charges', valeurPrecedente: "5'223 CHF", valeurActuelle: "5'610 CHF", delta: 0.074, inverserDelta: true, ton: 'charge' },
    { cle: 'reserves', libelle: 'Réserves', valeurPrecedente: '410 CHF', valeurActuelle: '410 CHF', delta: 0, ton: 'reserve' },
    { cle: 'poche', libelle: 'Argent de poche', valeurPrecedente: '—', valeurActuelle: '300 CHF', delta: null, ton: 'argent-poche' },
    { cle: 'solde', libelle: 'Solde restant', valeurPrecedente: "5'297 CHF", valeurActuelle: "5'160 CHF", delta: -0.026, ton: 'neutre' },
  ];

  readonly moisComplets = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  private readonly revenusMois = [9800, 10200, 9600, 11400, 10100, 10300, 9900, 10500, 10200, 11800, 10400, 10600];
  private readonly chargesMois = [8100, 9500, 8300, 8600, 9600, 8500, 9200, 8400, 9700, 9000, 8700, 9900];
  private readonly reservesMois = [700, 800, 750, 850, 900, 750, 900, 750, 950, 800, 750, 1000];
  private readonly pocheMois = [400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400];

  // Cumuls successifs : chaque courbe inclut les types précédents, la dernière porte donc
  // le total des sorties.
  private readonly cumulReservesMois = this.chargesMois.map((c, i) => c + this.reservesMois[i]);
  private readonly sortiesMois = this.cumulReservesMois.map((c, i) => c + this.pocheMois[i]);

  /** Usage réel : carte « Flux mensuel » de l'Aperçu (une courbe cumulée par type de sortie). */
  readonly seriesFlux: SerieCourbe[] = [
    { cle: 'revenus', libelle: 'Revenus', valeurs: this.revenusMois, ton: 'revenu' },
    { cle: 'charges', libelle: 'Charges', valeurs: this.chargesMois, ton: 'charge', epaisseur: 1.6, tiret: '4 3', legendeTiret: true },
    { cle: 'reserves', libelle: 'Réserves', valeurs: this.cumulReservesMois, ton: 'reserve', epaisseur: 1.6, tiret: '2 3', legendeTiret: true },
    { cle: 'poche', libelle: 'Argent de poche', valeurs: this.sortiesMois, ton: 'argent-poche', epaisseur: 2, tiret: '6 3', legendeTiret: true },
  ];

  /** La zone se lit entre les revenus et le cumul le plus haut (= total des sorties). */
  readonly paireFlux: [number, number] = [0, 3];

  readonly moisDeficitaires = this.revenusMois
    .map((revenu, index) => (this.sortiesMois[index] > revenu ? index : -1))
    .filter((index) => index >= 0);

  /** Usage réel : carte « Flux mensuel » de l'Aperçu (sorties empilées, revenus en ligne). */
  readonly segmentsFlux: SegmentBarresLigne[] = [
    { cle: 'charges', libelle: 'Charges', valeurs: this.chargesMois, ton: 'charge' },
    { cle: 'reserves', libelle: 'Réserves', valeurs: this.reservesMois, ton: 'reserve' },
    { cle: 'poche', libelle: 'Argent de poche', valeurs: this.pocheMois, ton: 'argent-poche' },
  ];

  readonly ligneFlux: LigneBarresLigne = { libelle: 'Revenus', valeurs: this.revenusMois, ton: 'revenu' };

  /** Variante « référence » : sous-catégorie en nuance claire et ligne de budget en pointillés. */
  readonly segmentsBudget: SegmentBarresLigne[] = [
    { cle: 'fixes', libelle: 'Charges fixes', valeurs: this.chargesMois.map((c) => Math.round(c * 0.7)), ton: 'charge' },
    { cle: 'variables', libelle: 'Charges variables', valeurs: this.chargesMois.map((c) => Math.round(c * 0.3)), ton: 'charge', intensite: 32 },
  ];

  readonly ligneBudget: LigneBarresLigne = {
    libelle: 'Budget',
    valeurs: this.chargesMois.map(() => 9000),
    ton: 'neutre',
    tiret: '5 4',
  };

  /** Les trois derniers mois de l'exemple sont prévisionnels (barres atténuées). */
  readonly moisPrevisionnels = [9, 10, 11];
}
