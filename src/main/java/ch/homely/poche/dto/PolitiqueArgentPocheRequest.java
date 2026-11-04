package ch.homely.poche.dto;

import ch.homely.poche.ModePolitiqueArgentPoche;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

/**
 * Requête de création ou de modification d'une politique.
 *
 * <p>La validation croisée mode/champs est faite en service métier — Bean
 * Validation ne peut vérifier que les contraintes individuelles.</p>
 */
public record PolitiqueArgentPocheRequest(
        @NotNull UUID membreId,

        /**
         * Compte source finançant le versement. Null → résolu par le serveur
         * (compte primaire du membre, sinon 1re contrepartie, sinon 1er compte actif).
         */
        UUID comptePivotId,

        /** Comptes de poche crédités ; somme des quotes-parts = 1 (validée en service). */
        @NotEmpty @Valid List<LigneRoutagePocheDto> routage,

        @NotBlank @Size(max = 160) String nom,
        @NotNull YearMonth dateDebut,
        YearMonth dateFin,
        @NotNull ModePolitiqueArgentPoche mode,

        /** Mode VARIABLE — minimum garanti versé chaque mois. */
        @DecimalMin("0.0") BigDecimal socle,

        /** Mode VARIABLE — part (0-100) du RàV brut. */
        @DecimalMin("0.0") @DecimalMax("100.0") BigDecimal pourcentage,

        /** Mode VARIABLE — plafond absolu. */
        @DecimalMin("0.0") BigDecimal plafond,

        /** Mode FIXE — montant constant chaque mois. */
        @DecimalMin("0.0") BigDecimal montantFixe
) {}
