package ch.homely.poche;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Contrepartie d'une {@link PolitiqueArgentPoche} : un compte de poche crédité
 * chaque mois, pour sa {@link RoutageArgentPoche#getQuotePart() quote-part}.
 */
@Entity
@Table(name = "routage_politique_poche",
        uniqueConstraints = @UniqueConstraint(columnNames = {"politique_id", "compte_id"}))
@Getter @Setter @NoArgsConstructor
public class RoutagePolitiquePoche extends RoutageArgentPoche {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "politique_id", nullable = false)
    private PolitiqueArgentPoche politique;
}
