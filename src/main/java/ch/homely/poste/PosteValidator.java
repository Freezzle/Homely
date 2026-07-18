package ch.homely.poste;

import ch.homely.poste.dto.PosteRequest;
import org.springframework.stereotype.Component;
import org.springframework.validation.Errors;
import org.springframework.validation.Validator;

import java.math.BigDecimal;

/**
 * Validateur custom pour PosteRequest.
 * Assure que si nature=ESTIMATION, estimPourcentage est obligatoire et ∈ [0, 100].
 */
@Component
public class PosteValidator implements Validator {

    @Override
    public boolean supports(Class<?> clazz) {
        return PosteRequest.class.isAssignableFrom(clazz);
    }

    @Override
    public void validate(Object target, Errors errors) {
        PosteRequest req = (PosteRequest) target;

        // Si nature=ESTIMATION, estimPourcentage doit être non-null et dans [0, 100]
        if (req.nature() == NaturePoste.ESTIMATION) {
            if (req.estimPourcentage() == null) {
                errors.rejectValue(
                    "estimPourcentage",
                    "estimation.required",
                    "Le pourcentage d'estimation est obligatoire pour une nature ESTIMATION"
                );
            } else if (req.estimPourcentage().compareTo(BigDecimal.ZERO) < 0
                       || req.estimPourcentage().compareTo(new BigDecimal("100")) > 0) {
                errors.rejectValue(
                    "estimPourcentage",
                    "estimation.range",
                    "Le pourcentage d'estimation doit être entre 0 et 100"
                );
            }
        }
        // Si nature=EFFECTIF, estimPourcentage doit être null
        else if (req.nature() == NaturePoste.EFFECTIF) {
            if (req.estimPourcentage() != null) {
                errors.rejectValue(
                    "estimPourcentage",
                    "estimation.must_be_null",
                    "Le pourcentage d'estimation ne doit être renseigné que pour une nature ESTIMATION"
                );
            }
        }
    }
}

