package ch.homely.membre;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MembreRepository extends JpaRepository<Membre, UUID> {

    List<Membre> findAllByFoyerIdAndActifTrueOrderByOrdre(UUID foyerId);

    Optional<Membre> findByIdAndFoyerId(UUID id, UUID foyerId);

    boolean existsByIdAndFoyerId(UUID id, UUID foyerId);

    /** Chargement batch de membres actifs d'un foyer, utilisé pour valider les rattachements de comptes. */
    List<Membre> findAllByIdInAndFoyerIdAndActifTrue(Collection<UUID> ids, UUID foyerId);
}
