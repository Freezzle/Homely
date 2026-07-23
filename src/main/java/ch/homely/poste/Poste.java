package ch.homely.poste;

import ch.homely.categorie.Categorie;
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

@Entity
@Table(name = "poste")
@Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class Poste {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scenario_id", nullable = false)
    private Scenario scenario;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TypePoste type;

    @Column(nullable = false)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categorie_id")
    private Categorie categorie;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal montant = BigDecimal.ZERO;

    @Column(length = 3)
    private String devise;

    @Column(name = "periodicite_mois", nullable = false)
    private int periodiciteMois = 1;

    @Column
    private LocalDate debut;

    @Column
    private LocalDate fin;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ModeComptabilisation mode = ModeComptabilisation.MENSUALISE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private MomentPeriode moment = MomentPeriode.DEBUT_PERIODE;

    /**
     * Nature du poste (descriptif). Défaut {@link NaturePoste#EFFECTIF}.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private NaturePoste nature = NaturePoste.EFFECTIF;

    /**
     * Pourcentage d'estimation (variation min/max) pour nature=ESTIMATION.
     * Ex : montant=100, estimPourcentage=10.0 → plage 90–110.
     * Nullable pour les postes EFFECTIF. Obligatoire si nature=ESTIMATION.
     */
    @Column(precision = 3, scale = 1)
    private BigDecimal estimPourcentage;

    /**
     * Mode de calcul de la répartition entre membres.
     * Défaut {@link TypeRepartition#AUTO} : hérite de la période active du scénario.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "type_repartition", nullable = false, length = 16)
    private TypeRepartition typeRepartition = TypeRepartition.AUTO;


    @Column(nullable = false)
    private int ordre = 0;

    /**
     * Poste dont ce poste est issu par une révision de montant planifiée.
     * Null si ce poste n'appartient pas à une chaîne de révisions.
     */
    @Column(name = "poste_origine_id")
    private UUID posteOrigineId;

    @CreatedDate
    @Column(name = "date_creation", nullable = false, updatable = false)
    private Instant dateCreation;

    @LastModifiedDate
    @Column(name = "date_modification", nullable = false)
    private Instant dateModification;

    @OneToMany(mappedBy = "poste", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RepartitionPoste> repartitions = new ArrayList<>();

    @OneToMany(mappedBy = "poste", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<VentilationCompte> ventilations = new ArrayList<>();
}
