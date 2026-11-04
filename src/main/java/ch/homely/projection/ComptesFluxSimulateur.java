package ch.homely.projection;

import ch.homely.compte.Compte;
import ch.homely.moteur.AggregatMensuel;
import ch.homely.moteur.DetailCompteMembre;
import ch.homely.moteur.MoteurCalcul;
import ch.homely.moteur.ParametresScenario;
import ch.homely.moteur.PosteImputationDetail;
import ch.homely.moteur.VentilationsCompteDetail;
import ch.homely.moteur.VirementRoutage;
import ch.homely.poche.ArgentPocheService;
import ch.homely.poche.ResolutionArgentPoche;
import ch.homely.poste.TypePoste;
import ch.homely.projection.dto.OrigineVirement;

import java.time.YearMonth;
import java.util.*;

/**
 * Simulation mois-par-mois, à l'échelle du foyer (tous les comptes actifs), de la
 * trésorerie et des virements inter-comptes du dashboard "Comptes" (vue membre).
 *
 * <p>Réutilise {@link MoteurCalcul#ventilationsCompteMembreDetail} (prorata, fenêtres
 * de validité, mensualisé vs échu déjà gérés par le moteur pur) puis applique, en
 * couche service, deux mécanismes de routage :</p>
 *
 * <p><b>1. Routage explicite du poste</b> ({@link MoteurCalcul#virementsRoutage}) — prioritaire.
 * Un poste doté d'un <b>compte pivot</b> impute toute sa contribution sur ce compte (c'est là
 * que la transaction a physiquement lieu) et déclare des <b>contreparties</b> par membre, avec
 * leur quote-part :</p>
 * <ul>
 *   <li>{@code CHARGE}/{@code RESERVE} : chaque contrepartie <b>alimente</b> le pivot
 *       (virement contrepartie → pivot), au prorata de sa quote-part ;</li>
 *   <li>{@code REVENU} : le pivot <b>redistribue</b> vers chaque contrepartie
 *       (virement pivot → contrepartie), sur le montant échu ;</li>
 *   <li>contrepartie confondue avec le pivot ⇒ aucun virement (l'argent est déjà au bon endroit).</li>
 * </ul>
 *
 * <p><b>2. Compte primaire</b> — repli, pour la part <i>non</i> couverte par un routage
 * explicite (postes sans pivot, données antérieures) :</p>
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

        RoutageMois routage = extraireRoutage(params, annee, mois);

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

                // Part financée par un routage explicite (compte pivot + contreparties) :
                // les sources sont déclarées sur le poste, pas déduites du compte primaire.
                Map<UUID, Double> poidsRoutes = poidsSources(
                        routage.financements().getOrDefault(compteId, Map.of()).getOrDefault(membreId, Map.of()),
                        baseShare, echuShare);
                double partRoutee = 0;
                for (Map.Entry<UUID, Double> e : poidsRoutes.entrySet()) {
                    partRoutee += e.getValue();
                    UUID sourceId = e.getKey();
                    double montant = montantFinance * e.getValue();
                    // Contrepartie confondue avec le compte lui-même, ou compte source inactif :
                    // aucun virement (même garde-fou que pour le compte primaire ci-dessous).
                    if (sourceId.equals(compteId) || !comptesActifsIds.contains(sourceId)) continue;
                    virementsEntrantsTotalParCompte.merge(compteId, montant, Double::sum);
                    virementsSortantsTotalParCompte.merge(sourceId, montant, Double::sum);
                    if (estMembreCible) {
                        virementsEntrantsMembreParCompte.merge(compteId, montant, Double::sum);
                        virementsSortantsMembreParCompte.merge(sourceId, montant, Double::sum);
                    }
                    if (restituerAuCoTitulaire(membreCible, membreId, compteId,
                            coTitulairesParCompte, membresActifsParCompte)) {
                        virementsEntrantsMembreParCompte.merge(compteId, montant, Double::sum);
                    }
                }

                // Reste à financer selon le mode hérité (compte primaire du membre).
                double resteProportion = Math.max(0, 1 - partRoutee);
                if (resteProportion <= 0) continue;
                double baseShareReste = baseShare * resteProportion;
                double montantFinanceReste = montantFinance * resteProportion;

                if (primaireId == null || !comptesActifsIds.contains(primaireId)) {
                    // Mode legacy (pas de primaire configuré, ou primaire désactivé/introuvable) :
                    // comportement historique, budget planifié seul, pas de comblement automatique.
                    virementsEntrantsTotalParCompte.merge(compteId, baseShareReste, Double::sum);
                    if (estMembreCible) {
                        virementsEntrantsMembreParCompte.merge(compteId, baseShareReste, Double::sum);
                    }
                } else if (primaireId.equals(compteId)) {
                    // Auto-financé : ce compte EST le primaire du membre, l'argent y est déjà.
                    // (aucun virement à simuler pour cette part)
                } else {
                    virementsEntrantsTotalParCompte.merge(compteId, montantFinanceReste, Double::sum);
                    virementsSortantsTotalParCompte.merge(primaireId, montantFinanceReste, Double::sum);
                    if (estMembreCible) {
                        virementsEntrantsMembreParCompte.merge(compteId, montantFinanceReste, Double::sum);
                        virementsSortantsMembreParCompte.merge(primaireId, montantFinanceReste, Double::sum);
                    }
                    // Un co-titulaire du compte crédité, non actif lui-même dessus ce mois (voir
                    // membresActifsParCompte), voit cet argent arriver réellement sur son compte —
                    // que ce compte soit ou non son primaire désigné (transfert vers un compte
                    // courant, une épargne, etc.) : on le lui restitue aussi comme virement entrant,
                    // en plus de la restitution au contributeur ci-dessus (deux vues distinctes du
                    // même montant réel, jamais sommées entre elles côté UI).
                    if (restituerAuCoTitulaire(membreCible, membreId, compteId,
                            coTitulairesParCompte, membresActifsParCompte)) {
                        virementsEntrantsMembreParCompte.merge(compteId, montantFinanceReste, Double::sum);
                    }
                }
            }
        }

        // Redistribution d'un REVENU : le compte pivot (crédité) alimente les contreparties
        // déclarées. Sens inverse du financement d'une charge, et inexistant dans le modèle
        // « compte primaire ». Montant échu : l'argent ne bouge qu'une fois le revenu encaissé.
        for (VirementRoutage v : routage.redistributions()) {
            if (v.echu() == 0) continue;
            if (!comptesActifsIds.contains(v.compteSourceId())
                    || !comptesActifsIds.contains(v.compteDestinationId())) continue;
            virementsSortantsTotalParCompte.merge(v.compteSourceId(), v.echu(), Double::sum);
            virementsEntrantsTotalParCompte.merge(v.compteDestinationId(), v.echu(), Double::sum);
            if (v.membreId().equals(membreCible)) {
                virementsSortantsMembreParCompte.merge(v.compteSourceId(), v.echu(), Double::sum);
                virementsEntrantsMembreParCompte.merge(v.compteDestinationId(), v.echu(), Double::sum);
            }
            if (restituerAuCoTitulaire(membreCible, v.membreId(), v.compteDestinationId(),
                    coTitulairesParCompte, membresActifsParCompte)) {
                virementsEntrantsMembreParCompte.merge(v.compteDestinationId(), v.echu(), Double::sum);
            }
        }

        // Argent de poche financé depuis un compte primaire différent du compte crédité :
        // même traitement qu'un poste financé (virement entrant sur le compte crédité, sortant
        // sur le primaire), calculé ici séparément car l'argent de poche n'est pas un poste du
        // moteur pur (pas de baseShare/echuShare, pas de topUp — le montant est déjà exact).
        for (PocheAFinancer p : pochesAFinancer) {
            virementsEntrantsTotalParCompte.merge(p.compteCible(), p.montant(), Double::sum);
            virementsSortantsTotalParCompte.merge(p.comptePivot(), p.montant(), Double::sum);
            if (p.membreId().equals(membreCible)) {
                virementsEntrantsMembreParCompte.merge(p.compteCible(), p.montant(), Double::sum);
                virementsSortantsMembreParCompte.merge(p.comptePivot(), p.montant(), Double::sum);
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
            double reservesEchues = detailMembre.reservesEchu();
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
                    virementsEntrants, virementsSortants, reservesEchues, soldeRestant));
        }
    }

    /**
     * Résout l'argent de poche par membre (montant + comptes crédités) et applique le
     * <b>routage</b> de la politique/allocation. L'argent de poche est traité comme une
     * <b>dépense</b> des comptes crédités (sortiesPlanifiees/sortiesEchues), pas comme un
     * revenu : une fois versée au membre pour sa consommation personnelle, elle réduit la
     * trésorerie disponible du compte exactement comme une charge, même si elle n'est pas
     * un poste.
     *
     * <p>Le versement suit le <b>sens REVENU</b> : il part du compte <b>pivot</b> (la
     * source qui finance) vers chaque contrepartie, au prorata de sa quote-part.</p>
     * <ul>
     *   <li>Contrepartie == pivot (auto-routage), pivot absent/inactif, ou contrepartie
     *       inactive : la part est fusionnée directement dans
     *       {@code parCompteMembreDetail} comme une charge sur la contrepartie, sans
     *       virement.</li>
     *   <li>Sinon : rien n'est fusionné pour cette part — elle est restituée dans la liste
     *       retournée pour être traitée, dans {@link #simulerMois}, comme un virement
     *       entrant sur la contrepartie et sortant sur le pivot.</li>
     * </ul>
     * Mute {@code parCompteMembreDetail} pour les parts non virées uniquement.
     *
     * <p>{@code primairesParMembre} ne sert plus que de <b>repli</b> quand le pivot est
     * absent (données antérieures à V29) : la source est désormais portée par la
     * politique/allocation elle-même, plus par un réglage global au membre.</p>
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
            if (poche.montant() <= 0) continue;

            // Repli sur le compte primaire tant que le pivot n'est pas renseigné.
            UUID pivotId = poche.comptePivotId() != null
                    ? poche.comptePivotId()
                    : primairesParMembre.get(membreId);
            boolean pivotUtilisable = pivotId != null && comptesActifsIds.contains(pivotId);

            for (Map.Entry<UUID, Double> e : poche.montantsParCompte().entrySet()) {
                UUID compteCible = e.getKey();
                double part = e.getValue();
                if (part <= 0) continue;

                // Défense en profondeur : si le compte crédité n'est plus actif (ex. compte
                // désactivé après coup alors qu'une politique/allocation le référence encore —
                // normalement empêché à la source par CompteService#supprimer, mais des données
                // existantes peuvent déjà être dans cet état), ne JAMAIS router via le pivot :
                // le compte cible étant hors de `tousComptes`, son entrant ne serait lu par
                // aucune boucle du résultat, alors que le sortant sur le pivot, lui, resterait
                // affiché — créant un virement sortant sans contrepartie visible.
                boolean compteCibleActif = comptesActifsIds.contains(compteCible);

                if (!compteCibleActif || !pivotUtilisable || pivotId.equals(compteCible)) {
                    // Auto-routage, pivot inutilisable ou compte cible inactif : comptée
                    // directement comme une charge (dépense), aucun virement à simuler.
                    DetailCompteMembre delta = new DetailCompteMembre(0, 0, part, part, 0, 0);
                    parCompteMembreDetail.computeIfAbsent(compteCible, k -> new LinkedHashMap<>())
                            .merge(membreId, delta, DetailCompteMembre::plus);
                } else {
                    aFinancer.add(new PocheAFinancer(membreId, compteCible, pivotId, part));
                }
            }
        }
        return aFinancer;
    }

    /** Part d'argent de poche à financer depuis le compte pivot du membre (voir ci-dessus). */
    private record PocheAFinancer(UUID membreId, UUID compteCible, UUID comptePivot, double montant) {}

    /**
     * Routage explicite des postes pour un mois, éclaté selon son sens.
     *
     * @param financements   {compteDestination (= pivot) → membre → compteSource → {mensualisé, échu}}
     *                       pour les postes CHARGE/RESERVE : les contreparties alimentent le pivot
     * @param financementsParPoste même découpage que {@code financements}, mais conservant le
     *                       détail poste par poste ({@code … → compteSource → poste → {mensualisé,
     *                       échu}}) — sert uniquement à restituer la composition d'un virement,
     *                       jamais au calcul des montants
     * @param redistributions mouvements des postes REVENU : le pivot alimente les contreparties
     */
    private record RoutageMois(
            Map<UUID, Map<UUID, Map<UUID, double[]>>> financements,
            Map<UUID, Map<UUID, Map<UUID, Map<UUID, double[]>>>> financementsParPoste,
            List<VirementRoutage> redistributions) {}

    private static RoutageMois extraireRoutage(ParametresScenario params, int annee, int mois) {
        Map<UUID, Map<UUID, Map<UUID, double[]>>> financements = new HashMap<>();
        Map<UUID, Map<UUID, Map<UUID, Map<UUID, double[]>>>> parPoste = new HashMap<>();
        List<VirementRoutage> redistributions = new ArrayList<>();
        for (VirementRoutage v : MoteurCalcul.virementsRoutage(params, annee, mois)) {
            if (v.type() == TypePoste.REVENU) {
                redistributions.add(v);
            } else {
                financements
                        .computeIfAbsent(v.compteDestinationId(), k -> new HashMap<>())
                        .computeIfAbsent(v.membreId(), k -> new LinkedHashMap<>())
                        .merge(v.compteSourceId(), new double[]{v.mensualise(), v.echu()},
                                (a, b) -> new double[]{a[0] + b[0], a[1] + b[1]});
                parPoste
                        .computeIfAbsent(v.compteDestinationId(), k -> new HashMap<>())
                        .computeIfAbsent(v.membreId(), k -> new LinkedHashMap<>())
                        .computeIfAbsent(v.compteSourceId(), k -> new LinkedHashMap<>())
                        .merge(v.posteId(), new double[]{v.mensualise(), v.echu()},
                                (a, b) -> new double[]{a[0] + b[0], a[1] + b[1]});
            }
        }
        return new RoutageMois(financements, parPoste, redistributions);
    }

    /**
     * Convertit les montants routés d'un (compte, membre) en <b>fractions</b> de sa charge
     * totale sur ce compte, afin de répartir {@code montantFinance} (budget planifié +
     * comblement) entre les sources explicites. Le complément à 1 reste financé selon le mode
     * hérité (compte primaire).
     *
     * <p>Le dénominateur est la part mensualisée du membre sur le compte ; on retombe sur la
     * part échue si la première est nulle (cas limite d'un poste purement échu).</p>
     */
    private static Map<UUID, Double> poidsSources(
            Map<UUID, double[]> sources, double baseShare, double echuShare) {
        if (sources.isEmpty()) return Map.of();
        boolean surMensualise = baseShare != 0;
        double denom = surMensualise ? baseShare : echuShare;
        if (denom == 0) return Map.of();

        Map<UUID, Double> poids = new LinkedHashMap<>();
        double cumul = 0;
        for (Map.Entry<UUID, double[]> e : sources.entrySet()) {
            double montant = surMensualise ? e.getValue()[0] : e.getValue()[1];
            double p = montant / denom;
            if (p <= 0) continue;
            // Garde-fou : la somme des parts routées ne peut jamais dépasser la charge totale
            // du membre sur ce compte (sinon on financerait plus que dû).
            p = Math.min(p, 1 - cumul);
            if (p <= 0) break;
            cumul += p;
            poids.put(e.getKey(), p);
        }
        return poids;
    }

    /**
     * Un co-titulaire du compte crédité, non actif lui-même dessus ce mois, voit l'argent d'un
     * autre membre arriver réellement sur son compte : on le lui restitue aussi comme virement
     * entrant (vue distincte du même montant réel, jamais sommée avec celle du contributeur).
     */
    private static boolean restituerAuCoTitulaire(
            UUID membreCible, UUID contributeur, UUID compteCredite,
            Map<UUID, Set<UUID>> coTitulairesParCompte, Map<UUID, Set<UUID>> membresActifsParCompte) {
        if (membreCible == null || membreCible.equals(contributeur)) return false;
        return coTitulairesParCompte.getOrDefault(compteCredite, Set.of()).contains(membreCible)
                && !membresActifsParCompte.getOrDefault(compteCredite, Set.of()).contains(membreCible);
    }

    /**
     * Paire de virement simulée pour un mois donné : {@code compteSourceId} (compte primaire qui
     * finance) → {@code compteDestinationId} (compte crédité), pour un {@code montant} agrégé
     * (tous membres/postes/argent de poche confondus) — vue foyer, pas scopée à un membre, à la
     * différence de {@link #simuler}/{@link CompteFluxMensuel}.
     */
    record VirementPaire(UUID compteSourceId, UUID compteDestinationId, double montant) {}

    /**
     * Part élémentaire d'un virement simulé : ce que ce mouvement {@code compteSourceId} →
     * {@code compteDestinationId} doit à un poste précis, à l'argent de poche d'un membre, ou
     * au comblement du découvert du compte destination.
     *
     * <p>Purement descriptif : ces composantes n'interviennent jamais dans le calcul des
     * montants (elles en sont déduites), et leur somme sur une paire redonne exactement le
     * montant de {@link VirementPaire}.</p>
     */
    record VirementComposante(
            UUID compteSourceId, UUID compteDestinationId, UUID membreId,
            UUID posteId, OrigineVirement origine, double montant) {}

    /** Résultat d'un mois : les paires agrégées + leur composition détaillée. */
    record PairesMois(List<VirementPaire> paires, List<VirementComposante> composantes) {}

    /**
     * Simule, mois par mois depuis {@code params.anneeDepart()} jusqu'à {@code (anneeCible,
     * moisCible)} inclus, les paires de virement inter-comptes réellement simulées (compte
     * primaire → compte crédité) à l'échelle du foyer entier (tous membres confondus, pas de
     * {@code membreCible}). Utilisé par le dashboard "Virements des comptes" (table à
     * sous-en-têtes groupée par compte source) — remplace l'ancienne vue hub/satellite qui ne
     * disposait que d'agrégats entrants/sortants par compte, sans le détail des paires.
     *
     * <p>Réimplémente volontairement, en parallèle de {@link #simulerMois}, le sous-ensemble du
     * calcul nécessaire à la détermination des paires (chaînage de trésorerie par compte,
     * comblement "topUp", financement depuis un primaire différent) plutôt que de faire muter
     * {@link #simulerMois} pour y ajouter un accumulateur de paires : cela évite tout risque de
     * régression sur la simulation par membre déjà validée par les vecteurs golden.</p>
     *
     * <p>Chaque mois restitue aussi la <b>composition</b> des paires
     * ({@link VirementComposante}) : de quel poste, de quel argent de poche ou de quel
     * comblement de trésorerie vient chaque franc viré.</p>
     */
    static Map<YearMonth, PairesMois> simulerPaires(
            ParametresScenario params, List<Compte> tousComptes, Map<UUID, UUID> primairesParMembre,
            int anneeCible, int moisCible, ArgentPocheService argentPocheService, UUID scenarioId) {

        Set<UUID> comptesActifsIds = new HashSet<>();
        Map<UUID, Double> cumulTotalParCompte = new LinkedHashMap<>();
        for (Compte c : tousComptes) {
            comptesActifsIds.add(c.getId());
            cumulTotalParCompte.put(c.getId(), c.getSoldeInitial().doubleValue());
        }

        Map<YearMonth, PairesMois> resultat = new LinkedHashMap<>();
        int y = params.anneeDepart();
        int m = 1;
        while (y < anneeCible || (y == anneeCible && m <= moisCible)) {
            resultat.put(YearMonth.of(y, m), simulerPairesMois(
                    params, tousComptes, comptesActifsIds, primairesParMembre, cumulTotalParCompte,
                    y, m, argentPocheService, scenarioId));
            if (m == 12) { m = 1; y++; } else { m++; }
        }
        return resultat;
    }

    private static PairesMois simulerPairesMois(
            ParametresScenario params, List<Compte> tousComptes, Set<UUID> comptesActifsIds,
            Map<UUID, UUID> primairesParMembre, Map<UUID, Double> cumulTotalParCompte,
            int annee, int mois, ArgentPocheService argentPocheService, UUID scenarioId) {

        VentilationsCompteDetail detail = MoteurCalcul.ventilationsCompteMembreDetail(params, annee, mois);
        Map<UUID, Map<UUID, DetailCompteMembre>> parCompteMembreDetail = new LinkedHashMap<>();
        detail.parCompteMembre().forEach((compteId, memMap) -> parCompteMembreDetail.put(compteId, new LinkedHashMap<>(memMap)));

        List<PocheAFinancer> pochesAFinancer = fusionnerArgentPocheDansDetail(
                params, parCompteMembreDetail, argentPocheService, scenarioId, annee, mois,
                primairesParMembre, comptesActifsIds);

        RoutageMois routage = extraireRoutage(params, annee, mois);

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

        Map<UUID, Double> topUpParCompte = new HashMap<>();
        for (Compte c : tousComptes) {
            double treasoAvant = cumulTotalParCompte.get(c.getId());
            double flowAvant = treasoAvant + entreesParCompte.get(c.getId()) + baseParCompte.get(c.getId())
                    - echuParCompte.get(c.getId());
            topUpParCompte.put(c.getId(), Math.max(0, -flowAvant));
        }

        Map<UUID, Double> virementsEntrantsTotalParCompte = new HashMap<>();
        Map<UUID, Double> virementsSortantsTotalParCompte = new HashMap<>();
        Map<UUID, Map<UUID, Double>> paires = new LinkedHashMap<>(); // source -> destination -> montant
        List<VirementComposante> composantes = new ArrayList<>();
        for (Compte c : tousComptes) {
            virementsEntrantsTotalParCompte.put(c.getId(), 0.0);
            virementsSortantsTotalParCompte.put(c.getId(), 0.0);
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
                // Part de montantFinance qui ne finance aucun poste du mois : elle comble le
                // découvert du compte. Restituée telle quelle dans la composition des virements.
                double comblement = topUp * echuProportion;

                UUID primaireId = primairesParMembre.get(membreId);

                // Imputations poste par poste du membre sur ce compte : sert uniquement à
                // décomposer les montants déjà calculés (jamais à les calculer).
                Map<UUID, Double> basePostes = new LinkedHashMap<>();
                for (PosteImputationDetail d : MoteurCalcul.imputationsCompteMembre(params, compteId, membreId, annee, mois)) {
                    if (d.type() == TypePoste.REVENU) continue;
                    basePostes.merge(d.posteId(), d.mensualise(), Double::sum);
                }
                Map<UUID, Map<UUID, double[]>> routesParSource =
                        routage.financementsParPoste().getOrDefault(compteId, Map.of()).getOrDefault(membreId, Map.of());

                // Part financée par un routage explicite (compte pivot + contreparties).
                Map<UUID, Double> poidsRoutes = poidsSources(
                        routage.financements().getOrDefault(compteId, Map.of()).getOrDefault(membreId, Map.of()),
                        baseShare, echuShare);
                double partRoutee = 0;
                for (Map.Entry<UUID, Double> e : poidsRoutes.entrySet()) {
                    partRoutee += e.getValue();
                    UUID sourceId = e.getKey();
                    double poids = e.getValue();
                    double montant = montantFinance * poids;
                    if (sourceId.equals(compteId) || !comptesActifsIds.contains(sourceId)) continue;
                    virementsEntrantsTotalParCompte.merge(compteId, montant, Double::sum);
                    virementsSortantsTotalParCompte.merge(sourceId, montant, Double::sum);
                    if (montant > 0) {
                        paires.computeIfAbsent(sourceId, k -> new LinkedHashMap<>())
                                .merge(compteId, montant, Double::sum);
                        Map<UUID, Double> partsPostes = new LinkedHashMap<>();
                        routesParSource.getOrDefault(sourceId, Map.of())
                                .forEach((posteId, montants) -> partsPostes.merge(posteId, montants[0], Double::sum));
                        ventilerSurPostes(composantes, sourceId, compteId, membreId,
                                partsPostes, baseShare * poids, comblement * poids);
                    }
                }

                double resteProportion = Math.max(0, 1 - partRoutee);
                if (resteProportion <= 0) continue;
                double baseShareReste = baseShare * resteProportion;
                double montantFinanceReste = montantFinance * resteProportion;

                if (primaireId == null || !comptesActifsIds.contains(primaireId)) {
                    virementsEntrantsTotalParCompte.merge(compteId, baseShareReste, Double::sum);
                } else if (primaireId.equals(compteId)) {
                    // Auto-financé : aucun virement à simuler pour cette part.
                } else {
                    virementsEntrantsTotalParCompte.merge(compteId, montantFinanceReste, Double::sum);
                    virementsSortantsTotalParCompte.merge(primaireId, montantFinanceReste, Double::sum);
                    if (montantFinanceReste > 0) {
                        paires.computeIfAbsent(primaireId, k -> new LinkedHashMap<>())
                                .merge(compteId, montantFinanceReste, Double::sum);
                        // Mode primaire hérité : la part non routée de chaque poste, c.-à-d. son
                        // imputation moins ce qui part déjà par une contrepartie déclarée.
                        Map<UUID, Double> partsPostes = new LinkedHashMap<>(basePostes);
                        routesParSource.values().forEach(parPoste -> parPoste.forEach((posteId, montants) ->
                                partsPostes.computeIfPresent(posteId, (k, v) -> Math.max(0, v - montants[0]))));
                        ventilerSurPostes(composantes, primaireId, compteId, membreId,
                                partsPostes, baseShareReste, comblement * resteProportion);
                    }
                }
            }
        }

        // Redistribution d'un REVENU : pivot → contreparties (montant échu).
        for (VirementRoutage v : routage.redistributions()) {
            if (v.echu() <= 0) continue;
            if (!comptesActifsIds.contains(v.compteSourceId())
                    || !comptesActifsIds.contains(v.compteDestinationId())) continue;
            virementsSortantsTotalParCompte.merge(v.compteSourceId(), v.echu(), Double::sum);
            virementsEntrantsTotalParCompte.merge(v.compteDestinationId(), v.echu(), Double::sum);
            paires.computeIfAbsent(v.compteSourceId(), k -> new LinkedHashMap<>())
                    .merge(v.compteDestinationId(), v.echu(), Double::sum);
            composantes.add(new VirementComposante(v.compteSourceId(), v.compteDestinationId(),
                    v.membreId(), v.posteId(), OrigineVirement.POSTE, v.echu()));
        }

        for (PocheAFinancer p : pochesAFinancer) {
            virementsEntrantsTotalParCompte.merge(p.compteCible(), p.montant(), Double::sum);
            virementsSortantsTotalParCompte.merge(p.comptePivot(), p.montant(), Double::sum);
            if (p.montant() > 0) {
                paires.computeIfAbsent(p.comptePivot(), k -> new LinkedHashMap<>())
                        .merge(p.compteCible(), p.montant(), Double::sum);
                composantes.add(new VirementComposante(p.comptePivot(), p.compteCible(),
                        p.membreId(), null, OrigineVirement.ARGENT_POCHE, p.montant()));
            }
        }

        // Chaînage de la trésorerie cumulée par compte (indépendant du membre cible — identique
        // à la logique de simulerMois, nécessaire pour un comblement "topUp" correct au mois suivant).
        for (Compte c : tousComptes) {
            UUID compteId = c.getId();
            double soldeRestantTotal = entreesParCompte.get(compteId) + virementsEntrantsTotalParCompte.get(compteId)
                    - echuParCompte.get(compteId) - virementsSortantsTotalParCompte.get(compteId);
            cumulTotalParCompte.put(compteId, cumulTotalParCompte.get(compteId) + soldeRestantTotal);
        }

        List<VirementPaire> resultatMois = new ArrayList<>();
        paires.forEach((source, destinations) -> destinations.forEach((destination, montant) -> {
            if (montant > 0.005) {
                resultatMois.add(new VirementPaire(source, destination, montant));
            }
        }));
        return new PairesMois(resultatMois, composantes);
    }

    /**
     * Répartit un montant viré entre ses postes d'origine. {@code partPostes} donne le poids
     * de chaque poste (part mensualisée) ; {@code montantPostes} est la fraction du virement
     * qui finance réellement des postes et {@code comblement} celle qui comble le découvert du
     * compte destination.
     *
     * <p>Purement descriptif : aucune de ces valeurs n'influence le calcul des virements.</p>
     */
    private static void ventilerSurPostes(
            List<VirementComposante> composantes, UUID sourceId, UUID destinationId, UUID membreId,
            Map<UUID, Double> partPostes, double montantPostes, double comblement) {

        double totalPoids = partPostes.values().stream().mapToDouble(Double::doubleValue).filter(v -> v > 0).sum();
        if (montantPostes > 0 && totalPoids > 0) {
            for (Map.Entry<UUID, Double> e : partPostes.entrySet()) {
                if (e.getValue() <= 0) continue;
                composantes.add(new VirementComposante(sourceId, destinationId, membreId,
                        e.getKey(), OrigineVirement.POSTE, montantPostes * e.getValue() / totalPoids));
            }
        } else if (montantPostes > 0) {
            // Aucun poste identifiable (part purement échue) : rattachée au comblement.
            comblement += montantPostes;
        }
        if (comblement > 0) {
            composantes.add(new VirementComposante(sourceId, destinationId, membreId,
                    null, OrigineVirement.COMBLEMENT_TRESORERIE, comblement));
        }
    }
}

