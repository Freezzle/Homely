package ch.homely.poche;

import ch.homely.poche.dto.AllocationArgentPocheDto;
import ch.homely.poche.dto.PolitiqueArgentPocheDto;
import org.springframework.stereotype.Component;

import java.time.YearMonth;

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
                p.getCompte().getId(),
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
                a.getCompte().getId(),
                YearMonth.from(a.getMois()),
                a.getMontant(),
                a.getRaison()
        );
    }
}
