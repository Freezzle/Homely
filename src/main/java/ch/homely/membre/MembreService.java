package ch.homely.membre;

import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.foyer.Foyer;
import ch.homely.foyer.FoyerRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.membre.dto.MembreDto;
import ch.homely.membre.dto.MembreRequest;
import ch.homely.scenario.RepartitionPeriodeService;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * T6.1 — CRUD Membres (scopé foyer).
 */
@Service
@Transactional
public class MembreService {

    private final MembreRepository membreRepo;
    private final FoyerRepository foyerRepo;
    private final MultiTenantService multiTenant;
    private final RepartitionPeriodeService periodeService;

    public MembreService(MembreRepository membreRepo, FoyerRepository foyerRepo,
                         MultiTenantService multiTenant,
                         RepartitionPeriodeService periodeService) {
        this.membreRepo     = membreRepo;
        this.foyerRepo      = foyerRepo;
        this.multiTenant    = multiTenant;
        this.periodeService = periodeService;
    }

    @Transactional(readOnly = true)
    public List<MembreDto> lister(UUID foyerId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return membreRepo.findAllByFoyerIdAndActifTrueOrderByOrdre(foyerId).stream()
                .map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public MembreDto obtenir(UUID foyerId, UUID membreId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return toDto(trouver(foyerId, membreId));
    }

    public MembreDto creer(UUID foyerId, MembreRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Foyer foyer = foyerRepo.findById(foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Foyer introuvable"));
        Membre m = new Membre();
        m.setFoyer(foyer);
        m.setNom(req.nom());
        m.setCouleur(req.couleur());
        m.setOrdre(req.ordre());
        Membre saved = membreRepo.save(m);
        // Hook : ajouter le membre avec 0% dans toutes les périodes existantes
        periodeService.onMembreAjoute(foyerId, saved);
        return toDto(saved);
    }

    public MembreDto modifier(UUID foyerId, UUID membreId, MembreRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Membre m = trouver(foyerId, membreId);
        m.setNom(req.nom());
        m.setCouleur(req.couleur());
        m.setOrdre(req.ordre());
        return toDto(membreRepo.save(m));
    }

    public void supprimer(UUID foyerId, UUID membreId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Membre m = trouver(foyerId, membreId);
        // Hook : fermer la période ouverte et créer une nouvelle période sans ce membre
        periodeService.onMembreDesactive(foyerId, m, LocalDate.now());
        m.setActif(false);
        membreRepo.save(m);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Membre trouver(UUID foyerId, UUID membreId) {
        return membreRepo.findByIdAndFoyerId(membreId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Membre introuvable : " + membreId));
    }

    private MembreDto toDto(Membre m) {
        return new MembreDto(m.getId(), m.getNom(), m.getCouleur(), m.getOrdre(), m.isActif());
    }
}
