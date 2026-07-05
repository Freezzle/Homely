package ch.homely.commun;

/** Détail d'une erreur sur un champ (validation Bean Validation). */
public record ChampErreur(String champ, String message) {}
