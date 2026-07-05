package ch.homely.categorie.dto;

import ch.homely.categorie.TypeCategorie;

import java.util.UUID;

public record CategorieDto(UUID id, String libelle, TypeCategorie typePoste,
                            boolean systeme, int ordre, boolean actif) {}
