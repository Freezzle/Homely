package ch.homely.objectif;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ObjectifRepository extends JpaRepository<Objectif, UUID> {

    List<Objectif> findAllByScenarioIdOrderByDateCreation(UUID scenarioId);

    Optional<Objectif> findByIdAndScenarioId(UUID id, UUID scenarioId);
}
