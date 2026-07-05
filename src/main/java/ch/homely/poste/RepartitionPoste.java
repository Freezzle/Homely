package ch.homely.poste;

import ch.homely.membre.Membre;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "repartition_poste",
        uniqueConstraints = @UniqueConstraint(columnNames = {"poste_id", "membre_id"}))
@Getter @Setter @NoArgsConstructor
public class RepartitionPoste {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "poste_id", nullable = false)
    private Poste poste;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "membre_id", nullable = false)
    private Membre membre;

    @Column(name = "quote_part", nullable = false, precision = 9, scale = 6)
    private BigDecimal quotePart;
}
