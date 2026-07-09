package ch.homely.categorie;

import ch.homely.foyer.Foyer;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "categorie")
@Getter @Setter @NoArgsConstructor
public class Categorie {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "foyer_id", nullable = false)
    private Foyer foyer;

    @Column(nullable = false, length = 120)
    private String libelle;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_poste", nullable = false, length = 16)
    private TypeCategorie typePoste;


    @Column(nullable = false)
    private int ordre = 0;

    @Column(nullable = false)
    private boolean actif = true;
}
