package ch.homely.membre.dto;

import java.util.UUID;

/** Body de {@code PUT .../membres/{membreId}/compte-primaire}. `compteId` à
 *  `null` retire le compte primaire (retour au mode "legacy"). */
public record ComptePrimaireRequest(UUID compteId) {}
