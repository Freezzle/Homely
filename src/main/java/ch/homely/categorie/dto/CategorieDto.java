package ch.homely.categorie.dto;

import ch.homely.categorie.TypeCategorie;

import java.util.UUID;

public record CategorieDto(UUID id, String libelle, TypeCategorie typePoste,
                            int ordre, boolean actif) {}
