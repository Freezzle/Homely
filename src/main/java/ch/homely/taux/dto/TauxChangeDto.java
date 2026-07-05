package ch.homely.taux.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record TauxChangeDto(UUID id, String devise, BigDecimal tauxVersBase) {}
