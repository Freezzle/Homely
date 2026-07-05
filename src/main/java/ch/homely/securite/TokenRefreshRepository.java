package ch.homely.securite;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface TokenRefreshRepository extends JpaRepository<TokenRefresh, UUID> {

    Optional<TokenRefresh> findByToken(String token);

    @Modifying
    @Query("UPDATE TokenRefresh t SET t.revoque = true WHERE t.utilisateur.id = :utilisateurId")
    void revoquerTousParUtilisateur(UUID utilisateurId);

    @Modifying
    @Query("DELETE FROM TokenRefresh t WHERE t.expireA < CURRENT_TIMESTAMP OR t.revoque = true")
    void purgerExpires();
}
