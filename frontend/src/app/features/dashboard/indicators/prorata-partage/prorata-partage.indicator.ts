import { Indicator } from '../../shared/models/indicator.model';
import { SegmentBarreEmpilee } from '../../../../shared/components/indicateurs/barre-empilee/indicateur-barre-empilee.component';
import { tonCategorie } from '../../../../shared/components/indicateurs/tons';
import { ProrataPartageMembreDto } from '../../../../core/models/api.models';
import { ProrataPartageDrawerContentComponent } from './prorata-partage-drawer-content.component';
import { AppTranslations } from '../../../../core/i18n/i18n.types';
import { formatTaux } from '../../../../shared/utils/format-taux.util';

/** Vrai si au moins un membre a des postes CHARGE/RESERVE partagés sur la période —
 *  utilisé par le dashboard pour masquer entièrement l'indicateur sinon (ex. foyer
 *  mono-membre, ou aucun poste partagé défini). */
export function aDesDonneesProrataPartage(dtos: ProrataPartageMembreDto[] | null | undefined): boolean {
  return (dtos ?? []).some((d) => d.aDesPostesPartages);
}

/**
 * Construit la carte + drawer de l'indicateur "Prorata des postes partagés", à partir des
 * données déjà résolues (`ProrataPartageMembreDto[]`). Visuel : deux barres empilées
 * comparables — prorata moyen appliqué vs prorata théorique selon les revenus — avec un
 * ton catégoriel stable par membre (même rang dans les deux barres). Drawer : tableau
 * détaillé par membre.
 */
export function prorataPartageIndicator(cle: string, dtos: ProrataPartageMembreDto[], t: AppTranslations): Indicator {
  const segments = (part: (d: ProrataPartageMembreDto) => number | null): SegmentBarreEmpilee[] =>
    dtos
      .map((d, index) => ({ d, index, valeur: part(d) }))
      .filter((x): x is { d: ProrataPartageMembreDto; index: number; valeur: number } => x.valeur != null)
      .map(({ d, index, valeur }) => ({
        libelle: d.nomMembre ?? '',
        valeur: valeur * 100,
        ton: tonCategorie(index),
        infobulle: `${d.nomMembre ?? ''} · ${formatTaux(valeur * 100)}%`,
      }));

  const appliques = segments((d) => (d.aDesPostesPartages ? d.prorataMoyenApplique : null));
  const theoriques = segments((d) => d.prorataTheoriqueRevenu);

  return {
    key: cle,
    title: t.dashboard.indicateurProrataPartageTitre,
    subtitle: t.dashboard.indicateurProrataPartageSousTitre,
    visuel: {
      type: 'barres-empilees',
      barres: [
        { libelle: t.dashboard.prorataPartageColonneApplique, segments: appliques },
        ...(theoriques.length ? [{ libelle: t.dashboard.prorataPartageColonneTheorique, segments: theoriques }] : []),
      ],
    },
    drawerContent: ProrataPartageDrawerContentComponent,
  };
}
