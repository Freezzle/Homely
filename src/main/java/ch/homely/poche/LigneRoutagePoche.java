package ch.homely.poche;

import java.util.UUID;

/**
 * Contrepartie d'un versement d'argent de poche résolu : un compte de poche crédité
 * et la fraction du montant qui lui revient.
 *
 * @param compteId  compte de poche crédité
 * @param quotePart fraction du montant versée sur ce compte, ∈ ]0,1]
 *                  (somme = 1 sur l'ensemble des contreparties d'une résolution)
 */
public record LigneRoutagePoche(
        UUID compteId,
        double quotePart
) {}
