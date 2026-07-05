package ch.homely.objectif.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ObjectifDto(
        UUID id,
        String libelle,
        UUID categorieProjetId,
        BigDecimal montantCible,
        LocalDate echeance,
        UUID compteId,
        UUID actifId,
        /** Solde actuel du compte ou actif (projeté à la date courante). */
        BigDecimal soldeActuel,
        /** Progression en pourcentage [0..1]. */
        BigDecimal progression,
        /** Épargne mensuelle requise pour atteindre l'objectif à l'échéance. */
        BigDecimal epargneRequise
) {}
