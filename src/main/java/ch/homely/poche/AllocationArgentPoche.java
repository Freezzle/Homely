package ch.homely.poche;

import ch.homely.compte.Compte;
import ch.homely.membre.Membre;
import ch.homely.scenario.Scenario;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Allocation d'argent de poche ponctuelle, écrasant tout calcul de politique
 * pour un couple {@code (scénario, membre, mois)} donné.
 *
 * <p>Contrainte d'unicité {@code (scenario_id, membre_id, mois)} portée au niveau
 * SQL — toute tentative de doublon lève une {@code ConflitException}.</p>
 *
 * <p>Aucune règle de continuité : c'est un point isolé dans le temps, indépendant
 * des politiques (peut exister sans politique dessous, ne dépend pas des dates).</p>
 */
@Entity
@Table(name = "allocation_argent_poche")
@Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class AllocationArgentPoche {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scenario_id", nullable = false)
    private Scenario scenario;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "membre_id", nullable = false)
    private Membre membre;

    /** Compte crédité par ce versement ponctuel. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "compte_id", nullable = false)
    private Compte compte;

    /** Mois concerné (toujours stocké comme le 1er du mois). */
    @Column(nullable = false)
    private LocalDate mois;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal montant;

    /** Note libre optionnelle (ex. "Vacances"). */
    @Column(length = 255)
    private String raison;

    @CreatedDate
    @Column(name = "date_creation", nullable = false, updatable = false)
    private Instant dateCreation;

    @LastModifiedDate
    @Column(name = "date_modif", nullable = false)
    private Instant dateModif;
}
