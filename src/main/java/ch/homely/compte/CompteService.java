package ch.homely.compte;

import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.compte.dto.CompteDto;
import ch.homely.compte.dto.CompteRequest;
import ch.homely.foyer.Foyer;
import ch.homely.foyer.FoyerRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** T6.1 — CRUD Comptes (scopé foyer). */
@Service
@Transactional
public class CompteService {

    private final CompteRepository compteRepo;
    private final FoyerRepository  foyerRepo;
    private final MultiTenantService multiTenant;

    public CompteService(CompteRepository compteRepo, FoyerRepository foyerRepo,
                         MultiTenantService multiTenant) {
        this.compteRepo  = compteRepo;
        this.foyerRepo   = foyerRepo;
        this.multiTenant = multiTenant;
    }

    @Transactional(readOnly = true)
    public List<CompteDto> lister(UUID foyerId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return compteRepo.findAllByFoyerIdAndActifTrueOrderByOrdre(foyerId).stream()
                .map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public CompteDto obtenir(UUID foyerId, UUID compteId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return toDto(trouver(foyerId, compteId));
    }

    public CompteDto creer(UUID foyerId, CompteRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Foyer foyer = foyerRepo.findById(foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Foyer introuvable"));
        Compte c = new Compte();
        c.setFoyer(foyer);
        appliquer(c, req);
        return toDto(compteRepo.save(c));
    }

    public CompteDto modifier(UUID foyerId, UUID compteId, CompteRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Compte c = trouver(foyerId, compteId);
        appliquer(c, req);
        return toDto(compteRepo.save(c));
    }

    public void supprimer(UUID foyerId, UUID compteId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Compte c = trouver(foyerId, compteId);
        c.setActif(false);
        compteRepo.save(c);
    }

    private void appliquer(Compte c, CompteRequest req) {
        c.setLibelle(req.libelle());
        c.setType(req.type());
        c.setSoldeInitial(req.soldeInitial() != null ? req.soldeInitial() : BigDecimal.ZERO);
        c.setDevise(req.devise());
        c.setOrdre(req.ordre());
    }

    private Compte trouver(UUID foyerId, UUID compteId) {
        return compteRepo.findByIdAndFoyerId(compteId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Compte introuvable : " + compteId));
    }

    private CompteDto toDto(Compte c) {
        return new CompteDto(c.getId(), c.getLibelle(), c.getType(),
                c.getSoldeInitial(), c.getDevise(), c.getOrdre(), c.isActif());
    }
}
