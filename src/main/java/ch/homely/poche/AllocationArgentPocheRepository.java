package ch.homely.poche;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AllocationArgentPocheRepository extends JpaRepository<AllocationArgentPoche, UUID> {

    List<AllocationArgentPoche> findAllByScenarioIdOrderByMoisDesc(UUID scenarioId);

    List<AllocationArgentPoche> findAllByScenarioIdAndMembreIdOrderByMoisDesc(
            UUID scenarioId, UUID membreId);

    List<AllocationArgentPoche> findAllByScenarioIdAndMembreIdAndMoisBetweenOrderByMoisAsc(
            UUID scenarioId, UUID membreId, LocalDate moisMin, LocalDate moisMax);

    Optional<AllocationArgentPoche> findByIdAndScenarioId(UUID id, UUID scenarioId);

    /** Utilisé avant la désactivation d'un compte : refuse si une allocation le crédite encore. */
    boolean existsByCompte_Id(UUID compteId);

    Optional<AllocationArgentPoche> findByScenarioIdAndMembreIdAndMois(
            UUID scenarioId, UUID membreId, LocalDate mois);
}
