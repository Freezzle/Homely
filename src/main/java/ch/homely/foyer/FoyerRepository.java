package ch.homely.foyer;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface FoyerRepository extends JpaRepository<Foyer, UUID> {

    @Query("""
            SELECT f FROM Foyer f
            JOIN AccesFoyer a ON a.foyer = f
            WHERE a.utilisateur.id = :utilisateurId
            """)
    List<Foyer> findAllByUtilisateurId(UUID utilisateurId);
}
