package ch.homely.actif;

import ch.homely.actif.dto.ActifDto;
import ch.homely.actif.dto.ActifRequest;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.foyer.Foyer;
import ch.homely.foyer.FoyerRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** T6.1 — CRUD Actifs (scopé foyer). */
@Service
@Transactional
public class ActifService {

    private final ActifRepository actifRepo;
    private final FoyerRepository foyerRepo;
    private final MultiTenantService multiTenant;

    public ActifService(ActifRepository actifRepo, FoyerRepository foyerRepo,
                        MultiTenantService multiTenant) {
        this.actifRepo   = actifRepo;
        this.foyerRepo   = foyerRepo;
        this.multiTenant = multiTenant;
    }

    @Transactional(readOnly = true)
    public List<ActifDto> lister(UUID foyerId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return actifRepo.findAllByFoyerIdAndActifTrueOrderByOrdre(foyerId).stream()
                .map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public ActifDto obtenir(UUID foyerId, UUID actifId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return toDto(trouver(foyerId, actifId));
    }

    public ActifDto creer(UUID foyerId, ActifRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Foyer foyer = foyerRepo.findById(foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Foyer introuvable"));
        Actif a = new Actif();
        a.setFoyer(foyer);
        appliquer(a, req);
        return toDto(actifRepo.save(a));
    }

    public ActifDto modifier(UUID foyerId, UUID actifId, ActifRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Actif a = trouver(foyerId, actifId);
        appliquer(a, req);
        return toDto(actifRepo.save(a));
    }

    public void supprimer(UUID foyerId, UUID actifId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Actif a = trouver(foyerId, actifId);
        a.setActif(false);
        actifRepo.save(a);
    }

    private void appliquer(Actif a, ActifRequest req) {
        a.setLibelle(req.libelle());
        a.setTypeActif(req.typeActif());
        a.setSoldeInitial(req.soldeInitial() != null ? req.soldeInitial() : BigDecimal.ZERO);
        a.setDevise(req.devise());
        a.setTauxCroissanceAnnuel(
                req.tauxCroissanceAnnuel() != null ? req.tauxCroissanceAnnuel() : BigDecimal.ZERO);
        a.setOrdre(req.ordre());
    }

    private Actif trouver(UUID foyerId, UUID actifId) {
        return actifRepo.findByIdAndFoyerId(actifId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Actif introuvable : " + actifId));
    }

    private ActifDto toDto(Actif a) {
        return new ActifDto(a.getId(), a.getLibelle(), a.getTypeActif(),
                a.getSoldeInitial(), a.getDevise(), a.getTauxCroissanceAnnuel(),
                a.getOrdre(), a.isActif());
    }
}
