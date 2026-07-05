package ch.homely.poste;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PosteRepository extends JpaRepository<Poste, UUID> {

    List<Poste> findAllByScenarioIdOrderByOrdre(UUID scenarioId);

    Optional<Poste> findByIdAndScenarioId(UUID id, UUID scenarioId);

    /**
     * Charge tous les postes d'un scénario avec leurs répartitions (requête 1/2).
     * Résultat dédupliqué via DISTINCT pour éviter le produit cartésien.
     */
    @Query("""
            SELECT DISTINCT p FROM Poste p
            LEFT JOIN FETCH p.repartitions rp
            LEFT JOIN FETCH rp.membre
            WHERE p.scenario.id = :scenarioId
            """)
    List<Poste> findPostesAvecRepartitions(UUID scenarioId);

    /**
     * Charge tous les postes d'un scénario avec leurs ventilations (requête 2/2).
     */
    @Query("""
            SELECT DISTINCT p FROM Poste p
            LEFT JOIN FETCH p.ventilations vc
            LEFT JOIN FETCH vc.membre
            LEFT JOIN FETCH vc.compte
            WHERE p.scenario.id = :scenarioId
            """)
    List<Poste> findPostesAvecVentilations(UUID scenarioId);

    /**
     * T1.3 — Requête principale du moteur : charge postes + répartitions + ventilations
     * pour un scénario donné, scopée par foyer (sécurité multi-tenant).
     * Utilise 2 requêtes séquentielles (répartitions puis ventilations) pour éviter le N+1
     * et le produit cartésien sur deux collections eagerly chargées.
     */
    @Query("""
            SELECT DISTINCT p FROM Poste p
            LEFT JOIN FETCH p.repartitions rp
            LEFT JOIN FETCH rp.membre
            WHERE p.scenario.id = :scenarioId
              AND p.scenario.foyer.id = :foyerId
            """)
    List<Poste> findForMoteur(UUID scenarioId, UUID foyerId);

    @Query("""
            SELECT DISTINCT p FROM Poste p
            LEFT JOIN FETCH p.ventilations vc
            LEFT JOIN FETCH vc.membre
            LEFT JOIN FETCH vc.compte
            WHERE p.scenario.id = :scenarioId
              AND p.scenario.foyer.id = :foyerId
            """)
    List<Poste> findForMoteurVentilations(UUID scenarioId, UUID foyerId);
}
