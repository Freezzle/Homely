package ch.homely.poche.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Une contrepartie d'un versement d'argent de poche : un compte de poche crédité et
 * sa part du versement.
 *
 * <p>La somme des quotes-parts d'une même politique/allocation doit valoir 1
 * (validée en service, Bean Validation ne voyant qu'une ligne à la fois).
 * {@code quotePart} null → 1, pour permettre l'écriture courte à un seul compte.</p>
 */
public record LigneRoutagePocheDto(
        @NotNull UUID compteId,
        @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal quotePart
) {}
