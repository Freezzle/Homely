package ch.homely.membre.dto;

import java.util.UUID;

public record MembreDto(UUID id, String nom, String couleur, int ordre, boolean actif) {}
