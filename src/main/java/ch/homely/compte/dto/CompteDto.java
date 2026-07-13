package ch.homely.compte.dto;

import java.math.BigDecimal;
import java.util.Set;
import java.util.UUID;

public record CompteDto(
        UUID id,
        String libelle,
        BigDecimal soldeInitial,
        String devise,
        int ordre,
        boolean actif,
        Set<UUID> membreIds
) {}
