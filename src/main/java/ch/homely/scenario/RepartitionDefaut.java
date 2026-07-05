package ch.homely.scenario;

import ch.homely.membre.Membre;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "repartition_defaut",
        uniqueConstraints = @UniqueConstraint(columnNames = {"scenario_id", "membre_id"}))
@Getter @Setter @NoArgsConstructor
public class RepartitionDefaut {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scenario_id", nullable = false)
    private Scenario scenario;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "membre_id", nullable = false)
    private Membre membre;

    @Column(name = "quote_part", nullable = false, precision = 9, scale = 6)
    private BigDecimal quotePart;
}
