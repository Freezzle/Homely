package ch.homely.taux;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TauxChangeRepository extends JpaRepository<TauxChange, UUID> {

    List<TauxChange> findAllByFoyerId(UUID foyerId);

    Optional<TauxChange> findByFoyerIdAndDevise(UUID foyerId, String devise);

    int deleteAllByFoyerId(UUID foyerId);
}
