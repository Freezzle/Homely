package ch.homely.dashboard;

import ch.homely.dashboard.dto.SeuilsDashboardDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Expose la configuration d'affichage du dashboard (seuils d'interprétation des
 * indicateurs). Global au produit — non scopé foyer — mais requiert un JWT valide.
 */
@RestController
@RequestMapping("/api/dashboard")
public class DashboardConfigController {

    /** Seuils d'interprétation des indicateurs du dashboard (constantes d'affichage). */
    @GetMapping("/seuils")
    public SeuilsDashboardDto seuils() {
        return SeuilsDashboardDto.valeursParDefaut();
    }
}
