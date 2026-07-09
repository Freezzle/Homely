package ch.homely.categorie;

import ch.homely.categorie.dto.CategorieDto;
import ch.homely.categorie.dto.CategorieRequest;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.foyer.Foyer;
import ch.homely.foyer.FoyerRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.poste.PosteRepository;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** T6.1 — CRUD Catégories (scopé foyer). */
@Service
@Transactional
public class CategorieService {

    private final CategorieRepository categorieRepo;
    private final FoyerRepository foyerRepo;
    private final PosteRepository posteRepo;
    private final MultiTenantService multiTenant;

    public CategorieService(CategorieRepository categorieRepo, FoyerRepository foyerRepo,
                             PosteRepository posteRepo, MultiTenantService multiTenant) {
        this.categorieRepo = categorieRepo;
        this.foyerRepo     = foyerRepo;
        this.posteRepo     = posteRepo;
        this.multiTenant   = multiTenant;
    }

    @Transactional(readOnly = true)
    public List<CategorieDto> lister(UUID foyerId, TypeCategorie typePoste) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        List<Categorie> cats = typePoste != null
                ? categorieRepo.findAllByFoyerIdAndTypePosteAndActifTrueOrderByOrdre(foyerId, typePoste)
                : categorieRepo.findAllByFoyerIdAndActifTrueOrderByTypePosteAscOrdreAsc(foyerId);
        return cats.stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public CategorieDto obtenir(UUID foyerId, UUID categorieId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.VIEWER);
        return toDto(trouver(foyerId, categorieId));
    }

    public CategorieDto creer(UUID foyerId, CategorieRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Foyer foyer = foyerRepo.findById(foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Foyer introuvable"));
        Categorie c = new Categorie();
        c.setFoyer(foyer);
        c.setLibelle(req.libelle());
        c.setTypePoste(req.typePoste());
        c.setOrdre(req.ordre());
        return toDto(categorieRepo.save(c));
    }

    public CategorieDto modifier(UUID foyerId, UUID categorieId, CategorieRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Categorie c = trouver(foyerId, categorieId);
        c.setLibelle(req.libelle());
        c.setOrdre(req.ordre());
        return toDto(categorieRepo.save(c));
    }

    public void supprimer(UUID foyerId, UUID categorieId, UUID migrerVersCategorieId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Categorie c = trouver(foyerId, categorieId);
        if (migrerVersCategorieId != null) {
            // Valider que la catégorie cible appartient au même foyer
            trouver(foyerId, migrerVersCategorieId);
            posteRepo.migrerCategorie(categorieId, migrerVersCategorieId);
        } else {
            // Dissocier les postes (categorie_id → NULL)
            posteRepo.dissocierCategorie(categorieId);
        }
        categorieRepo.delete(c);
    }

    private Categorie trouver(UUID foyerId, UUID categorieId) {
        return categorieRepo.findByIdAndFoyerId(categorieId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException(
                        "Catégorie introuvable : " + categorieId));
    }

    private CategorieDto toDto(Categorie c) {
        return new CategorieDto(c.getId(), c.getLibelle(), c.getTypePoste(),
                c.getOrdre(), c.isActif());
    }
}
