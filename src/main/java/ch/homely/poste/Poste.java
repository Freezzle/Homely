package ch.homely.poste;

import ch.homely.categorie.Categorie;
import ch.homely.compte.Compte;
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

    /** Compte source pour les postes RESERVE (débit). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_source")
    private Compte compteSource;

    @Column(nullable = false)
    private int ordre = 0;

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
