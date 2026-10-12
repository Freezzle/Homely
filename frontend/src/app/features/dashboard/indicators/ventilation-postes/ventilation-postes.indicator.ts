import { Indicator } from '../../shared/models/indicator.model';
import { VentilationPostesDrawerContentComponent } from './ventilation-postes-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';
import { FormateurMontant, segmentsProportionnels } from '../visuel-indicateur.util';

export interface AgregatVentilation {
  revenus: number;
  charges: number;
  reserves: number;
  soldeDisponible: number;
}

/**
 * Construit la carte + drawer de l'indicateur "Ventilations des postes", à partir de
 * l'agrégat déjà calculé (`agregatMoisCourant()/agregatAnneeCourant()`) et de l'argent de
 * poche du sujet. Visuel : barre empilée du revenu (Charges / Réserves / Argent de poche /
 * Solde restant) ; chaque segment porte le ton de son type de poste, le solde restant
 * reste **neutre** (c'est un résultat, pas un jugement — même convention que l'entonnoir
 * « Répartition » et le tableau « Comparaison de période »). Seul le badge juge le solde
 * (`succes`/`danger` selon son signe). L'argent de poche est déjà déduit de
 * `soldeDisponible` côté moteur, les segments ne se recouvrent donc pas.
 */
export function ventilationPostesIndicator(
  cle: string,
  agregat: AgregatVentilation,
  argentPoche: number,
  formatMontant: FormateurMontant,
  t: AppTranslations,
): Indicator {
  const segments = segmentsProportionnels(
    [
      { libelle: t.dashboard.chargesSures, montant: agregat.charges, ton: 'charge' },
      { libelle: t.dashboard.reserves, montant: agregat.reserves, ton: 'reserve' },
      { libelle: t.dashboard.argentPocheMois, montant: argentPoche, ton: 'argent-poche' },
      { libelle: t.dashboard.soldeRestant, montant: agregat.soldeDisponible, ton: 'neutre' },
    ],
    agregat.revenus,
    formatMontant,
  );

  return {
    key: cle,
    title: t.dashboard.indicateurVentilationPostesTitre,
    subtitle: t.dashboard.indicateurVentilationPostesSousTitre,
    badgeTexte: formatMontant(agregat.soldeDisponible),
    badgeTon: agregat.soldeDisponible >= 0 ? 'succes' : 'danger',
    visuel: segments.length
      ? { type: 'barre-empilee', segments }
      : { type: 'vide', message: t.dashboard.indicateurAucuneDonnee },
    drawerContent: VentilationPostesDrawerContentComponent,
  };
}
