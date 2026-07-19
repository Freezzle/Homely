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
     * Charge un scénario complet avec toutes ses relations nécessaires au moteur :
     * postes + répartitions par poste + ventilations + répartitions par défaut.
     * Evite le N+1 lors du calcul de projection.
     */
    @Query("""
            SELECT DISTINCT s FROM Scenario s
            LEFT JOIN FETCH s.repartitionsDefaut rd
            LEFT JOIN FETCH rd.membre
            WHERE s.id = :id AND s.foyer.id = :foyerId
            """)
    Optional<Scenario> findScenarioAvecRepartitions(UUID id, UUID foyerId);
}
