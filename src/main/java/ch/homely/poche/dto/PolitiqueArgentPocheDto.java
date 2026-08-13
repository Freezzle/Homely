package ch.homely.poche.dto;

import ch.homely.poche.ModePolitiqueArgentPoche;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.UUID;

/**
 * Vue "lecture" d'une politique d'argent de poche.
 *
 * <p>Champs {@code socle}/{@code pourcentage}/{@code plafond} peuvent être
 * {@code null} en mode {@link ModePolitiqueArgentPoche#FIXE} et vice versa pour
 * {@code montantFixe} — le front-end s'appuie sur {@code mode} pour savoir
 * lesquels lire.</p>
 */
public record PolitiqueArgentPocheDto(
        UUID id,
        UUID scenarioId,
        UUID membreId,
        UUID compteId,
        String nom,
        YearMonth dateDebut,
        YearMonth dateFin,
        ModePolitiqueArgentPoche mode,
        BigDecimal socle,
        BigDecimal pourcentage,
        BigDecimal plafond,
        BigDecimal montantFixe
) {}
