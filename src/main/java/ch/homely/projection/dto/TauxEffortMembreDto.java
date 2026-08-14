package ch.homely.projection.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Indicateur 04 — Taux d'effort du membre : part des revenus d'un membre absorbée
 * par les charges + réserves du foyer pour un mois donné, avec un scénario "pire cas"
 * qui applique aux postes CHARGE/RESERVE de nature ESTIMATION leur variation maximale
 * ({@code estimPourcentage}). Le taux d'effort et la zone (Confortable/Correct/Tendu/
 * Saturé) sont calculés côté frontend à partir de ces champs bruts.
 *
 * <p>{@code argentPocheTotal}/{@code argentPocheTotalPireCas} : montant d'argent de
 * poche résolu pour ce membre (non un poste, absent de {@code chargesTotal}/
 * {@code reservesTotal}) — alimente le 3ᵉ jauge "charges + réserves + argent de poche"
 * côté frontend, une vision plus complète de l'effort réel du membre.</p>
 */
public record TauxEffortMembreDto(
        UUID membreId,
        String nomMembre,
        String couleurMembre,
        BigDecimal revenusTotal,
        BigDecimal chargesTotal,
        BigDecimal reservesTotal,
        BigDecimal chargesTotalPireCas,
        BigDecimal reservesTotalPireCas,
        BigDecimal argentPocheTotal,
        BigDecimal argentPocheTotalPireCas
) {}
