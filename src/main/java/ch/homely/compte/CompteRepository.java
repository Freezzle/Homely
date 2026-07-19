package ch.homely.compte;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CompteRepository extends JpaRepository<Compte, UUID> {

    List<Compte> findAllByFoyerIdAndActifTrueOrderByOrdre(UUID foyerId);

    Optional<Compte> findByIdAndFoyerId(UUID id, UUID foyerId);

    int deleteAllByFoyerId(UUID foyerId);
}
