package ch.homely.compte;

import ch.homely.foyer.Foyer;
import ch.homely.membre.Membre;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "compte")
@Getter @Setter @NoArgsConstructor
public class Compte {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "foyer_id", nullable = false)
    private Foyer foyer;

    @Column(nullable = false, length = 120)
    private String libelle;

    @Column(name = "solde_initial", nullable = false, precision = 15, scale = 2)
    private BigDecimal soldeInitial = BigDecimal.ZERO;

    @Column(length = 3)
    private String devise;

    @Column(nullable = false)
    private int ordre = 0;

    @Column(nullable = false)
    private boolean actif = true;

    /** Membres rattachés à ce compte (1..N). */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "compte_membre",
            joinColumns = @JoinColumn(name = "compte_id"),
            inverseJoinColumns = @JoinColumn(name = "membre_id")
    )
    private Set<Membre> membres = new HashSet<>();
}
