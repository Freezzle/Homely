package ch.homely.foyer;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccesFoyerRepository extends JpaRepository<AccesFoyer, UUID> {

    Optional<AccesFoyer> findByUtilisateurIdAndFoyerId(UUID utilisateurId, UUID foyerId);

    List<AccesFoyer> findAllByFoyerId(UUID foyerId);

    List<AccesFoyer> findAllByUtilisateurId(UUID utilisateurId);

    boolean existsByUtilisateurIdAndFoyerId(UUID utilisateurId, UUID foyerId);
}
