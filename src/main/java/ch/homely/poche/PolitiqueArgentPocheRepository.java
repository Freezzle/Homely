package ch.homely.poche;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PolitiqueArgentPocheRepository extends JpaRepository<PolitiqueArgentPoche, UUID> {

    // `open-in-view: false` : le routage est chargé avec l'entité, sinon le mapping
    // vers le DTO (fait hors transaction, dans le contrôleur) lève LazyInitializationException.

    @EntityGraph(attributePaths = "routage")
    List<PolitiqueArgentPoche> findAllByScenarioIdOrderByMembreIdAscDateDebutAsc(UUID scenarioId);

    @EntityGraph(attributePaths = "routage")
    List<PolitiqueArgentPoche> findAllByScenarioIdAndMembreIdOrderByDateDebutAsc(
            UUID scenarioId, UUID membreId);

    @EntityGraph(attributePaths = "routage")
    Optional<PolitiqueArgentPoche> findByIdAndScenarioId(UUID id, UUID scenarioId);

    /**
     * Utilisé avant la désactivation d'un compte : refuse si une politique le référence
     * encore, comme compte pivot (source) <b>ou</b> comme contrepartie créditée.
     */
    @Query("""
        SELECT COUNT(p) > 0 FROM PolitiqueArgentPoche p
        LEFT JOIN p.routage r
        WHERE p.comptePivot.id = :compteId OR r.compte.id = :compteId
        """)
    boolean existsByCompteReference(UUID compteId);

    /**
     * Politique active pour {@code (membre, mois)} — au plus une (contrainte
     * de non-chevauchement portée par le service). {@code mois} est le 1er du mois.
     */
    @EntityGraph(attributePaths = "routage")
    @Query("""
        SELECT p FROM PolitiqueArgentPoche p
        WHERE p.scenario.id = :scenarioId
          AND p.membre.id = :membreId
          AND p.dateDebut <= :mois
          AND (p.dateFin IS NULL OR p.dateFin >= :mois)
        """)
    Optional<PolitiqueArgentPoche> findActiveForMois(UUID scenarioId, UUID membreId, LocalDate mois);
}
