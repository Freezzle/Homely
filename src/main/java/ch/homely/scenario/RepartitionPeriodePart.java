package ch.homely.scenario;

import ch.homely.membre.Membre;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Quote-part d'un membre pour une {@link RepartitionPeriode}.
 */
@Entity
@Table(name = "repartition_periode_part",
        uniqueConstraints = @UniqueConstraint(columnNames = {"periode_id", "membre_id"}))
@Getter @Setter @NoArgsConstructor
public class RepartitionPeriodePart {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "periode_id", nullable = false)
    private RepartitionPeriode periode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "membre_id", nullable = false)
    private Membre membre;

    @Column(name = "quote_part", nullable = false, precision = 9, scale = 6)
    private BigDecimal quotePart;

    @Column(nullable = false)
    private int ordre = 0;
}

