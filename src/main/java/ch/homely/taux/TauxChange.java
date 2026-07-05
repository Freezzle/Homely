package ch.homely.taux;

import ch.homely.foyer.Foyer;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "taux_change",
        uniqueConstraints = @UniqueConstraint(columnNames = {"foyer_id", "devise"}))
@Getter @Setter @NoArgsConstructor
public class TauxChange {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "foyer_id", nullable = false)
    private Foyer foyer;

    @Column(nullable = false, length = 3)
    private String devise;

    /** Taux de conversion vers la devise de base du foyer. */
    @Column(name = "taux_vers_base", nullable = false, precision = 18, scale = 8)
    private BigDecimal tauxVersBase;
}
