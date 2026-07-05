package ch.homely.membre;

import ch.homely.commun.CodesErreur;
import ch.homely.commun.RegleMetierException;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.foyer.Foyer;
import ch.homely.foyer.FoyerRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.membre.dto.MembreDto;
import ch.homely.membre.dto.MembreRequest;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public MembreService(MembreRepository membreRepo, FoyerRepository foyerRepo,
                         MultiTenantService multiTenant) {
        this.membreRepo  = membreRepo;
        this.foyerRepo   = foyerRepo;
        this.multiTenant = multiTenant;
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
        return toDto(membreRepo.save(m));
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
        // Vérification de référence (répartitions) via la suppression JPA en cascade
        // Si des FK non-cascade existent, JPA lèvera DataIntegrityViolationException
        // qu'on transforme en RegleMetierException dans le GlobalExceptionHandler.
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
