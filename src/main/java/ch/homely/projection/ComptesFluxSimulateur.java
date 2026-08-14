package ch.homely.projection;

import ch.homely.compte.Compte;
import ch.homely.moteur.AggregatMensuel;
import ch.homely.moteur.DetailCompteMembre;
import ch.homely.moteur.MoteurCalcul;
import ch.homely.moteur.ParametresScenario;
import ch.homely.moteur.VentilationsCompteDetail;
import ch.homely.poche.ArgentPocheService;
import ch.homely.poche.ResolutionArgentPoche;

import java.time.YearMonth;
import java.util.*;

/**
 * Simulation mois-par-mois, à l'échelle du foyer (tous les comptes actifs), de la
 * trésorerie et des virements inter-comptes du dashboard "Comptes" (vue membre).
 *
 * <p>Réutilise {@link MoteurCalcul#ventilationsCompteMembreDetail} (prorata, fenêtres
 * de validité, mensualisé vs échu déjà gérés par le moteur pur) puis applique, en
 * couche service, la logique de <b>compte primaire</b> :</p>
 * <ul>
 *   <li>Pour chaque compte et chaque mois, un manque de trésorerie ("topUp") est
 *       calculé <b>au niveau du compte</b> (tous co-titulaires confondus) si la
 *       trésorerie cumulée du compte ne suffit pas à couvrir ses sorties échues du
 *       mois, une fois les virements planifiés (mensualisés) appliqués.</li>
 *   <li>La part de chaque co-titulaire dans le budget planifié et dans ce manque est
 *       répartie au prorata de sa quote-part effective (mensualisée pour le budget,
 *       échue pour le manque).</li>
 *   <li>Si un co-titulaire a désigné un compte primaire <b>différent</b> du compte
 *       courant : sa part est financée depuis ce primaire (virement entrant sur le
 *       compte cible, virement sortant sur le primaire).</li>
 *   <li>Si le compte courant EST le primaire du co-titulaire : sa part est déjà
 *       "chez elle", aucun virement n'est simulé.</li>
 *   <li>Si le co-titulaire n'a pas configuré de compte primaire (mode "legacy") : sa
 *       part planifiée (mensualisée) seule alimente virementsEntrants, sans
 *       comblement automatique — comportement strictement identique à avant
 *       l'introduction du compte primaire.</li>
 * </ul>
 *
 * <p><b>Vue membre</b> : le résultat exposé ({@link CompteFluxMensuel}) est <b>scopé
 * au membre demandé</b> — chaque montant (entrées, sorties, virements, solde restant)
 * ne reflète que sa propre part sur le compte, pas le flux de caisse réel total du
 * compte (qui regrouperait tous les co-titulaires). Le manque de trésorerie ("topUp")
 * reste calculé au niveau du compte entier (trésorerie cumulée totale du compte, tous
 * co-titulaires confondus) pour rester physiquement correct, mais cette trésorerie
 * cumulée totale n'est qu'un résultat intermédiaire interne — jamais exposée — et sert
 * uniquement à déterminer, mois après mois, les virements entrants/sortants simulés ;
 * seule la part du membre demandé dans ce comblement est restituée.</p>
 */
final class ComptesFluxSimulateur {

    private ComptesFluxSimulateur() {}

    /**
     * @param tousComptes        comptes actifs du foyer (périmètre complet, pas
     *                           seulement ceux du membre affiché — un virement sortant
     *                           peut financer un compte dont le membre affiché n'est
     *                           pas co-titulaire)
     * @param primairesParMembre membreId → compteId de son compte primaire (absent ou
     *                           {@code null} = pas de primaire configuré, mode legacy)
     * @param membreCible        membre dont on veut la part sur chaque compte (le
     *                           reste de la simulation, notamment le comblement de
     *                           trésorerie, considère toujours tous les co-titulaires)
     * @param argentPocheService résolution de l'argent de poche par (membre, mois) —
     *                           n'est pas un poste, donc absent du moteur pur ; injecté
     *                           ici pour fusionner son montant, sur le compte crédité,
     *                           dans la ventilation compte/membre avant simulation des
     *                           virements (sinon la trésorerie du compte cible ne
     *                           reflète jamais l'argent de poche qui y est versé)
     * @param scenarioId         scénario cible, requis par {@code argentPocheService}
     * @return pour chaque compte, la liste chronologique des flux mensuels — scopés à
     *         {@code membreCible} — depuis {@code params.anneeDepart()} jusqu'à
     *         {@code (anneeCible, moisCible)} inclus
     */
    static Map<UUID, List<CompteFluxMensuel>> simuler(
            ParametresScenario params,
            List<Compte> tousComptes,
            Map<UUID, UUID> primairesParMembre,
            UUID membreCible,
            int anneeCible, int moisCible,
            ArgentPocheService argentPocheService, UUID scenarioId) {

        Set<UUID> comptesActifsIds = new HashSet<>();
        Map<UUID, Double> cumulTotalParCompte = new LinkedHashMap<>();
        Map<UUID, List<CompteFluxMensuel>> resultat = new LinkedHashMap<>();
        for (Compte c : tousComptes) {
            comptesActifsIds.add(c.getId());
            cumulTotalParCompte.put(c.getId(), c.getSoldeInitial().doubleValue());
            resultat.put(c.getId(), new ArrayList<>());
        }

        int y = params.anneeDepart();
        int m = 1;
        while (y < anneeCible || (y == anneeCible && m <= moisCible)) {
            simulerMois(params, tousComptes, comptesActifsIds, primairesParMembre, membreCible,
                    cumulTotalParCompte, resultat, y, m, argentPocheService, scenarioId);
            if (m == 12) { m = 1; y++; } else { m++; }
        }

        return resultat;
    }

    private static void simulerMois(
            ParametresScenario params, List<Compte> tousComptes, Set<UUID> comptesActifsIds,
            Map<UUID, UUID> primairesParMembre, UUID membreCible,
            Map<UUID, Double> cumulTotalParCompte,
            Map<UUID, List<CompteFluxMensuel>> resultat, int annee, int mois,
            ArgentPocheService argentPocheService, UUID scenarioId) {

        VentilationsCompteDetail detail = MoteurCalcul.ventilationsCompteMembreDetail(params, annee, mois);
        Map<UUID, Map<UUID, DetailCompteMembre>> parCompteMembreDetail =
                fusionnerArgentPocheDansDetail(params, detail, argentPocheService, scenarioId, annee, mois);

        Map<UUID, Double> entreesParCompte = new HashMap<>();
        Map<UUID, Double> baseParCompte = new HashMap<>();
        Map<UUID, Double> echuParCompte = new HashMap<>();
        Map<UUID, Map<UUID, Double>> baseShareParCompte = new HashMap<>();
        Map<UUID, Map<UUID, Double>> echuShareParCompte = new HashMap<>();

        for (Compte c : tousComptes) {
            Map<UUID, DetailCompteMembre> parMembre = parCompteMembreDetail.getOrDefault(c.getId(), Map.of());
            double entrees = 0, base = 0, echu = 0;
            Map<UUID, Double> baseShares = new LinkedHashMap<>();
            Map<UUID, Double> echuShares = new LinkedHashMap<>();
            for (Map.Entry<UUID, DetailCompteMembre> e : parMembre.entrySet()) {
                DetailCompteMembre d = e.getValue();
                entrees += d.revenusEchu();
                base += d.chargesReservesMensualise();
                echu += d.chargesReservesEchu();
                baseShares.put(e.getKey(), d.chargesReservesMensualise());
                echuShares.put(e.getKey(), d.chargesReservesEchu());
            }
            entreesParCompte.put(c.getId(), entrees);
            baseParCompte.put(c.getId(), base);
            echuParCompte.put(c.getId(), echu);
            baseShareParCompte.put(c.getId(), baseShares);
            echuShareParCompte.put(c.getId(), echuShares);
        }

        // Manque de trésorerie ("topUp") par compte, tous co-titulaires confondus :
        // trésorerie cumulée totale avant ce mois + flux planifié (base − échu) ;
        // négatif => topUp nécessaire pour ramener à zéro.
        Map<UUID, Double> topUpParCompte = new HashMap<>();
        for (Compte c : tousComptes) {
            double treasoAvant = cumulTotalParCompte.get(c.getId());
            double flowAvant = treasoAvant + entreesParCompte.get(c.getId()) + baseParCompte.get(c.getId())
                    - echuParCompte.get(c.getId());
            topUpParCompte.put(c.getId(), Math.max(0, -flowAvant));
        }

        // Virements entrants/sortants : calculés au niveau du compte (tous
        // co-titulaires confondus, nécessaire pour chaîner correctement la trésorerie
        // totale du compte d'un mois sur l'autre) tout en capturant, au passage, la
        // part de membreCible dans chacun (seule celle-ci est restituée à l'appelant).
        Map<UUID, Double> virementsEntrantsTotalParCompte = new HashMap<>();
        Map<UUID, Double> virementsSortantsTotalParCompte = new HashMap<>();
        Map<UUID, Double> virementsEntrantsMembreParCompte = new HashMap<>();
        Map<UUID, Double> virementsSortantsMembreParCompte = new HashMap<>();
        for (Compte c : tousComptes) {
            virementsEntrantsTotalParCompte.put(c.getId(), 0.0);
            virementsSortantsTotalParCompte.put(c.getId(), 0.0);
            virementsEntrantsMembreParCompte.put(c.getId(), 0.0);
            virementsSortantsMembreParCompte.put(c.getId(), 0.0);
        }

        for (Compte c : tousComptes) {
            UUID compteId = c.getId();
            Map<UUID, Double> baseShares = baseShareParCompte.get(compteId);
            Map<UUID, Double> echuShares = echuShareParCompte.get(compteId);
            double totalBase = baseParCompte.get(compteId);
            double totalEchu = echuParCompte.get(compteId);
            double topUp = topUpParCompte.get(compteId);

            Set<UUID> membreIds = new LinkedHashSet<>();
            membreIds.addAll(baseShares.keySet());
            membreIds.addAll(echuShares.keySet());
            if (membreIds.isEmpty()) continue;

            for (UUID membreId : membreIds) {
                double baseShare = baseShares.getOrDefault(membreId, 0.0);
                double echuShare = echuShares.getOrDefault(membreId, 0.0);

                double baseProportion = totalBase != 0 ? baseShare / totalBase : 1.0 / membreIds.size();
                double echuProportion = totalEchu != 0 ? echuShare / totalEchu : baseProportion;
                double montantFinance = baseShare + topUp * echuProportion;

                UUID primaireId = primairesParMembre.get(membreId);
                boolean estMembreCible = membreId.equals(membreCible);

                if (primaireId == null || !comptesActifsIds.contains(primaireId)) {
                    // Mode legacy (pas de primaire configuré, ou primaire désactivé/introuvable) :
                    // comportement historique, budget planifié seul, pas de comblement automatique.
                    virementsEntrantsTotalParCompte.merge(compteId, baseShare, Double::sum);
                    if (estMembreCible) {
                        virementsEntrantsMembreParCompte.merge(compteId, baseShare, Double::sum);
                    }
                } else if (primaireId.equals(compteId)) {
                    // Auto-financé : ce compte EST le primaire du membre, l'argent y est déjà.
                    // (aucun virement à simuler pour cette part)
                } else {
                    virementsEntrantsTotalParCompte.merge(compteId, montantFinance, Double::sum);
                    virementsSortantsTotalParCompte.merge(primaireId, montantFinance, Double::sum);
                    if (estMembreCible) {
                        virementsEntrantsMembreParCompte.merge(compteId, montantFinance, Double::sum);
                        virementsSortantsMembreParCompte.merge(primaireId, montantFinance, Double::sum);
                    }
                }
            }
        }

        for (Compte c : tousComptes) {
            UUID compteId = c.getId();
            Map<UUID, DetailCompteMembre> parMembre = parCompteMembreDetail.getOrDefault(compteId, Map.of());
            DetailCompteMembre detailMembre = parMembre.getOrDefault(membreCible, DetailCompteMembre.zero());

            double entrees = detailMembre.revenusEchu();
            double sortiesPlanifiees = detailMembre.chargesReservesMensualise();
            double sortiesEchues = detailMembre.chargesReservesEchu();
            double virementsEntrants = virementsEntrantsMembreParCompte.get(compteId);
            double virementsSortants = virementsSortantsMembreParCompte.get(compteId);

            double soldeRestant = entrees + virementsEntrants - sortiesEchues - virementsSortants;

            // Trésorerie totale du compte (tous co-titulaires) : gardée uniquement pour
            // alimenter correctement le comblement des mois suivants, jamais exposée.
            double soldeRestantTotal = entreesParCompte.get(compteId) + virementsEntrantsTotalParCompte.get(compteId)
                    - echuParCompte.get(compteId) - virementsSortantsTotalParCompte.get(compteId);
            cumulTotalParCompte.put(compteId, cumulTotalParCompte.get(compteId) + soldeRestantTotal);

            resultat.get(compteId).add(new CompteFluxMensuel(
                    compteId, annee, mois, entrees, sortiesPlanifiees, sortiesEchues,
                    virementsEntrants, virementsSortants, soldeRestant));
        }
    }

    /**
     * Fusionne l'argent de poche résolu par membre (montant + compte crédité) dans la
     * ventilation compte/membre issue du moteur pur (qui ne connaît que les postes,
     * pas l'argent de poche). Traité comme un revenu de type "entrée" (mensualisé =
     * échu, aucun lissage n'existe pour l'argent de poche — le montant est déjà exact
     * pour ce mois) sur le compte crédité, pour le membre auquel appartient l'argent
     * de poche. Ne modifie pas {@code detail}, retourne une nouvelle map mutable.
     */
    private static Map<UUID, Map<UUID, DetailCompteMembre>> fusionnerArgentPocheDansDetail(
            ParametresScenario params, VentilationsCompteDetail detail,
            ArgentPocheService argentPocheService, UUID scenarioId, int annee, int mois) {

        Map<UUID, Map<UUID, DetailCompteMembre>> resultat = new LinkedHashMap<>();
        detail.parCompteMembre().forEach((compteId, memMap) -> resultat.put(compteId, new LinkedHashMap<>(memMap)));

        for (UUID membreId : params.membres()) {
            AggregatMensuel ag = MoteurCalcul.aggregatMembreMois(params, membreId, annee, mois);
            double ravBrut = ag.revenus() - ag.charges() - ag.reserves();
            ResolutionArgentPoche poche = argentPocheService.resoudre(scenarioId, membreId, YearMonth.of(annee, mois), ravBrut);
            if (poche.compteId() == null || poche.montant() <= 0) continue;

            DetailCompteMembre delta = new DetailCompteMembre(poche.montant(), poche.montant(), 0, 0);
            resultat.computeIfAbsent(poche.compteId(), k -> new LinkedHashMap<>())
                    .merge(membreId, delta, DetailCompteMembre::plus);
        }
        return resultat;
    }
}
