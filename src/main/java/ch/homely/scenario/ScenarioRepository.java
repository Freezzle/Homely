package ch.homely.scenario;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ScenarioRepository extends JpaRepository<Scenario, UUID> {

    List<Scenario> findAllByFoyerIdOrderByDateCreation(UUID foyerId);

    Optional<Scenario> findByIdAndFoyerId(UUID id, UUID foyerId);

    boolean existsByFoyerIdAndEstReferenceTrue(UUID foyerId);

    Optional<Scenario> findByFoyerIdAndEstReferenceTrue(UUID foyerId);

    @Query("SELECT s.id FROM Scenario s WHERE s.foyer.id = :foyerId")
    List<UUID> findIdsByFoyerId(UUID foyerId);

    @Modifying
    @Query("DELETE FROM Scenario s WHERE s.foyer.id = :foyerId")
    int deleteAllByFoyerId(UUID foyerId);

    /**
     * Charge un scénario avec son foyer (répartitions chargées séparément via
     * RepartitionPeriodeRepository). Evite le N+1 lors du calcul de projection.
     */
    @Query("""
            SELECT DISTINCT s FROM Scenario s
            JOIN FETCH s.foyer
            WHERE s.id = :id AND s.foyer.id = :foyerId
            """)
    Optional<Scenario> findScenarioAvecRepartitions(UUID id, UUID foyerId);
}
