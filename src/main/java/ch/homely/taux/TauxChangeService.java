package ch.homely.taux;

import ch.homely.commun.CodesErreur;
import ch.homely.commun.ConflitException;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.foyer.Foyer;
import ch.homely.foyer.FoyerRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.securite.MultiTenantService;
import ch.homely.taux.dto.TauxChangeDto;
import ch.homely.taux.dto.TauxChangeRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** T6.1 — CRUD TauxChange (scopé foyer). */
@Service
@Transactional
public class TauxChangeService {

    private final TauxChangeRepository tauxRepo;
    private final FoyerRepository foyerRepo;
    private final MultiTenantService multiTenant;

    public TauxChangeService(TauxChangeRepository tauxRepo, FoyerRepository foyerRepo,
                              MultiTenantService multiTenant) {
        this.tauxRepo    = tauxRepo;
        this.foyerRepo   = foyerRepo;
        this.multiTenant = multiTenant;
    }

    @Transactional(readOnly = true)
    public List<TauxChangeDto> lister(UUID foyerId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return tauxRepo.findAllByFoyerId(foyerId).stream().map(this::toDto).toList();
    }

    public TauxChangeDto creerOuModifier(UUID foyerId, TauxChangeRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        TauxChange taux = tauxRepo.findByFoyerIdAndDevise(foyerId, req.devise().toUpperCase())
                .orElseGet(() -> {
                    Foyer foyer = foyerRepo.findById(foyerId)
                            .orElseThrow(() -> new RessourceIntrouvableException("Foyer introuvable"));
                    TauxChange t = new TauxChange();
                    t.setFoyer(foyer);
                    t.setDevise(req.devise().toUpperCase());
                    return t;
                });
        taux.setTauxVersBase(req.tauxVersBase());
        return toDto(tauxRepo.save(taux));
    }

    public void supprimer(UUID foyerId, UUID tauxId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        TauxChange t = tauxRepo.findById(tauxId)
                .filter(tx -> tx.getFoyer().getId().equals(foyerId))
                .orElseThrow(() -> new RessourceIntrouvableException("TauxChange introuvable : " + tauxId));
        tauxRepo.delete(t);
    }

    private TauxChangeDto toDto(TauxChange t) {
        return new TauxChangeDto(t.getId(), t.getDevise(), t.getTauxVersBase());
    }
}
