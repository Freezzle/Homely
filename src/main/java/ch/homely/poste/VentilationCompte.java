package ch.homely.poste;

import ch.homely.compte.Compte;
import ch.homely.membre.Membre;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Ligne de <b>routage</b> d'un poste : une contrepartie {@code compte} vers laquelle
 * (ou depuis laquelle) transite la part du {@code membre}.
 *
 * <p>Le sens est dérivé du type du poste : pour une {@code CHARGE}/{@code RESERVE} ce
 * compte <i>alimente</i> le {@link Poste#getComptePivot() compte pivot} ; pour un
 * {@code REVENU} il est <i>alimenté</i> par lui. Si {@code compte} est le pivot
 * lui-même, aucun virement n'est simulé (l'argent est déjà au bon endroit).</p>
 *
 * <p>{@link #quotePart} est la part <b>dans la part du membre</b> (pas dans le total
 * du poste) : la somme des quotes-parts d'un même membre sur un poste vaut 1.</p>
 */
@Entity
@Table(name = "ventilation_compte",
        uniqueConstraints = @UniqueConstraint(columnNames = {"poste_id", "membre_id", "compte_id"}))
@Getter @Setter @NoArgsConstructor
public class VentilationCompte {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "poste_id", nullable = false)
    private Poste poste;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "membre_id", nullable = false)
    private Membre membre;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "compte_id", nullable = false)
    private Compte compte;

    /** Part dans la part du membre, ∈ [0,1] ; somme = 1 par membre sur un même poste. */
    @Column(name = "quote_part", nullable = false, precision = 9, scale = 6)
    private BigDecimal quotePart = BigDecimal.ONE;
}
