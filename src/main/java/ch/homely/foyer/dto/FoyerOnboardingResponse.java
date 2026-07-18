package ch.homely.foyer.dto;

import java.util.UUID;

/** Réponse du wizard d'onboarding : foyer créé + identifiant du scénario de référence. */
public record FoyerOnboardingResponse(
        FoyerDto foyer,
        UUID scenarioId
) {}

