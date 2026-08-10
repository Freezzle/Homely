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
import java.util.stream.Collectors;

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
    private boolean actif = true;

    /** Rattachements membre ↔ compte (1..N), portant le drapeau "compte primaire". */
    @OneToMany(mappedBy = "compte", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private Set<CompteMembre> compteMembres = new HashSet<>();

    /** Vue dérivée (lecture seule) des membres rattachés — pour compatibilité des lectures
     *  existantes. Toute mutation du rattachement doit passer par {@link #getCompteMembres()}. */
    public Set<Membre> getMembres() {
        return compteMembres.stream().map(CompteMembre::getMembre).collect(Collectors.toSet());
    }
}
