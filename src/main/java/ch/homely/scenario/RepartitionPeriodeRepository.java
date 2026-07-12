package ch.homely.scenario;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RepartitionPeriodeRepository extends JpaRepository<RepartitionPeriode, UUID> {

    @Query("""
            SELECT rp FROM RepartitionPeriode rp
            WHERE rp.scenario.id = :scenarioId
            ORDER BY rp.debut ASC
            """)
    List<RepartitionPeriode> findByScenarioId(UUID scenarioId);

    @Query("""
            SELECT rp FROM RepartitionPeriode rp
            LEFT JOIN FETCH rp.parts pp
            LEFT JOIN FETCH pp.membre
            WHERE rp.scenario.id = :scenarioId
              AND rp.scenario.foyer.id = :foyerId
            ORDER BY rp.debut ASC
            """)
    List<RepartitionPeriode> findWithPartsForScenario(UUID scenarioId, UUID foyerId);

    @Query("""
            SELECT rp FROM RepartitionPeriode rp
            WHERE rp.id = :id
              AND rp.scenario.id = :scenarioId
              AND rp.scenario.foyer.id = :foyerId
            """)
    Optional<RepartitionPeriode> findByIdAndScenarioIdAndFoyerId(UUID id, UUID scenarioId, UUID foyerId);

    @Query("""
            SELECT rp FROM RepartitionPeriode rp
            WHERE rp.scenario.id = :scenarioId
              AND rp.fin IS NULL
            """)
    Optional<RepartitionPeriode> findOpenPeriode(UUID scenarioId);

    @Query("""
            SELECT COUNT(rp) > 0 FROM RepartitionPeriode rp
            WHERE rp.scenario.id = :scenarioId
              AND rp.fin IS NULL
              AND rp.id <> :excludeId
            """)
    boolean existsAutrePeriodeOuverte(UUID scenarioId, UUID excludeId);
}

