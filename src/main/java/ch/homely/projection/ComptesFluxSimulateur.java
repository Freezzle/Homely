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
 *   <li>Si le compte crédité a un ou plusieurs co-titulaires <b>autres</b> que le
 *       contributeur, et qu'aucun d'eux n'a lui-même de part active sur ce compte ce
 *       mois (ni poste ventilé, ni argent de poche crédité là où le compte est leur
 *       propre primaire) : le montant financé est restitué comme virement entrant à la
 *       fois au contributeur (sa propre part financée depuis son propre primaire) et à
 *       ce(s) co-titulaire(s) (l'argent devient réellement disponible sur son compte —
 *       que celui-ci soit ou non son primaire désigné, ex. transfert vers le compte
 *       courant ou l'épargne d'un autre membre). Ce sont des vues distinctes du même
 *       montant réel — jamais sommées entre elles côté UI, chacune scopée à son propre
 *       {@code membreCible}. Un co-titulaire déjà actif sur ce compte (ex. compte joint
 *       à prorata, où chacun ventile lui-même sur le même compte) garde sa vue
 *       strictement scopée à sa propre part, sans cette restitution supplémentaire.</li>
 * </ul>
 *
 * <p>L'<b>argent de poche</b> (résolu par {@link ArgentPocheService}, hors moteur pur) suit
 * exactement la même règle de compte primaire que les postes : si le compte crédité par la
 * politique/allocation diffère du primaire du membre, le montant est financé depuis ce
 * primaire (virement entrant sur le compte crédité, sortant sur le primaire) plutôt que de
 * matérialiser l'argent directement sur le compte crédité. Dans tous les cas, elle est comptée
 * comme une <b>dépense</b> (charge) du compte crédité, jamais comme un revenu — c'est de
 * l'argent qui quitte le budget du foyer pour la consommation personnelle du membre.</p>
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
     *                           ici pour appliquer la même règle de compte primaire que
     *                           les postes (financement depuis le primaire si le compte
     *                           crédité en diffère, sinon crédit direct)
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
        Map<UUID, Map<UUID, DetailCompteMembre>> parCompteMembreDetail = new LinkedHashMap<>();
        detail.parCompteMembre().forEach((compteId, memMap) -> parCompteMembreDetail.put(compteId, new LinkedHashMap<>(memMap)));

        // Compte → membres co-titulaires (depuis Compte.getMembres()) : permet, quand un AUTRE
        // membre finance ce compte (ventilation d'un poste chez lui, ou argent de poche crédité
        // là-bas) — que ce compte soit ou non le primaire désigné d'un co-titulaire — de
        // restituer le virement entrant également à ce(s) co-titulaire(s), pas seulement au
        // contributeur. Voir la règle complète plus bas (membresActifsParCompte).
        Map<UUID, Set<UUID>> coTitulairesParCompte = new HashMap<>();
        for (Compte c : tousComptes) {
            Set<UUID> ids = new HashSet<>();
            c.getMembres().forEach(m -> ids.add(m.getId()));
            coTitulairesParCompte.put(c.getId(), ids);
        }

        // Argent de poche crédité directement (auto-financé ou mode legacy) : fusionné tout de
        // suite dans la ventilation, comme un poste dont le compte primaire du membre EST le
        // compte crédité. Le reste (financé depuis un primaire différent) est restitué pour être
        // traité comme un virement, après le calcul des virements planifiés (postes) ci-dessous.
        List<PocheAFinancer> pochesAFinancer = fusionnerArgentPocheDansDetail(
                params, parCompteMembreDetail, argentPocheService, scenarioId, annee, mois,
                primairesParMembre, comptesActifsIds);

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

        // Compte → membres ayant, ce mois, une part active dessus (poste ventilé et/ou argent de
        // poche crédité là où le compte est leur propre primaire) : sert à décider, pour un
        // co-titulaire du compte crédité qui n'y contribue lui-même en rien ce mois, s'il faut lui
        // restituer aussi le virement entrant d'un AUTRE membre (voir plus bas). Un co-titulaire
        // déjà actif sur ce compte garde sa vue strictement scopée à sa propre part (ex. compte
        // joint à prorata, où chacun ventile lui-même sur le même compte) — comportement inchangé.
        Map<UUID, Set<UUID>> membresActifsParCompte = new HashMap<>();
        for (Compte c : tousComptes) {
            Set<UUID> actifs = new HashSet<>();
            actifs.addAll(baseShareParCompte.get(c.getId()).keySet());
            actifs.addAll(echuShareParCompte.get(c.getId()).keySet());
            membresActifsParCompte.put(c.getId(), actifs);
        }
        for (PocheAFinancer p : pochesAFinancer) {
            membresActifsParCompte.computeIfAbsent(p.compteCible(), k -> new HashSet<>()).add(p.membreId());
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
                    // Un co-titulaire du compte crédité, non actif lui-même dessus ce mois (voir
                    // membresActifsParCompte), voit cet argent arriver réellement sur son compte —
                    // que ce compte soit ou non son primaire désigné (transfert vers un compte
                    // courant, une épargne, etc.) : on le lui restitue aussi comme virement entrant,
                    // en plus de la restitution au contributeur ci-dessus (deux vues distinctes du
                    // même montant réel, jamais sommées entre elles côté UI).
                    Set<UUID> coTitulaires = coTitulairesParCompte.getOrDefault(compteId, Set.of());
                    Set<UUID> membresActifs = membresActifsParCompte.getOrDefault(compteId, Set.of());
                    if (!membreCible.equals(membreId) && coTitulaires.contains(membreCible)
                            && !membresActifs.contains(membreCible)) {
                        virementsEntrantsMembreParCompte.merge(compteId, montantFinance, Double::sum);
                    }
                }
            }
        }

        // Argent de poche financé depuis un compte primaire différent du compte crédité :
        // même traitement qu'un poste financé (virement entrant sur le compte crédité, sortant
        // sur le primaire), calculé ici séparément car l'argent de poche n'est pas un poste du
        // moteur pur (pas de baseShare/echuShare, pas de topUp — le montant est déjà exact).
        for (PocheAFinancer p : pochesAFinancer) {
            virementsEntrantsTotalParCompte.merge(p.compteCible(), p.montant(), Double::sum);
            virementsSortantsTotalParCompte.merge(p.comptePrimaire(), p.montant(), Double::sum);
            if (p.membreId().equals(membreCible)) {
                virementsEntrantsMembreParCompte.merge(p.compteCible(), p.montant(), Double::sum);
                virementsSortantsMembreParCompte.merge(p.comptePrimaire(), p.montant(), Double::sum);
            }
            // Même règle que pour les postes ventilés (voir ci-dessus) : un co-titulaire du
            // compte crédité, non actif lui-même dessus ce mois, voit aussi cet argent de poche
            // arriver réellement sur son compte.
            Set<UUID> coTitulaires = coTitulairesParCompte.getOrDefault(p.compteCible(), Set.of());
            Set<UUID> membresActifs = membresActifsParCompte.getOrDefault(p.compteCible(), Set.of());
            if (!membreCible.equals(p.membreId()) && coTitulaires.contains(membreCible)
                    && !membresActifs.contains(membreCible)) {
                virementsEntrantsMembreParCompte.merge(p.compteCible(), p.montant(), Double::sum);
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
     * Résout l'argent de poche par membre (montant + compte crédité) et applique la même règle
     * de compte primaire que le financement des postes. L'argent de poche est traité comme une
     * <b>dépense</b> du compte crédité (sortiesPlanifiees/sortiesEchues), pas comme un revenu :
     * une fois versée au membre pour sa consommation personnelle, elle réduit la trésorerie
     * disponible du compte exactement comme une charge, même si elle n'est pas un poste.
     * <ul>
     *   <li>Si le membre n'a pas de primaire configuré (mode legacy), ou si son primaire EST le
     *       compte crédité (auto-financé) : le montant est fusionné directement dans
     *       {@code parCompteMembreDetail} comme une charge sur le compte crédité.</li>
     *   <li>Sinon (primaire différent, actif) : rien n'est fusionné ici — le montant est
     *       restitué dans la liste retournée pour être traité, dans {@link #simulerMois}, comme
     *       un virement entrant sur le compte crédité et sortant sur le primaire.</li>
     * </ul>
     * Mute {@code parCompteMembreDetail} pour le cas auto-financé/legacy uniquement.
     */
    private static List<PocheAFinancer> fusionnerArgentPocheDansDetail(
            ParametresScenario params, Map<UUID, Map<UUID, DetailCompteMembre>> parCompteMembreDetail,
            ArgentPocheService argentPocheService, UUID scenarioId, int annee, int mois,
            Map<UUID, UUID> primairesParMembre, Set<UUID> comptesActifsIds) {

        List<PocheAFinancer> aFinancer = new ArrayList<>();
        for (UUID membreId : params.membres()) {
            AggregatMensuel ag = MoteurCalcul.aggregatMembreMois(params, membreId, annee, mois);
            double ravBrut = ag.revenus() - ag.charges() - ag.reserves();
            ResolutionArgentPoche poche = argentPocheService.resoudre(scenarioId, membreId, YearMonth.of(annee, mois), ravBrut);
            if (poche.compteId() == null || poche.montant() <= 0) continue;

            UUID compteCible = poche.compteId();
            UUID primaireId = primairesParMembre.get(membreId);

            // Défense en profondeur : si le compte crédité n'est plus actif (ex. compte
            // désactivé après coup alors qu'une politique/allocation le référence encore —
            // normalement empêché à la source par CompteService#supprimer, mais des données
            // existantes peuvent déjà être dans cet état), ne JAMAIS router via le primaire :
            // le compte cible étant hors de `tousComptes`, son entrant ne serait lu par
            // aucune boucle du résultat, alors que le sortant sur le primaire, lui, resterait
            // affiché — créant un virement sortant sans contrepartie visible.
            boolean compteCibleActif = comptesActifsIds.contains(compteCible);

            if (!compteCibleActif || primaireId == null || !comptesActifsIds.contains(primaireId)
                    || primaireId.equals(compteCible)) {
                // Mode legacy, compte cible inactif, ou auto-financé (le compte cible EST le
                // primaire) : comptée directement comme une charge (dépense), aucun virement
                // à simuler pour cette part.
                DetailCompteMembre delta = new DetailCompteMembre(0, 0, poche.montant(), poche.montant());
                parCompteMembreDetail.computeIfAbsent(compteCible, k -> new LinkedHashMap<>())
                        .merge(membreId, delta, DetailCompteMembre::plus);
            } else {
                aFinancer.add(new PocheAFinancer(membreId, compteCible, primaireId, poche.montant()));
            }
        }
        return aFinancer;
    }

    /** Montant d'argent de poche à financer depuis le compte primaire du membre (voir ci-dessus). */
    private record PocheAFinancer(UUID membreId, UUID compteCible, UUID comptePrimaire, double montant) {}
}

