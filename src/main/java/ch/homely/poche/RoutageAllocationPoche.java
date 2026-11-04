package ch.homely.poche;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Contrepartie d'une {@link AllocationArgentPoche} : un compte de poche crédité
 * par ce versement ponctuel, pour sa
 * {@link RoutageArgentPoche#getQuotePart() quote-part}.
 */
@Entity
@Table(name = "routage_allocation_poche",
        uniqueConstraints = @UniqueConstraint(columnNames = {"allocation_id", "compte_id"}))
@Getter @Setter @NoArgsConstructor
public class RoutageAllocationPoche extends RoutageArgentPoche {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "allocation_id", nullable = false)
    private AllocationArgentPoche allocation;
}
