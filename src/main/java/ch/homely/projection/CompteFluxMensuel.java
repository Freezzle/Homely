package ch.homely.projection;

import java.util.UUID;

/**
 * Flux mensuel simulé d'un compte, scopé à un membre donné (dashboard "Comptes", vue
 * membre) — résultat intermédiaire de {@link ComptesFluxSimulateur}, après application
 * de la logique de compte primaire (virements entrants/sortants réels) ou du mode
 * "legacy" (pas de primaire configuré → virements entrants = charges/réserves
 * mensualisées uniquement, comme avant l'introduction du compte primaire).
 *
 * @param virementsEntrants montant réellement transféré vers ce compte ce mois pour la
 *                          part du membre (financée par un compte primaire externe, ou héritage "legacy")
 * @param virementsSortants montant que la part du membre sur ce compte doit fournir ce
 *                          mois pour financer ses propres postes ventilés ailleurs, dont ce compte est le primaire désigné
 * @param soldeRestant      entrees + virementsEntrants − sortiesEchues − virementsSortants
 * @param tresorerieCumulee part du membre dans soldeInitial(compte) (répartie à parts égales
 *                          entre co-titulaires) + Σ de ses soldeRestant mensuels depuis
 *                          l'origine du scénario jusqu'à ce mois inclus
 */
record CompteFluxMensuel(
        UUID compteId, int annee, int mois,
        double entrees, double sortiesPlanifiees, double sortiesEchues,
        double virementsEntrants, double virementsSortants,
        double soldeRestant, double tresorerieCumulee
) {}
