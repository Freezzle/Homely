package ch.homely.poche;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AllocationArgentPocheRepository extends JpaRepository<AllocationArgentPoche, UUID> {

    // `open-in-view: false` : le routage est chargé avec l'entité, sinon le mapping
    // vers le DTO (fait hors transaction, dans le contrôleur) lève LazyInitializationException.

    @EntityGraph(attributePaths = "routage")
    List<AllocationArgentPoche> findAllByScenarioIdOrderByMoisDesc(UUID scenarioId);

    @EntityGraph(attributePaths = "routage")
    List<AllocationArgentPoche> findAllByScenarioIdAndMembreIdOrderByMoisDesc(
            UUID scenarioId, UUID membreId);

    @EntityGraph(attributePaths = "routage")
    List<AllocationArgentPoche> findAllByScenarioIdAndMembreIdAndMoisBetweenOrderByMoisAsc(
            UUID scenarioId, UUID membreId, LocalDate moisMin, LocalDate moisMax);

    @EntityGraph(attributePaths = "routage")
    Optional<AllocationArgentPoche> findByIdAndScenarioId(UUID id, UUID scenarioId);

    /**
     * Utilisé avant la désactivation d'un compte : refuse si une allocation le référence
     * encore, comme compte pivot (source) <b>ou</b> comme contrepartie créditée.
     */
    @Query("""
        SELECT COUNT(a) > 0 FROM AllocationArgentPoche a
        LEFT JOIN a.routage r
        WHERE a.comptePivot.id = :compteId OR r.compte.id = :compteId
        """)
    boolean existsByCompteReference(UUID compteId);

    @EntityGraph(attributePaths = "routage")
    Optional<AllocationArgentPoche> findByScenarioIdAndMembreIdAndMois(
            UUID scenarioId, UUID membreId, LocalDate mois);
}
