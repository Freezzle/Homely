export interface TimelineItem {
  when: string;
  /** Classe d'icône PrimeNG sans le préfixe `pi-` (ex. `calendar-plus`). */
  icon?: string;
  /** Variante de couleur de l'icône : succès (vert), danger (rouge), secondaire (gris). */
  iconVariant?: 'success' | 'danger' | 'secondary';
  title: string;
  impact?: number;
  /** Le changement est-il favorable pour le foyer (gain) ? Pilote la couleur du montant
   *  indépendamment du signe mathématique affiché (ex. une charge qui augmente est
   *  défavorable même si le montant affiché est positif). */
  favorable?: boolean;
  /** Suffixe de périodicité affiché après le montant (ex. `/mois`, `/3mois`, `/ponctuel`). */
  suffixe?: string;
  /** Texte secondaire discret (ex. montant plein + périodicité réelle pour un poste
   *  mensualisé périodique — « 300 CHF tous les 3 mois »). */
  montantSecondaire?: string;
  /** Pour une REVISION : montant "avant" déjà formaté (ex. "1000/mois"), affiché en texte
   *  neutre. Quand défini (avec `montantApresLabel`), remplace l'affichage `impact`/`suffixe`. */
  montantAvantLabel?: string;
  /** Pour une REVISION : montant "après" déjà formaté (ex. "1200/mois"), coloré selon
   *  `favorable`. */
  montantApresLabel?: string;
  /** Clé de regroupement : les items consécutifs (déjà triés) partageant la même clé sont
   *  fusionnés en un seul point de la timeline. Par défaut, `when` est utilisé comme clé. */
  groupKey?: string | number;
}
