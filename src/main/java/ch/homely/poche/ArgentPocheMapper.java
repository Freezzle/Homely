package ch.homely.poche;

import ch.homely.poche.dto.AllocationArgentPocheDto;
import ch.homely.poche.dto.LigneRoutagePocheDto;
import ch.homely.poche.dto.PolitiqueArgentPocheDto;
import org.springframework.stereotype.Component;

import java.time.YearMonth;
import java.util.List;

/**
 * Mappeur entité ⇄ DTO — pattern manuel du repo (pas de MapStruct configuré).
 * Séparé du service pour rester testable et pour ne pas confondre les
 * responsabilités "règles métier" et "conversion transport".
 */
@Component
public class ArgentPocheMapper {

    public PolitiqueArgentPocheDto toDto(PolitiqueArgentPoche p) {
        return new PolitiqueArgentPocheDto(
                p.getId(),
                p.getScenario().getId(),
                p.getMembre().getId(),
                p.getComptePivot() != null ? p.getComptePivot().getId() : null,
                routageToDto(p.getRoutage()),
                p.getNom(),
                YearMonth.from(p.getDateDebut()),
                p.getDateFin() != null ? YearMonth.from(p.getDateFin()) : null,
                p.getMode(),
                p.getSocle(),
                p.getPourcentage(),
                p.getPlafond(),
                p.getMontantFixe()
        );
    }

    public AllocationArgentPocheDto toDto(AllocationArgentPoche a) {
        return new AllocationArgentPocheDto(
                a.getId(),
                a.getScenario().getId(),
                a.getMembre().getId(),
                a.getComptePivot() != null ? a.getComptePivot().getId() : null,
                routageToDto(a.getRoutage()),
                YearMonth.from(a.getMois()),
                a.getMontant(),
                a.getRaison()
        );
    }

    private static List<LigneRoutagePocheDto> routageToDto(List<? extends RoutageArgentPoche> routage) {
        return routage.stream()
                .map(r -> new LigneRoutagePocheDto(r.getCompte().getId(), r.getQuotePart()))
                .toList();
    }
}
