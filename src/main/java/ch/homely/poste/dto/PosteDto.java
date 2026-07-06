package ch.homely.poste.dto;

import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.MomentPeriode;
import ch.homely.poste.NaturePoste;
import ch.homely.poste.TypePoste;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record PosteDto(
        UUID id,
        TypePoste type,
        String description,
        UUID categorieId,
        BigDecimal montant,
        BigDecimal montantMensualise,
        String devise,
        int periodiciteMois,
        LocalDate debut,
        LocalDate fin,
        ModeComptabilisation mode,
        MomentPeriode moment,
        NaturePoste nature,
        UUID compteSource,
        int ordre,
        List<RepartitionPosteDto> repartitions,
        List<VentilationCompteDto> ventilations
) {
    public record RepartitionPosteDto(UUID membreId, String nomMembre, BigDecimal quotePart) {}
    public record VentilationCompteDto(UUID membreId, UUID compteId, String libelleCompte) {}
}
