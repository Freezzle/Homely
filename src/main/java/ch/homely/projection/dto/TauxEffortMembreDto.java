package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Indicateur 04 — Taux d'effort du membre : part des revenus d'un membre absorbée
 * par les charges + réserves du foyer pour un mois donné, avec un scénario "pire cas"
 * qui applique aux postes CHARGE/RESERVE de nature ESTIMATION leur variation maximale
 * ({@code estimPourcentage}). Le taux d'effort et la zone (Confortable/Correct/Tendu/
 * Saturé) sont calculés côté frontend à partir de ces champs bruts.
 */
public record TauxEffortMembreDto(
        UUID membreId,
        String nomMembre,
        String couleurMembre,
        BigDecimal revenusTotal,
        BigDecimal chargesTotal,
        BigDecimal reservesTotal,
        BigDecimal chargesTotalPireCas,
        BigDecimal reservesTotalPireCas
) {}
