package ch.homely.compte.dto;

import ch.homely.compte.TypeCompte;

import java.math.BigDecimal;
import java.util.UUID;

public record CompteDto(UUID id, String libelle, TypeCompte type,
                        BigDecimal soldeInitial, String devise, int ordre, boolean actif) {}
