package ch.homely.membre;

import ch.homely.commun.CodesErreur;
import ch.homely.commun.RegleMetierException;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.compte.Compte;
import ch.homely.compte.CompteMembre;
import ch.homely.compte.CompteMembreRepository;
import ch.homely.compte.CompteRepository;
import ch.homely.foyer.Foyer;
import ch.homely.foyer.FoyerRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.membre.dto.ComptePrimaireRequest;
import ch.homely.membre.dto.MembreDto;
import ch.homely.membre.dto.MembreRequest;
import ch.homely.scenario.RepartitionPeriodeService;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * T6.1 — CRUD Membres (scopé foyer).
 */
@Service
@Transactional
public class MembreService {

    private final MembreRepository membreRepo;
    private final FoyerRepository foyerRepo;
    private final CompteRepository compteRepo;
    private final CompteMembreRepository compteMembreRepo;
    private final MultiTenantService multiTenant;
    private final RepartitionPeriodeService periodeService;

    public MembreService(MembreRepository membreRepo, FoyerRepository foyerRepo,
                         CompteRepository compteRepo,
                         CompteMembreRepository compteMembreRepo,
                         MultiTenantService multiTenant,
                         RepartitionPeriodeService periodeService) {
        this.membreRepo       = membreRepo;
        this.foyerRepo        = foyerRepo;
        this.compteRepo       = compteRepo;
        this.compteMembreRepo = compteMembreRepo;
        this.multiTenant      = multiTenant;
        this.periodeService   = periodeService;
    }

    @Transactional(readOnly = true)
    public List<MembreDto> lister(UUID foyerId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        Map<UUID, UUID> primairesParMembre = new HashMap<>();
        for (CompteMembre cm : compteMembreRepo.findAllByCompte_Foyer_IdAndEstPrimaireTrue(foyerId)) {
            primairesParMembre.put(cm.getMembre().getId(), cm.getCompte().getId());
        }
        return membreRepo.findAllByFoyerIdAndActifTrueOrderByNomAsc(foyerId).stream()
                .map(m -> toDto(m, primairesParMembre.get(m.getId()))).toList();
    }

    @Transactional(readOnly = true)
    public MembreDto obtenir(UUID foyerId, UUID membreId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return toDto(trouver(foyerId, membreId), comptePrimaireIdDe(membreId));
    }

    public MembreDto creer(UUID foyerId, MembreRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Foyer foyer = foyerRepo.findById(foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Foyer introuvable"));
        Membre m = new Membre();
        m.setFoyer(foyer);
        m.setNom(req.nom());
        m.setCouleur(req.couleur());
        Membre saved = membreRepo.save(m);
        // Hook : ajouter le membre avec 0% dans toutes les périodes existantes
        periodeService.onMembreAjoute(foyerId, saved);
        return toDto(saved, null);
    }

    public MembreDto modifier(UUID foyerId, UUID membreId, MembreRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Membre m = trouver(foyerId, membreId);
        m.setNom(req.nom());
        m.setCouleur(req.couleur());
        Membre saved = membreRepo.save(m);
        return toDto(saved, comptePrimaireIdDe(membreId));
    }

    public void supprimer(UUID foyerId, UUID membreId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Membre m = trouver(foyerId, membreId);
        // Hook : fermer la période ouverte et créer une nouvelle période sans ce membre
        periodeService.onMembreDesactive(foyerId, m, LocalDate.now());
        m.setActif(false);
        membreRepo.save(m);
    }

    /** Désigne (ou retire, si {@code compteId} est {@code null}) le compte primaire
     *  d'un membre — le compte qui finance les virements entrants (planifiés + de
     *  comblement) de ses autres comptes. Le compte doit appartenir au même foyer
     *  et le membre doit en être co-titulaire. Un membre ne peut avoir qu'un seul
     *  compte primaire à la fois : tout ancien primaire est automatiquement retiré. */
    public MembreDto definirComptePrimaire(UUID foyerId, UUID membreId, ComptePrimaireRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Membre m = trouver(foyerId, membreId);

        // Retire le drapeau primaire de tout rattachement existant du membre
        List<CompteMembre> anciensPrimaires = compteMembreRepo.findAllByMembre_IdAndEstPrimaireTrue(membreId);
        anciensPrimaires.forEach(cm -> cm.setEstPrimaire(false));
        compteMembreRepo.saveAll(anciensPrimaires);

        if (req.compteId() == null) {
            return toDto(m, null);
        }

        Compte compte = compteRepo.findByIdAndFoyerId(req.compteId(), foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Compte introuvable : " + req.compteId()));
        CompteMembre rattachement = compteMembreRepo.findByCompte_IdAndMembre_Id(compte.getId(), membreId)
                .orElseThrow(() -> new RegleMetierException(
                        CodesErreur.COMPTE_PRIMAIRE_NON_RATTACHE,
                        "Le compte primaire doit être un compte dont le membre est co-titulaire."));
        rattachement.setEstPrimaire(true);
        compteMembreRepo.save(rattachement);
        return toDto(m, compte.getId());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Membre trouver(UUID foyerId, UUID membreId) {
        return membreRepo.findByIdAndFoyerId(membreId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Membre introuvable : " + membreId));
    }

    private UUID comptePrimaireIdDe(UUID membreId) {
        return compteMembreRepo.findAllByMembre_IdAndEstPrimaireTrue(membreId).stream()
                .findFirst()
                .map(cm -> cm.getCompte().getId())
                .orElse(null);
    }

    private MembreDto toDto(Membre m, UUID compteIdPrimaire) {
        return new MembreDto(m.getId(), m.getNom(), m.getCouleur(), m.isActif(), compteIdPrimaire);
    }
}
