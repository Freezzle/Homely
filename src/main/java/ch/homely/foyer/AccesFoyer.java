package ch.homely.foyer;

import ch.homely.utilisateur.Utilisateur;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "acces_foyer",
        uniqueConstraints = @UniqueConstraint(columnNames = {"utilisateur_id", "foyer_id"}))
@Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class AccesFoyer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "utilisateur_id", nullable = false)
    private Utilisateur utilisateur;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "foyer_id", nullable = false)
    private Foyer foyer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RoleFoyer role;

    @CreatedDate
    @Column(name = "date_ajout", nullable = false, updatable = false)
    private Instant dateAjout;
}
