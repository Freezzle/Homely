package ch.homely.actif;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ActifRepository extends JpaRepository<Actif, UUID> {

    List<Actif> findAllByFoyerIdAndActifTrueOrderByOrdre(UUID foyerId);

    Optional<Actif> findByIdAndFoyerId(UUID id, UUID foyerId);
}
