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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Politique d'argent de poche récurrente pour un membre, sur une période donnée.
 *
 * <p>La règle de résolution (allocation &gt; politique &gt; 0) est portée par
 * {@link ArgentPocheService}. Cette entité ne fait que porter les paramètres.</p>
 *
 * <p><b>Chevauchements interdits</b> mais <b>trous autorisés</b> (décision produit) —
 * un mois sans politique donne 0 CHF sauf si une {@link AllocationArgentPoche}
 * couvre le mois. La validation est faite en service, pas au niveau SQL, car elle
 * implique le calcul de plages avec {@code date_fin} nullable.</p>
 */
@Entity
@Table(name = "politique_argent_poche")
@Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class PolitiqueArgentPoche {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scenario_id", nullable = false)
    private Scenario scenario;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "membre_id", nullable = false)
    private Membre membre;

    /**
     * Compte <b>pivot</b> : la source qui finance le versement mensuel. L'argent part
     * de ce compte vers les comptes de {@link #routage}. Une contrepartie confondue
     * avec le pivot est un auto-routage (aucun virement).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_pivot_id")
    private Compte comptePivot;

    /** Comptes de poche crédités et leurs quotes-parts (somme = 1). */
    @OneToMany(mappedBy = "politique", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RoutagePolitiquePoche> routage = new ArrayList<>();

    @Column(nullable = false, length = 160)
    private String nom;

    /** Premier mois inclus dans la période (toujours le 1er du mois). */
    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    /** Dernier mois inclus (toujours le 1er du mois), ou {@code null} pour politique ouverte. */
    @Column(name = "date_fin")
    private LocalDate dateFin;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ModePolitiqueArgentPoche mode;

    /** Mode VARIABLE — minimum garanti versé chaque mois. */
    @Column(precision = 15, scale = 2)
    private BigDecimal socle;

    /** Mode VARIABLE — part (0-100) du RàV brut prélevée (socle = plancher). */
    @Column(precision = 5, scale = 2)
    private BigDecimal pourcentage;

    /** Mode VARIABLE — maximum absolu du versement mensuel. */
    @Column(precision = 15, scale = 2)
    private BigDecimal plafond;

    /** Mode FIXE — montant constant versé chaque mois. */
    @Column(name = "montant_fixe", precision = 15, scale = 2)
    private BigDecimal montantFixe;

    @CreatedDate
    @Column(name = "date_creation", nullable = false, updatable = false)
    private Instant dateCreation;

    @LastModifiedDate
    @Column(name = "date_modif", nullable = false)
    private Instant dateModif;
}
