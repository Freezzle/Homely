package ch.homely.scenario;

import ch.homely.foyer.Foyer;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "scenario")
@Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class Scenario {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "foyer_id", nullable = false)
    private Foyer foyer;

    @Column(nullable = false, length = 160)
    private String nom;

    @Column(name = "est_reference", nullable = false)
    private boolean estReference = false;

    @Column(name = "annee_depart", nullable = false)
    private int anneeDepart;

    @Column(name = "tresorerie_initiale", nullable = false, precision = 15, scale = 2)
    private BigDecimal tresorerieInitiale = BigDecimal.ZERO;

    @Column(name = "horizon_annees", nullable = false)
    private int horizonAnnees = 9;

    @CreatedDate
    @Column(name = "date_creation", nullable = false, updatable = false)
    private Instant dateCreation;

    @LastModifiedDate
    @Column(name = "date_modification", nullable = false)
    private Instant dateModification;

    @OneToMany(mappedBy = "scenario", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RepartitionDefaut> repartitionsDefaut = new ArrayList<>();
}
