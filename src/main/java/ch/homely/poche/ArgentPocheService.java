package ch.homely.poche;

import ch.homely.commun.CodesErreur;
import ch.homely.commun.ConflitException;
import ch.homely.commun.RegleMetierException;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.compte.Compte;
import ch.homely.compte.CompteRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.membre.Membre;
import ch.homely.membre.MembreRepository;
import ch.homely.scenario.Scenario;
import ch.homely.scenario.ScenarioRepository;
import ch.homely.securite.MultiTenantService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Service métier "argent de poche" — regroupe :
 * <ul>
 *   <li>la <b>résolution</b> pour un {@code (scénario, membre, mois)} donné,
 *       avec la priorité stricte allocation &gt; politique &gt; 0 (spec §3) ;</li>
 *   <li>le <b>CRUD</b> des {@link PolitiqueArgentPoche} et des
 *       {@link AllocationArgentPoche}, avec les validations de règle métier
 *       (mode fixe/variable, chevauchement des politiques, unicité des allocations).</li>
 * </ul>
 *
 * <p>Ne fait <b>aucun contrôle multi-tenant</b> lui-même — c'est le controller
 * (PR3) qui appellera {@code MultiTenantService.verifierAcces(foyerId, …)} avant
 * de déléguer ici. Le service se contente de vérifier la cohérence
 * {@code scénario → foyer} pour tous les objets rattachés.</p>
 */
@Service
@Transactional
public class ArgentPocheService {

    private final PolitiqueArgentPocheRepository politiqueRepo;
    private final AllocationArgentPocheRepository allocationRepo;
    private final ScenarioRepository scenarioRepo;
    private final MembreRepository membreRepo;
    private final CompteRepository compteRepo;
    private final MultiTenantService multiTenant;

    public ArgentPocheService(PolitiqueArgentPocheRepository politiqueRepo,
                              AllocationArgentPocheRepository allocationRepo,
                              ScenarioRepository scenarioRepo,
                              MembreRepository membreRepo,
                              CompteRepository compteRepo,
                              MultiTenantService multiTenant) {
        this.politiqueRepo  = politiqueRepo;
        this.allocationRepo = allocationRepo;
        this.scenarioRepo   = scenarioRepo;
        this.membreRepo     = membreRepo;
        this.compteRepo     = compteRepo;
        this.multiTenant    = multiTenant;
    }

    // ── Résolution ──────────────────────────────────────────────────────────

    /**
     * Résolution du montant d'argent de poche pour un membre et un mois donnés.
     *
     * <ol>
     *   <li>Une {@link AllocationArgentPoche} existe pour {@code (scénario, membre, mois)} ?
     *       → on l'utilise telle quelle.</li>
     *   <li>Sinon, une {@link PolitiqueArgentPoche} est active ce mois ?
     *       → on applique sa formule sur {@code ravBrut}.</li>
     *   <li>Sinon → 0 CHF, source {@link SourceArgentPoche#AUCUNE}.</li>
     * </ol>
     *
     * @param scenarioId scénario cible
     * @param membreId   membre cible
     * @param mois       mois cible
     * @param ravBrut    RàV du membre <b>avant</b> retrait de l'argent de poche
     */
    @Transactional(readOnly = true)
    public ResolutionArgentPoche resoudre(UUID scenarioId, UUID membreId, YearMonth mois, double ravBrut) {
        LocalDate moisDate = mois.atDay(1);

        Optional<AllocationArgentPoche> alloc = allocationRepo
                .findByScenarioIdAndMembreIdAndMois(scenarioId, membreId, moisDate);
        if (alloc.isPresent()) {
            AllocationArgentPoche a = alloc.get();
            return ResolutionArgentPoche.parAllocation(
                    a.getMontant().doubleValue(), a.getId(), ravBrut);
        }

        Optional<PolitiqueArgentPoche> pol = politiqueRepo
                .findActiveForMois(scenarioId, membreId, moisDate);
        if (pol.isPresent()) {
            PolitiqueArgentPoche p = pol.get();
            double montant = calculerFormule(p, ravBrut);
            return ResolutionArgentPoche.parPolitique(montant, p.getId(), ravBrut);
        }

        return ResolutionArgentPoche.aucune(ravBrut);
    }

    /**
     * Applique la formule d'une politique sur un RàV donné (fonction pure — testable
     * unitairement sans base).
     *
     * <p>Mode {@code VARIABLE} :
     * <pre>
     * brut    = ravBrut × pourcentage / 100
     * montant = min(max(brut, socle), plafond)
     * </pre>
     * Le pourcentage s'applique directement au RàV brut du mois (pas à un
     * surplus RàV − socle) ; le socle sert de <b>plancher</b> — versé tel quel
     * si le résultat du pourcentage tombe en dessous — et le plafond de
     * <b>plafond</b> absolu.</p>
     * Mode {@code FIXE} : {@code montant = montantFixe}.</p>
     */
    public static double calculerFormule(PolitiqueArgentPoche p, double ravBrut) {
        return switch (p.getMode()) {
            case FIXE -> p.getMontantFixe().doubleValue();
            case VARIABLE -> {
                double socle    = p.getSocle().doubleValue();
                double pct      = p.getPourcentage().doubleValue();
                double plafond  = p.getPlafond().doubleValue();
                double brut     = ravBrut * pct / 100.0;
                yield Math.min(Math.max(brut, socle), plafond);
            }
        };
    }

    // ── CRUD politiques ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PolitiqueArgentPoche> listerPolitiques(UUID foyerId, UUID scenarioId, UUID membreIdOuNull) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        verifierScenario(foyerId, scenarioId);
        if (membreIdOuNull != null) {
            return politiqueRepo.findAllByScenarioIdAndMembreIdOrderByDateDebutAsc(scenarioId, membreIdOuNull);
        }
        return politiqueRepo.findAllByScenarioIdOrderByMembreIdAscDateDebutAsc(scenarioId);
    }

    @Transactional(readOnly = true)
    public PolitiqueArgentPoche obtenirPolitique(UUID foyerId, UUID scenarioId, UUID id) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        verifierScenario(foyerId, scenarioId);
        return trouverPolitique(scenarioId, id);
    }

    public PolitiqueArgentPoche creerPolitique(UUID foyerId, UUID scenarioId,
                                               UUID membreId, UUID compteId,
                                               String nom,
                                               YearMonth dateDebut, YearMonth dateFin,
                                               ModePolitiqueArgentPoche mode,
                                               BigDecimal socle, BigDecimal pourcentage,
                                               BigDecimal plafond, BigDecimal montantFixe) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Scenario scenario = verifierScenario(foyerId, scenarioId);
        Membre membre = trouverMembre(foyerId, membreId);
        Compte compte = trouverCompte(foyerId, compteId);

        PolitiqueArgentPoche p = new PolitiqueArgentPoche();
        p.setScenario(scenario);
        p.setMembre(membre);
        p.setCompte(compte);
        appliquerPolitique(p, nom, dateDebut, dateFin, mode, socle, pourcentage, plafond, montantFixe);
        verifierPasDeChevauchement(scenarioId, membreId, p.getDateDebut(), p.getDateFin(), null);
        return politiqueRepo.save(p);
    }

    public PolitiqueArgentPoche modifierPolitique(UUID foyerId, UUID scenarioId, UUID id,
                                                  UUID membreId, UUID compteId,
                                                  String nom,
                                                  YearMonth dateDebut, YearMonth dateFin,
                                                  ModePolitiqueArgentPoche mode,
                                                  BigDecimal socle, BigDecimal pourcentage,
                                                  BigDecimal plafond, BigDecimal montantFixe) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        verifierScenario(foyerId, scenarioId);
        PolitiqueArgentPoche p = trouverPolitique(scenarioId, id);
        Membre membre = trouverMembre(foyerId, membreId);
        Compte compte = trouverCompte(foyerId, compteId);
        p.setMembre(membre);
        p.setCompte(compte);
        appliquerPolitique(p, nom, dateDebut, dateFin, mode, socle, pourcentage, plafond, montantFixe);
        verifierPasDeChevauchement(scenarioId, membreId, p.getDateDebut(), p.getDateFin(), id);
        return politiqueRepo.save(p);
    }

    public void supprimerPolitique(UUID foyerId, UUID scenarioId, UUID id) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        verifierScenario(foyerId, scenarioId);
        politiqueRepo.delete(trouverPolitique(scenarioId, id));
    }

    // ── CRUD allocations ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AllocationArgentPoche> listerAllocations(UUID foyerId, UUID scenarioId, UUID membreIdOuNull) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        verifierScenario(foyerId, scenarioId);
        if (membreIdOuNull != null) {
            return allocationRepo.findAllByScenarioIdAndMembreIdOrderByMoisDesc(scenarioId, membreIdOuNull);
        }
        return allocationRepo.findAllByScenarioIdOrderByMoisDesc(scenarioId);
    }

    @Transactional(readOnly = true)
    public List<AllocationArgentPoche> listerAllocationsMembrePeriode(
            UUID foyerId, UUID scenarioId, UUID membreId, YearMonth debut, YearMonth fin) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        verifierScenario(foyerId, scenarioId);
        return allocationRepo.findAllByScenarioIdAndMembreIdAndMoisBetweenOrderByMoisAsc(
                scenarioId, membreId, debut.atDay(1), fin.atDay(1));
    }

    @Transactional(readOnly = true)
    public AllocationArgentPoche obtenirAllocation(UUID foyerId, UUID scenarioId, UUID id) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        verifierScenario(foyerId, scenarioId);
        return trouverAllocation(scenarioId, id);
    }

    public AllocationArgentPoche creerAllocation(UUID foyerId, UUID scenarioId,
                                                 UUID membreId, UUID compteId,
                                                 YearMonth mois, BigDecimal montant, String raison) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Scenario scenario = verifierScenario(foyerId, scenarioId);
        Membre membre = trouverMembre(foyerId, membreId);
        Compte compte = trouverCompte(foyerId, compteId);

        // Vérification préemptive du doublon → 409 propre (plutôt que
        // DataIntegrityViolationException générique).
        allocationRepo.findByScenarioIdAndMembreIdAndMois(scenarioId, membreId, mois.atDay(1))
                .ifPresent(existante -> {
                    throw new ConflitException(
                            CodesErreur.ARGENT_POCHE_ALLOCATION_DOUBLON,
                            "Une allocation existe déjà pour ce membre et ce mois (id="
                                    + existante.getId() + ")");
                });

        AllocationArgentPoche a = new AllocationArgentPoche();
        a.setScenario(scenario);
        a.setMembre(membre);
        a.setCompte(compte);
        appliquerAllocation(a, mois, montant, raison);
        try {
            return allocationRepo.save(a);
        } catch (DataIntegrityViolationException ex) {
            // Filet de sécurité en cas de course concurrente (insertions parallèles
            // qui passent toutes deux la vérification préemptive).
            throw new ConflitException(
                    CodesErreur.ARGENT_POCHE_ALLOCATION_DOUBLON,
                    "Une allocation existe déjà pour ce membre et ce mois");
        }
    }

    public AllocationArgentPoche modifierAllocation(UUID foyerId, UUID scenarioId, UUID id,
                                                    UUID membreId, UUID compteId,
                                                    YearMonth mois, BigDecimal montant, String raison) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        verifierScenario(foyerId, scenarioId);
        AllocationArgentPoche a = trouverAllocation(scenarioId, id);
        Membre membre = trouverMembre(foyerId, membreId);
        Compte compte = trouverCompte(foyerId, compteId);

        // Si la clé (membre, mois) change, revalider l'unicité.
        boolean cleChange = !a.getMembre().getId().equals(membreId)
                || !a.getMois().equals(mois.atDay(1));
        if (cleChange) {
            allocationRepo.findByScenarioIdAndMembreIdAndMois(scenarioId, membreId, mois.atDay(1))
                    .filter(other -> !other.getId().equals(id))
                    .ifPresent(existante -> {
                        throw new ConflitException(
                                CodesErreur.ARGENT_POCHE_ALLOCATION_DOUBLON,
                                "Une allocation existe déjà pour ce membre et ce mois (id="
                                        + existante.getId() + ")");
                    });
        }

        a.setMembre(membre);
        a.setCompte(compte);
        appliquerAllocation(a, mois, montant, raison);
        try {
            return allocationRepo.save(a);
        } catch (DataIntegrityViolationException ex) {
            throw new ConflitException(
                    CodesErreur.ARGENT_POCHE_ALLOCATION_DOUBLON,
                    "Une allocation existe déjà pour ce membre et ce mois");
        }
    }

    public void supprimerAllocation(UUID foyerId, UUID scenarioId, UUID id) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        verifierScenario(foyerId, scenarioId);
        allocationRepo.delete(trouverAllocation(scenarioId, id));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private void appliquerPolitique(PolitiqueArgentPoche p,
                                    String nom,
                                    YearMonth dateDebut, YearMonth dateFin,
                                    ModePolitiqueArgentPoche mode,
                                    BigDecimal socle, BigDecimal pourcentage,
                                    BigDecimal plafond, BigDecimal montantFixe) {
        if (dateDebut == null || mode == null) {
            throw new RegleMetierException(CodesErreur.ARGENT_POCHE_PERIODE_INVALIDE,
                    "Date de début et mode sont obligatoires");
        }
        if (dateFin != null && dateFin.isBefore(dateDebut)) {
            throw new RegleMetierException(CodesErreur.ARGENT_POCHE_PERIODE_INVALIDE,
                    "La date de fin doit être ≥ date de début");
        }

        p.setNom(nom);
        p.setDateDebut(dateDebut.atDay(1));
        p.setDateFin(dateFin != null ? dateFin.atDay(1) : null);
        p.setMode(mode);

        if (mode == ModePolitiqueArgentPoche.VARIABLE) {
            if (socle == null || pourcentage == null || plafond == null) {
                throw new RegleMetierException(
                        CodesErreur.ARGENT_POCHE_MODE_VARIABLE_PARAMS_REQUIS,
                        "Socle, pourcentage et plafond sont requis en mode VARIABLE");
            }
            if (socle.signum() < 0) {
                throw new RegleMetierException(
                        CodesErreur.ARGENT_POCHE_MODE_VARIABLE_PARAMS_REQUIS,
                        "Le socle doit être ≥ 0");
            }
            if (pourcentage.signum() < 0 || pourcentage.compareTo(BigDecimal.valueOf(100)) > 0) {
                throw new RegleMetierException(
                        CodesErreur.ARGENT_POCHE_MODE_VARIABLE_PARAMS_REQUIS,
                        "Le pourcentage doit être compris entre 0 et 100");
            }
            if (plafond.compareTo(socle) < 0) {
                throw new RegleMetierException(
                        CodesErreur.ARGENT_POCHE_PLAFOND_INFERIEUR_SOCLE,
                        "Le plafond doit être ≥ socle");
            }
            p.setSocle(socle);
            p.setPourcentage(pourcentage);
            p.setPlafond(plafond);
            p.setMontantFixe(null);
        } else {
            if (montantFixe == null || montantFixe.signum() < 0) {
                throw new RegleMetierException(
                        CodesErreur.ARGENT_POCHE_MODE_FIXE_MONTANT_REQUIS,
                        "Un montant fixe ≥ 0 est requis en mode FIXE");
            }
            p.setMontantFixe(montantFixe);
            p.setSocle(null);
            p.setPourcentage(null);
            p.setPlafond(null);
        }
    }

    private void appliquerAllocation(AllocationArgentPoche a, YearMonth mois,
                                     BigDecimal montant, String raison) {
        if (mois == null) {
            throw new RegleMetierException(CodesErreur.ARGENT_POCHE_PERIODE_INVALIDE,
                    "Le mois est obligatoire");
        }
        if (montant == null || montant.signum() < 0) {
            throw new RegleMetierException(CodesErreur.ARGENT_POCHE_MODE_FIXE_MONTANT_REQUIS,
                    "Le montant est obligatoire et doit être ≥ 0");
        }
        a.setMois(mois.atDay(1));
        a.setMontant(montant);
        a.setRaison(raison);
    }

    /**
     * Interdit tout chevauchement entre politiques du <b>même membre</b> dans le
     * <b>même scénario</b> (trous autorisés, décision produit §7). Deux politiques
     * se chevauchent si leurs intervalles fermés {@code [debut, fin]} (avec
     * {@code fin = +∞} si nulle) s'intersectent.
     *
     * @param idExclue politique à exclure du contrôle (cas modification)
     */
    private void verifierPasDeChevauchement(UUID scenarioId, UUID membreId,
                                            LocalDate debut, LocalDate fin,
                                            UUID idExclue) {
        List<PolitiqueArgentPoche> voisines = politiqueRepo
                .findAllByScenarioIdAndMembreIdOrderByDateDebutAsc(scenarioId, membreId);
        for (PolitiqueArgentPoche autre : voisines) {
            if (idExclue != null && idExclue.equals(autre.getId())) continue;
            LocalDate ad = autre.getDateDebut();
            LocalDate af = autre.getDateFin(); // peut être null
            boolean chevauche = (af == null || !af.isBefore(debut))
                             && (fin == null || !fin.isBefore(ad));
            if (chevauche) {
                throw new ConflitException(
                        CodesErreur.ARGENT_POCHE_POLITIQUE_CHEVAUCHEMENT,
                        "Chevauchement avec la politique '" + autre.getNom()
                                + "' (id=" + autre.getId() + ")");
            }
        }
    }

    private Scenario verifierScenario(UUID foyerId, UUID scenarioId) {
        return scenarioRepo.findByIdAndFoyerId(scenarioId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Scénario introuvable : " + scenarioId));
    }

    private Membre trouverMembre(UUID foyerId, UUID membreId) {
        return membreRepo.findByIdAndFoyerId(membreId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Membre introuvable : " + membreId));
    }

    private Compte trouverCompte(UUID foyerId, UUID compteId) {
        return compteRepo.findByIdAndFoyerId(compteId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Compte introuvable : " + compteId));
    }

    private PolitiqueArgentPoche trouverPolitique(UUID scenarioId, UUID id) {
        return politiqueRepo.findByIdAndScenarioId(id, scenarioId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Politique d'argent de poche introuvable : " + id));
    }

    private AllocationArgentPoche trouverAllocation(UUID scenarioId, UUID id) {
        return allocationRepo.findByIdAndScenarioId(id, scenarioId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Allocation d'argent de poche introuvable : " + id));
    }
}
