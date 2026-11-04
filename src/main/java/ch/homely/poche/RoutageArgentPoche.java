package ch.homely.poche;

import ch.homely.compte.Compte;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Ligne de <b>routage</b> d'un versement d'argent de poche : un compte de poche
 * crédité, et sa part dans le versement.
 *
 * <p>L'argent de poche suit le <b>sens REVENU</b> des postes : le compte pivot
 * (compte <i>source</i> qui finance) alimente ces contreparties. Si {@code compte}
 * est le pivot lui-même, aucun virement n'est simulé — l'argent est déjà au bon
 * endroit, seule la dépense reste imputée sur ce compte.</p>
 *
 * <p>{@link #quotePart} ∈ ]0,1] ; la somme des quotes-parts d'une même
 * politique/allocation vaut 1.</p>
 *
 * <p>Classe de base partagée par {@link RoutagePolitiquePoche} et
 * {@link RoutageAllocationPoche} : deux tables distinctes (clés étrangères
 * strictes) plutôt qu'une table polymorphe à deux FK nullables.</p>
 */
@MappedSuperclass
@Getter @Setter @NoArgsConstructor
public abstract class RoutageArgentPoche {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "compte_id", nullable = false)
    private Compte compte;

    @Column(name = "quote_part", nullable = false, precision = 9, scale = 6)
    private BigDecimal quotePart = BigDecimal.ONE;
}
