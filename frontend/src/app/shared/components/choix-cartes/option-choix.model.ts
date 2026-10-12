/** Option d'un groupe de choix (cartes ou puces). */
export interface OptionChoix<T> {
  readonly value: T;
  readonly titre: string;
  readonly sousTitre?: string;
  readonly desactive?: boolean;
  /** Couleur de pastille (couleur de membre, etc.) — seule exception au tout-token. */
  readonly couleur?: string;
  /**
   * Pastilles de rattachement affichées sous le titre (ex. les membres d'un
   * compte). Purement illustratives : leur libellé doit aussi figurer dans
   * `sousTitre` pour rester lisible sans la couleur.
   */
  readonly pastilles?: readonly { readonly couleur: string; readonly libelle: string }[];
}
