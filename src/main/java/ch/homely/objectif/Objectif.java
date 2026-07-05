package ch.homely.objectif;

import ch.homely.actif.Actif;
import ch.homely.categorie.Categorie;
import ch.homely.compte.Compte;
import ch.homely.scenario.Scenario;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "objectif")
@Getter @Setter @NoArgsConstructor
@EntityListeners(AuditingEntityListener.class)
public class Objectif {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scenario_id", nullable = false)
    private Scenario scenario;

    @Column(nullable = false, length = 160)
    private String libelle;

    /** Catégorie de type PROJET associée à cet objectif (optionnel). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "categorie_projet_id")
    private Categorie categorieProjet;

    @Column(name = "montant_cible", nullable = false, precision = 15, scale = 2)
    private BigDecimal montantCible;

    @Column
    private LocalDate echeance;

    /** Support de l'objectif : exactement un de compteId/actifId doit être renseigné. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_id")
    private Compte compte;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actif_id")
    private Actif actif;

    @CreatedDate
    @Column(name = "date_creation", nullable = false, updatable = false)
    private Instant dateCreation;
}
