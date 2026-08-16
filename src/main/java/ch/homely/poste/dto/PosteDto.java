package ch.homely.poste.dto;

import ch.homely.poste.ModeComptabilisation;
import ch.homely.poste.MomentPeriode;
import ch.homely.poste.NaturePoste;
import ch.homely.poste.TypePoste;
import ch.homely.poste.TypeRepartition;

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
        BigDecimal estimPourcentage,  // Pourcentage d'estimation (nullable si nature=EFFECTIF)
        TypeRepartition typeRepartition,
        int ordre,
        int importance,  // 1 (non vital) à 5 (vital) — descriptif, sans impact sur les calculs
        int potentielOptimisation,  // 1 (non optimisable) à 5 (très optimisable) — descriptif
        List<RepartitionPosteDto> repartitions,
        List<VentilationCompteDto> ventilations,
        UUID posteOrigineId,  // Poste dont ce poste est issu par révision de montant (null si aucun)
        UUID posteSuivantId,  // Poste qui a remplacé celui-ci par révision de montant (null si actif, calculé)
        boolean inclureProrataTheorique  // pris en compte dans le prorata théorique des membres (défaut true) ; pertinent seulement si type=REVENU et foyer multi-membres
) {
    public record RepartitionPosteDto(UUID membreId, String nomMembre, BigDecimal quotePart) {}
    public record VentilationCompteDto(UUID membreId, UUID compteId, String libelleCompte) {}
}
