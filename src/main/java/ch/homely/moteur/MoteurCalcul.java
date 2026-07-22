package ch.homely.moteur;

import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.MomentPeriode;
import ch.homely.poste.TypeRepartition;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

/**
 * ★ Moteur de calcul budgétaire — module pur, zéro dépendance Spring/JPA/horloge.
 *
 * <p>Implémente exactement l'algorithme décrit dans {@code docs/01-business-rules-engine.md}.
 * Entrées = records immuables ({@link ParametresScenario}, {@link PosteCalcul}…).
 * Sorties = {@link ProjectionAnnuelle}, {@link ProjectionPluriannuelle}, {@link Ventilations}.</p>
 *
 * <p>Calculs en {@code double} (fidèle à Excel). Arrondir uniquement à l'affichage.
 * Modulo euclidien via {@link Math#floorMod(int, int)}.</p>
 */
public class MoteurCalcul {

    private static final double TOLERANCE_REPARTITION = 1e-6;

    // ─────────────────────────────────────────────────────────────────────────
    // §3 — Brique élémentaire : contribution(poste, année, mois)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Calcule la contribution d'un poste à un mois donné (doc 01 §3).
     *
     * @param poste  poste à évaluer
     * @param annee  année (ex. 2026)
     * @param mois   numéro de mois 1..12
     * @return contribution en devise du poste (avant conversion)
     */
    public static double contribution(PosteCalcul poste, int annee, int mois) {
        if (poste == null || poste.montant() <= 0) return 0.0;

        // §3.1 — Diviseur sûr
        int d = poste.periodiciteMois();
        int dSafe = d;

        // §3.2 — Fenêtre de validité
        LocalDate premierJour = LocalDate.of(annee, mois, 1);
        LocalDate finDeMois   = YearMonth.of(annee, mois).atEndOfMonth();

        boolean actifDebut = poste.debut() == null || !poste.debut().isAfter(finDeMois);
        boolean actifFin   = poste.fin()   == null || !poste.fin().isBefore(premierJour);
        boolean actif      = actifDebut && actifFin;

        if (!actif) return 0.0;

        // §3.3 — Indicateurs de comptabilisation
        boolean estOneShot = (d == 0);  // One-shot : imputé uniquement au mois exact de début
        boolean estDebut = (d != 1) && !estOneShot
                && (poste.moment() == MomentPeriode.DEBUT_PERIODE)
                && (poste.mode()   == ModeComptabilisation.PERIODIQUE);
        boolean estFin   = (d != 1) && !estOneShot
                && (poste.moment() == MomentPeriode.FIN_PERIODE)
                && (poste.mode()   == ModeComptabilisation.PERIODIQUE);

        // §3.4 — Ancre de périodicité
        int ancre = (poste.debut() == null) ? 1 : poste.debut().getMonthValue();

        // §3.5 — Calcul final
        double c = poste.montant();
        if (estOneShot) {
            // One-shot : imputé uniquement au mois exact du début
            if (poste.debut() == null) return 0.0;
            LocalDate debutPoste = poste.debut();
            return (debutPoste.getYear() == annee && debutPoste.getMonthValue() == mois) ? c : 0.0;
        } else if (estDebut) {
            return (Math.floorMod(mois - ancre, dSafe) == 0) ? c : 0.0;
        } else if (estFin) {
            return (Math.floorMod(mois - ancre + 1, dSafe) == 0) ? c : 0.0;
        } else {
            // MENSUALISE (ou D==1)
            return c / dSafe;
        }
    }

    /**
     * Contribution <b>réelle</b> d'un poste à un mois donné.
     *
     * <p>Identique à {@link #contribution(PosteCalcul,int,int)} <em>mais</em> en forçant
     * la comptabilisation périodique : un poste dont {@code periodicité > 1} est imputé
     * au montant plein <b>sur son mois d'ancrage</b> (selon {@code moment}), quel que
     * soit son {@code mode} déclaré. Les postes {@code D=1} restent imputés chaque mois.
     * Utilisé pour visualiser les décaissements/encaissements réels dans le temps,
     * sans lissage.</p>
     *
     * <p><b>Invariant</b> : sur une année complète (fenêtre de validité couvrante),
     * la somme des 12 contributions réelles == somme des 12 contributions mensualisées.</p>
     */
    public static double contributionReelle(PosteCalcul poste, int annee, int mois) {
        if (poste == null || poste.montant() <= 0) return 0.0;

        int d = poste.periodiciteMois();
        int dSafe = d;

        LocalDate premierJour = LocalDate.of(annee, mois, 1);
        LocalDate finDeMois   = YearMonth.of(annee, mois).atEndOfMonth();
        boolean actifDebut = poste.debut() == null || !poste.debut().isAfter(finDeMois);
        boolean actifFin   = poste.fin()   == null || !poste.fin().isBefore(premierJour);
        if (!(actifDebut && actifFin)) return 0.0;

        // One-shot ou mensuel : imputé au mois exact du début (one-shot) ou chaque mois (mensuel)
        if (d == 0) {
            // One-shot : imputé uniquement au mois exact du début
            if (poste.debut() == null) return 0.0;
            LocalDate debutPoste = poste.debut();
            return (debutPoste.getYear() == annee && debutPoste.getMonthValue() == mois) ? poste.montant() : 0.0;
        }
        if (d == 1) return poste.montant();

        int ancre = (poste.debut() == null) ? 1 : poste.debut().getMonthValue();
        boolean fin = poste.moment() == MomentPeriode.FIN_PERIODE;
        int delta = fin ? (mois - ancre + 1) : (mois - ancre);
        return (Math.floorMod(delta, dSafe) == 0) ? poste.montant() : 0.0;
    }

    /**
     * Montant mensualisé d'un poste (champ dérivé affiché dans les listes) — doc 01 §3.6.
     * Pour un one-shot (d==0), retourne le montant complet.
     */
    public static double montantMensualise(PosteCalcul poste) {
        if (poste == null || poste.montant() <= 0) return 0.0;
        int d = poste.periodiciteMois();
        if (d == 0) return poste.montant();  // One-shot : montant complet
        int dSafe = d;
        return poste.montant() / dSafe;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // §6 — Répartition par période + quote-part effective
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Retourne la liste des quotes-parts de la période active pour un mois donné.
     * La période active est la première période dont {@code [debut, fin]} couvre
     * le premier jour du mois {@code (annee, mois)}.
     *
     * @return liste des répartitions de la période active, ou une liste vide si aucune
     *         période ne couvre ce mois
     */
    public static List<RepartitionCalcul> periodeActive(
            List<RepartitionPeriodeCalcul> periodes, int annee, int mois) {
        if (periodes == null || periodes.isEmpty()) return List.of();
        LocalDate dateRef = LocalDate.of(annee, mois, 1);
        return periodes.stream()
                .filter(p -> {
                    boolean apresDebut = p.debut() == null || !dateRef.isBefore(p.debut());
                    boolean avantFin   = p.fin()   == null || !dateRef.isAfter(p.fin());
                    return apresDebut && avantFin;
                })
                .findFirst()
                .map(RepartitionPeriodeCalcul::repartitions)
                .orElse(List.of());
    }

    /**
     * Retourne la quote-part effective du membre pour ce poste à un mois donné.
     *
     * <ul>
     *   <li>Mono-membre ({@code nbMembres ≤ 1}) → {@code 1.0} toujours.</li>
     *   <li>{@link TypeRepartition#CUSTOM} → quote-part stockée sur le poste (0 si absente).</li>
     *   <li>{@link TypeRepartition#AUTO} → part de la période active du scénario (0 si absente).</li>
     *   <li>{@link TypeRepartition#REVERSE_AUTO} → complément normalisé :
     *       {@code (1 − pᵢ) / (N − 1)} où N = taille de la période active.
     *       Pour N=2 cela permute exactement les parts.</li>
     * </ul>
     *
     * @param poste           poste à évaluer
     * @param membreId        identifiant du membre
     * @param annee           année du mois de calcul
     * @param mois            numéro de mois 1..12
     * @param periodesDefaut  fenêtres temporelles de répartition du scénario
     * @param nbMembres       nombre de membres actifs dans le scénario
     * @return quote-part ∈ [0,1]
     */
    public static double quotePartEffective(PosteCalcul poste, UUID membreId,
                                            int annee, int mois,
                                            List<RepartitionPeriodeCalcul> periodesDefaut,
                                            int nbMembres) {
        // Mono-membre : toujours 100 %
        if (nbMembres <= 1) return 1.0;

        TypeRepartition type = poste.typeRepartition();

        if (type == TypeRepartition.CUSTOM) {
            List<RepartitionCalcul> source = poste.repartitions();
            if (source == null || source.isEmpty()) return 0.0;
            return source.stream()
                    .filter(r -> membreId.equals(r.membreId()))
                    .mapToDouble(RepartitionCalcul::quotePart)
                    .findFirst()
                    .orElse(0.0);
        }

        // AUTO ou REVERSE_AUTO : résoudre la période active
        List<RepartitionCalcul> parts = periodeActive(periodesDefaut, annee, mois);

        if (type == TypeRepartition.AUTO) {
            return parts.stream()
                    .filter(r -> membreId.equals(r.membreId()))
                    .mapToDouble(RepartitionCalcul::quotePart)
                    .findFirst()
                    .orElse(0.0);
        }

        // REVERSE_AUTO : (1 − pᵢ) / (N − 1)
        int N = parts.size();
        if (N <= 1) return 1.0;
        double pi = parts.stream()
                .filter(r -> membreId.equals(r.membreId()))
                .mapToDouble(RepartitionCalcul::quotePart)
                .findFirst()
                .orElse(0.0);
        return (1.0 - pi) / (N - 1);
    }

    /**
     * Un poste est <b>personnel</b> s'il est réparti en {@link TypeRepartition#CUSTOM}
     * et qu'un seul membre y a une quote-part {@code > 0}. Les postes {@code AUTO} /
     * {@code REVERSE_AUTO} impliquent toujours l'ensemble des membres (via la période
     * du scénario) → toujours considérés <b>partagés</b>.
     *
     * @param poste poste à classifier
     * @return {@code true} si le poste est personnel à un unique membre
     */
    public static boolean estPersonnel(PosteCalcul poste) {
        if (poste.typeRepartition() != TypeRepartition.CUSTOM) return false;
        List<RepartitionCalcul> repartitions = poste.repartitions();
        if (repartitions == null) return false;
        long nonZero = repartitions.stream().filter(r -> r.quotePart() > 0).count();
        return nonZero == 1;
    }

    /**
     * Valide qu'une liste de répartitions somme à 1 (±1e-6).
     * Lève {@link RepartitionInvalideException} sinon.
     */
    public static void validerRepartition(List<RepartitionCalcul> repartitions) {
        if (repartitions == null || repartitions.isEmpty()) return;
        double somme = repartitions.stream().mapToDouble(RepartitionCalcul::quotePart).sum();
        if (Math.abs(somme - 1.0) > TOLERANCE_REPARTITION) {
            throw new RepartitionInvalideException(somme);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // §7 — Taux de conversion
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Retourne le taux de conversion d'une devise vers la devise de base.
     * Si devise == deviseBase → 1.0. Si non défini → 1.0 (avec avertissement logique, pas d'exception).
     */
    public static double tauxConversion(String devise, String deviseBase, Map<String, Double> taux) {
        if (devise == null || devise.equals(deviseBase)) return 1.0;
        return taux.getOrDefault(devise, 1.0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // §4 — Agrégats mensuels
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Calcule les agrégats du foyer pour un mois donné (périmètre FOYER).
     */
    public static AggregatMensuel aggregatFoyerMois(ParametresScenario params, int annee, int mois) {
        return aggregatFoyerMoisInterne(params, annee, mois, false);
    }

    /**
     * Variante <b>réelle</b> — cf. {@link #contributionReelle(PosteCalcul,int,int)}.
     */
    public static AggregatMensuel aggregatFoyerMoisReel(ParametresScenario params, int annee, int mois) {
        return aggregatFoyerMoisInterne(params, annee, mois, true);
    }

    private static AggregatMensuel aggregatFoyerMoisInterne(ParametresScenario params, int annee, int mois, boolean reel) {
        double revenus  = 0, charges = 0, reserves = 0;
        for (PosteCalcul poste : params.postes()) {
            double base = reel ? contributionReelle(poste, annee, mois) : contribution(poste, annee, mois);
            double contrib = base * tauxConversion(poste.devise(), params.deviseBase(), params.taux());
            switch (poste.type()) {
                case REVENU  -> revenus  += contrib;
                case CHARGE  -> charges  += contrib;
                case RESERVE -> reserves += contrib;
            }
        }
        return new AggregatMensuel(revenus, charges, reserves, revenus - charges - reserves);
    }

    /**
     * Calcule les agrégats d'un membre pour un mois donné.
     */
    public static AggregatMensuel aggregatMembreMois(ParametresScenario params, UUID membreId,
                                                     int annee, int mois) {
        return aggregatMembreMoisInterne(params, membreId, annee, mois, false);
    }

    /**
     * Variante <b>réelle</b> — cf. {@link #contributionReelle(PosteCalcul,int,int)}.
     */
    public static AggregatMensuel aggregatMembreMoisReel(ParametresScenario params, UUID membreId,
                                                         int annee, int mois) {
        return aggregatMembreMoisInterne(params, membreId, annee, mois, true);
    }

    private static AggregatMensuel aggregatMembreMoisInterne(ParametresScenario params, UUID membreId,
                                                             int annee, int mois, boolean reel) {
        double revenus = 0, charges = 0, reserves = 0;
        int nbMembres = params.membres().size();
        for (PosteCalcul poste : params.postes()) {
            double base = reel ? contributionReelle(poste, annee, mois) : contribution(poste, annee, mois);
            double contrib = base
                    * tauxConversion(poste.devise(), params.deviseBase(), params.taux())
                    * quotePartEffective(poste, membreId, annee, mois, params.periodesDefaut(), nbMembres);
            switch (poste.type()) {
                case REVENU  -> revenus  += contrib;
                case CHARGE  -> charges  += contrib;
                case RESERVE -> reserves += contrib;
            }
        }
        return new AggregatMensuel(revenus, charges, reserves, revenus - charges - reserves);
    }

    /**
     * Décomposition perso / partagé d'un membre pour un mois donné (cf.
     * {@link SplitPersoPartageMensuel}). Réutilise exactement {@link #contribution}
     * et {@link #quotePartEffective} — aucune nouvelle règle de calcul, uniquement une
     * classification supplémentaire par poste via {@link #estPersonnel(PosteCalcul)}.
     * En mono-membre ({@code nbMembres ≤ 1}), tout est classé "partagé" par convention
     * (la distinction perso/partagé n'a pas de sens sans répartition entre membres).
     */
    public static SplitPersoPartageMensuel aggregatMembreMoisSplit(ParametresScenario params, UUID membreId,
                                                                    int annee, int mois) {
        double revenusPerso = 0, revenusPartage = 0;
        double chargesPerso = 0, chargesPartage = 0;
        double reservesPerso = 0, reservesPartage = 0;
        int nbMembres = params.membres().size();

        for (PosteCalcul poste : params.postes()) {
            double contrib = contribution(poste, annee, mois)
                    * tauxConversion(poste.devise(), params.deviseBase(), params.taux())
                    * quotePartEffective(poste, membreId, annee, mois, params.periodesDefaut(), nbMembres);
            if (contrib == 0) continue;

            boolean personnel = nbMembres > 1 && estPersonnel(poste);
            switch (poste.type()) {
                case REVENU -> {
                    if (personnel) revenusPerso += contrib; else revenusPartage += contrib;
                }
                case CHARGE -> {
                    if (personnel) chargesPerso += contrib; else chargesPartage += contrib;
                }
                case RESERVE -> {
                    if (personnel) reservesPerso += contrib; else reservesPartage += contrib;
                }
            }
        }
        return new SplitPersoPartageMensuel(
                revenusPerso, revenusPartage, chargesPerso, chargesPartage, reservesPerso, reservesPartage);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // §5 — Projection annuelle & trésorerie chaînée
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Projection complète pour une année : 12 mois FOYER + total + par membre (T2.5).
     */
    public static ProjectionAnnuelle projectionAnnuelle(ParametresScenario params, int annee) {
        List<AggregatMensuel> moisFoyer     = new ArrayList<>(12);
        List<AggregatMensuel> moisFoyerReel = new ArrayList<>(12);
        AggregatMensuel total = AggregatMensuel.zero();

        for (int m = 1; m <= 12; m++) {
            AggregatMensuel ag  = aggregatFoyerMois(params, annee, m);
            AggregatMensuel agR = aggregatFoyerMoisReel(params, annee, m);
            moisFoyer.add(ag);
            moisFoyerReel.add(agR);
            total = total.plus(ag);
        }

        // Par membre : total annuel + 12 mois mensualisés + 12 mois réels
        Map<UUID, AggregatMensuel>       parMembre         = new LinkedHashMap<>();
        Map<UUID, List<AggregatMensuel>> moisParMembre     = new LinkedHashMap<>();
        Map<UUID, List<AggregatMensuel>> moisParMembreReel = new LinkedHashMap<>();
        for (UUID membreId : params.membres()) {
            List<AggregatMensuel> moisMembre     = new ArrayList<>(12);
            List<AggregatMensuel> moisMembreReel = new ArrayList<>(12);
            AggregatMensuel       totalMembre    = AggregatMensuel.zero();
            for (int m = 1; m <= 12; m++) {
                AggregatMensuel ag  = aggregatMembreMois(params, membreId, annee, m);
                AggregatMensuel agR = aggregatMembreMoisReel(params, membreId, annee, m);
                moisMembre.add(ag);
                moisMembreReel.add(agR);
                totalMembre = totalMembre.plus(ag);
            }
            parMembre.put(membreId, totalMembre);
            moisParMembre.put(membreId, moisMembre);
            moisParMembreReel.put(membreId, moisMembreReel);
        }

        return new ProjectionAnnuelle(annee, moisFoyer, moisFoyerReel, total,
                parMembre, moisParMembre, moisParMembreReel);
    }

    /**
     * Projection pluriannuelle avec trésorerie chaînée (T2.6).
     * tresorerieDebutAnnee(Yi) = T0 + Σ soldeAnnuel(Y0..Yi-1)
     */
    public static ProjectionPluriannuelle projectionPluriannuelle(ParametresScenario params) {
        int y0 = params.anneeDepart();
        int h  = params.horizonAnnees();
        double t0 = params.tresorerieInitiale();

        List<ProjectionAnnuelle> annees     = new ArrayList<>(h);
        List<ProjectionPluriannuelle.EntreeTresorerie> tresorerie = new ArrayList<>(h);

        double tresoCumul = 0.0; // cumul des soldes avant cette année

        for (int i = 0; i < h; i++) {
            int annee = y0 + i;
            ProjectionAnnuelle proj = projectionAnnuelle(params, annee);
            annees.add(proj);

            double tresoDebut = t0 + tresoCumul;
            double soldeAnnuel = proj.totalAnnuel().soldeDisponible();
            double tresoFin = tresoDebut + soldeAnnuel;

            tresorerie.add(new ProjectionPluriannuelle.EntreeTresorerie(
                    annee, soldeAnnuel, tresoDebut, tresoFin));

            tresoCumul += soldeAnnuel;
        }

        return new ProjectionPluriannuelle(annees, tresorerie);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // §8 — Ventilations (T2.7)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Calcule les ventilations par catégorie, par catégorie/membre et par compte/membre pour un mois (T2.7).
     */
    public static Ventilations ventilations(ParametresScenario params, int annee, int mois) {
        Map<UUID, Double> parCategorie    = new LinkedHashMap<>();
        Map<UUID, Map<UUID, Double>> parCategorieMembre = new LinkedHashMap<>();
        Map<UUID, Map<UUID, Double>> parCompteMembre = new LinkedHashMap<>();
        int nbMembres = params.membres().size();

        for (PosteCalcul poste : params.postes()) {
            double taux = tauxConversion(poste.devise(), params.deviseBase(), params.taux());
            double contrib = contribution(poste, annee, mois) * taux;

            // Ventilation par catégorie
            if (poste.categorieId() != null && contrib != 0) {
                parCategorie.merge(poste.categorieId(), contrib, Double::sum);

                for (UUID membreId : params.membres()) {
                    double partMembre = contrib
                            * quotePartEffective(poste, membreId, annee, mois, params.periodesDefaut(), nbMembres);
                    if (partMembre == 0) continue;

                    parCategorieMembre
                            .computeIfAbsent(poste.categorieId(), k -> new LinkedHashMap<>())
                            .merge(membreId, partMembre, Double::sum);
                }
            }

            // Ventilation par compte/membre
            for (UUID membreId : params.membres()) {
                double partMembre = contrib
                        * quotePartEffective(poste, membreId, annee, mois, params.periodesDefaut(), nbMembres);
                if (partMembre == 0) continue;

                UUID compteId = resolveCompte(poste, membreId);
                if (compteId == null) continue;

                parCompteMembre
                        .computeIfAbsent(compteId, k -> new LinkedHashMap<>())
                        .merge(membreId, partMembre, Double::sum);
            }
        }

        return new Ventilations(annee, mois, parCategorie, parCategorieMembre, parCompteMembre);
    }

    /** Résout le compte cible d'un membre pour un poste (ventilationComptes). */
    private static UUID resolveCompte(PosteCalcul poste, UUID membreId) {
        if (poste.ventilations() == null) return null;
        return poste.ventilations().stream()
                .filter(v -> membreId.equals(v.membreId()))
                .map(VentilationCalcul::compteId)
                .findFirst()
                .orElse(null);
    }
}
