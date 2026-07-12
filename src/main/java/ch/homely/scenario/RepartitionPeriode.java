package ch.homely.scenario;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Fenêtre temporelle de répartition par défaut d'un scénario.
 *
 * <p>Les périodes d'un scénario forment une couverture continue sans chevauchement.
 * Une seule période peut avoir {@code fin = null} (période ouverte, la plus récente).</p>
 */
@Entity
@Table(name = "repartition_periode")
@Getter @Setter @NoArgsConstructor
public class RepartitionPeriode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scenario_id", nullable = false)
    private Scenario scenario;

    @Column
    private LocalDate debut;

    @Column
    private LocalDate fin;

    @OneToMany(mappedBy = "periode", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("ordre ASC")
    private List<RepartitionPeriodePart> parts = new ArrayList<>();
}

