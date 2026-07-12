package ch.homely.moteur;

import java.time.LocalDate;
import java.util.List;

/**
 * Fenêtre temporelle de répartition par défaut d'un scénario.
 *
 * <p>Les périodes d'un scénario forment une couverture continue sans chevauchement.
 * Une seule période peut avoir {@code fin = null} (période ouverte, la plus récente).</p>
 *
 * @param debut        premier jour de la période (inclus) ; ne doit pas être null en pratique
 * @param fin          dernier jour de la période (inclus) ; null = période ouverte
 * @param repartitions quotes-parts des membres pour cette période ; Σ = 1
 */
public record RepartitionPeriodeCalcul(
        LocalDate debut,
        LocalDate fin,
        List<RepartitionCalcul> repartitions
) {}

