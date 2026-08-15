package ch.homely.compte;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CompteMembreRepository extends JpaRepository<CompteMembre, CompteMembreId> {

    Optional<CompteMembre> findByCompte_IdAndMembre_Id(UUID compteId, UUID membreId);

    /** Le (au plus un) compte primaire actuellement configuré pour un membre. */
    List<CompteMembre> findAllByMembre_IdAndEstPrimaireTrue(UUID membreId);

    /** Tous les couples (compte, membre) marqués primaires pour un foyer donné (agrégation dashboard). */
    List<CompteMembre> findAllByCompte_Foyer_IdAndEstPrimaireTrue(UUID foyerId);

    /** Utilisé avant la désactivation d'un compte : refuse s'il est encore le primaire d'un membre. */
    boolean existsByCompte_IdAndEstPrimaireTrue(UUID compteId);
}
