package ch.homely.compte;

import ch.homely.commun.CodesErreur;
import ch.homely.commun.RegleMetierException;
import ch.homely.commun.RessourceIntrouvableException;
import ch.homely.compte.dto.CompteDto;
import ch.homely.compte.dto.CompteRequest;
import ch.homely.foyer.Foyer;
import ch.homely.foyer.FoyerRepository;
import ch.homely.foyer.RoleFoyer;
import ch.homely.membre.Membre;
import ch.homely.membre.MembreRepository;
import ch.homely.securite.MultiTenantService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** T6.1 — CRUD Comptes (scopé foyer). */
@Service
@Transactional
public class CompteService {

    private final CompteRepository compteRepo;
    private final FoyerRepository  foyerRepo;
    private final MembreRepository membreRepo;
    private final MultiTenantService multiTenant;

    public CompteService(CompteRepository compteRepo, FoyerRepository foyerRepo,
                         MembreRepository membreRepo, MultiTenantService multiTenant) {
        this.compteRepo  = compteRepo;
        this.foyerRepo   = foyerRepo;
        this.membreRepo  = membreRepo;
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
        appliquer(c, req, foyerId);
        return toDto(compteRepo.save(c));
    }

    public CompteDto modifier(UUID foyerId, UUID compteId, CompteRequest req) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Compte c = trouver(foyerId, compteId);
        appliquer(c, req, foyerId);
        return toDto(compteRepo.save(c));
    }

    public void supprimer(UUID foyerId, UUID compteId) {
        multiTenant.verifierAcces(foyerId, RoleFoyer.EDITOR);
        Compte c = trouver(foyerId, compteId);
        c.setActif(false);
        compteRepo.save(c);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private void appliquer(Compte c, CompteRequest req, UUID foyerId) {
        c.setLibelle(req.libelle());
        c.setSoldeInitial(req.soldeInitial() != null ? req.soldeInitial() : BigDecimal.ZERO);
        c.setDevise(req.devise());
        c.setOrdre(req.ordre());

        // Résoudre les membres actifs demandés (scopés foyer)
        Set<UUID> demandes = req.membreIds();
        List<Membre> actifsTrouves = membreRepo.findAllByIdInAndFoyerIdAndActifTrue(demandes, foyerId);

        // Vérifier qu'aucun ID invalide/inactif/autre-foyer n'a été transmis
        if (actifsTrouves.size() != demandes.size()) {
            throw new RegleMetierException(
                    CodesErreur.COMPTE_SANS_MEMBRE,
                    "Un ou plusieurs membres demandés sont invalides, inactifs ou n'appartiennent pas à ce foyer.");
        }

        // En édition : conserver les membres déjà rattachés qui sont devenus inactifs
        Set<Membre> inactifsExistants = c.getMembres().stream()
                .filter(m -> !m.isActif())
                .collect(Collectors.toSet());

        Set<Membre> nouveauxMembres = new HashSet<>(actifsTrouves);
        nouveauxMembres.addAll(inactifsExistants);
        c.setMembres(nouveauxMembres);
    }

    private Compte trouver(UUID foyerId, UUID compteId) {
        return compteRepo.findByIdAndFoyerId(compteId, foyerId)
                .orElseThrow(() -> new RessourceIntrouvableException("Compte introuvable : " + compteId));
    }

    private CompteDto toDto(Compte c) {
        Set<UUID> membreIds = c.getMembres().stream()
                .map(Membre::getId)
                .collect(Collectors.toSet());
        return new CompteDto(c.getId(), c.getLibelle(),
                c.getSoldeInitial(), c.getDevise(), c.getOrdre(), c.isActif(), membreIds);
    }
}
