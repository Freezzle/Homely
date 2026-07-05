package ch.homely.actif.dto;

import ch.homely.actif.TypeActif;

import java.math.BigDecimal;
import java.util.UUID;

public record ActifDto(UUID id, String libelle, TypeActif typeActif,
                       BigDecimal soldeInitial, String devise,
                       BigDecimal tauxCroissanceAnnuel, int ordre, boolean actif) {}
