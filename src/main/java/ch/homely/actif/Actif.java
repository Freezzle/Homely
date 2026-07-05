package ch.homely.actif;

import ch.homely.foyer.Foyer;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "actif")
@Getter @Setter @NoArgsConstructor
public class Actif {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "foyer_id", nullable = false)
    private Foyer foyer;

    @Column(nullable = false, length = 120)
    private String libelle;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_actif", nullable = false, length = 24)
    private TypeActif typeActif = TypeActif.AUTRE;

    @Column(name = "solde_initial", nullable = false, precision = 15, scale = 2)
    private BigDecimal soldeInitial = BigDecimal.ZERO;

    @Column(length = 3)
    private String devise;

    @Column(name = "taux_croissance_annuel", nullable = false, precision = 10, scale = 6)
    private BigDecimal tauxCroissanceAnnuel = BigDecimal.ZERO;

    @Column(nullable = false)
    private int ordre = 0;

    @Column(nullable = false)
    private boolean actif = true;
}
