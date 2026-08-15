package ch.homely.poche;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PolitiqueArgentPocheRepository extends JpaRepository<PolitiqueArgentPoche, UUID> {

    List<PolitiqueArgentPoche> findAllByScenarioIdOrderByMembreIdAscDateDebutAsc(UUID scenarioId);

    List<PolitiqueArgentPoche> findAllByScenarioIdAndMembreIdOrderByDateDebutAsc(
            UUID scenarioId, UUID membreId);

    Optional<PolitiqueArgentPoche> findByIdAndScenarioId(UUID id, UUID scenarioId);

    /** Utilisé avant la désactivation d'un compte : refuse si une politique le crédite encore. */
    boolean existsByCompte_Id(UUID compteId);

    /**
     * Politique active pour {@code (membre, mois)} — au plus une (contrainte
     * de non-chevauchement portée par le service). {@code mois} est le 1er du mois.
     */
    @Query("""
        SELECT p FROM PolitiqueArgentPoche p
        WHERE p.scenario.id = :scenarioId
          AND p.membre.id = :membreId
          AND p.dateDebut <= :mois
          AND (p.dateFin IS NULL OR p.dateFin >= :mois)
        """)
    Optional<PolitiqueArgentPoche> findActiveForMois(UUID scenarioId, UUID membreId, LocalDate mois);
}
