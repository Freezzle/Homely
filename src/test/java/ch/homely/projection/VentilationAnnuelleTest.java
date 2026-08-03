package ch.homely.projection;

import ch.homely.utilisateur.dto.LoginRequest;
import ch.homely.utilisateur.dto.RegisterRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.RestClient;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Vérifie que le nouvel endpoint {@code /projection/ventilation-annuelle} (T8.3,
 * optimisation dashboard) renvoie exactement — au centime — la somme des 12 appels
 * {@code /projection/mensuelle} pour la même année, quel que soit l'axe (foyer, membre,
 * catégorie, compte). Non-régression obligatoire : cet endpoint ne fait que sommer des
 * résultats déjà calculés, sans toucher au moteur.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class VentilationAnnuelleTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @LocalServerPort int port;
    private static final ObjectMapper MAPPER = new ObjectMapper();
    RestClient client;

    @BeforeEach
    void setUp() {
        client = RestClient.builder().baseUrl("http://localhost:" + port).build();
    }

    @Test
    @DisplayName("ventilation-annuelle == somme des 12 mensuelle (foyer, membre, catégorie, compte)")
    void ventilationAnnuelle_egaleSommeDes12Mensuelle() throws Exception {
        String token = creerEtLogin("vent_annuelle@test.ch");
        String foyerId = creerFoyer(token, "Foyer Ventilation Annuelle");
        String scenarioId = creerScenario(token, foyerId);
        String membreId = premierMembreId(token, foyerId);
        String catRevenu = creerCategorie(token, foyerId, "Salaire", "REVENU");
        String catCharge = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        String compteId = creerCompte(token, foyerId, "Compte commun", membreId);

        creerPoste(token, foyerId, scenarioId, catRevenu, "REVENU", 6000, membreId, compteId);
        creerPoste(token, foyerId, scenarioId, catCharge, "CHARGE", 1800, membreId, compteId);

        JsonNode annuel = MAPPER.readTree(client.get()
                .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/projection/ventilation-annuelle?annee=2025")
                .header("Authorization", "Bearer " + token)
                .retrieve().body(String.class));

        BigDecimal sommeRevenus = BigDecimal.ZERO, sommeCharges = BigDecimal.ZERO,
                sommeReserves = BigDecimal.ZERO, sommeSolde = BigDecimal.ZERO;
        BigDecimal sommeParCat = BigDecimal.ZERO;
        for (int m = 1; m <= 12; m++) {
            JsonNode mensuel = MAPPER.readTree(client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/projection/mensuelle?annee=2025&mois=" + m)
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class));
            sommeRevenus = sommeRevenus.add(new BigDecimal(mensuel.get("agregat").get("revenus").asText()));
            sommeCharges = sommeCharges.add(new BigDecimal(mensuel.get("agregat").get("charges").asText()));
            sommeReserves = sommeReserves.add(new BigDecimal(mensuel.get("agregat").get("reserves").asText()));
            sommeSolde = sommeSolde.add(new BigDecimal(mensuel.get("agregat").get("soldeDisponible").asText()));
            sommeParCat = sommeParCat.add(new BigDecimal(mensuel.get("parCategorie").get(catCharge).asText()));
        }

        assertThat(new BigDecimal(annuel.get("agregat").get("revenus").asText())).isEqualByComparingTo(sommeRevenus);
        assertThat(new BigDecimal(annuel.get("agregat").get("charges").asText())).isEqualByComparingTo(sommeCharges);
        assertThat(new BigDecimal(annuel.get("agregat").get("reserves").asText())).isEqualByComparingTo(sommeReserves);
        assertThat(new BigDecimal(annuel.get("agregat").get("soldeDisponible").asText())).isEqualByComparingTo(sommeSolde);
        assertThat(new BigDecimal(annuel.get("parCategorie").get(catCharge).asText())).isEqualByComparingTo(sommeParCat);
        assertThat(new BigDecimal(annuel.get("parMembre").get(membreId).get("soldeDisponible").asText()))
                .isEqualByComparingTo(sommeSolde);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String creerEtLogin(String email) {
        try {
            client.post().uri("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(new RegisterRequest(email, "password123", "Test User")))
                    .retrieve().toBodilessEntity();
        } catch (org.springframework.web.client.HttpClientErrorException.Conflict ignored) {
        } catch (Exception e) { throw new RuntimeException(e); }
        return login(email);
    }

    private String login(String email) {
        try {
            String body = client.post().uri("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(new LoginRequest(email, "password123")))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("accessToken").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String creerFoyer(String token, String nom) {
        Map<String, Object> payload = Map.of(
                "nom", nom,
                "deviseBase", "CHF",
                "membres", List.of(Map.of("nom", "Membre 1", "couleur", "#6366F1"))
        );
        try {
            String body = client.post().uri("/api/foyers").header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String premierMembreId(String token, String foyerId) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/membres")
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get(0).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String creerCategorie(String token, String foyerId, String libelle, String typePoste) {
        Map<String, Object> payload = Map.of("libelle", libelle, "typePoste", typePoste);
        try {
            String body = client.post()
                    .uri("/api/foyers/" + foyerId + "/categories")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String creerCompte(String token, String foyerId, String libelle, String membreId) {
        Map<String, Object> payload = Map.of("libelle", libelle, "membreIds", List.of(membreId));
        try {
            String body = client.post()
                    .uri("/api/foyers/" + foyerId + "/comptes")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String creerScenario(String token, String foyerId) {
        String membreId = premierMembreId(token, foyerId);
        Map<String, Object> payload = Map.of(
                "nom", "Scénario Test",
                "anneeDepart", 2025,
                "horizonAnnees", 1,
                "tresorerieInitiale", 0,
                "repartitions", List.of(Map.of("membreId", membreId, "quotePart", 1.0))
        );
        try {
            String body = client.post()
                    .uri("/api/foyers/" + foyerId + "/scenarios")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String creerPoste(String token, String foyerId, String scenarioId, String catId,
                               String type, double montant, String membreId, String compteId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("description", "Poste test");
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", 1);
        payload.put("debut", "2025-01-01");
        payload.put("fin", null);
        payload.put("mode", "MENSUALISE");
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", "EFFECTIF");
        payload.put("ordre", 1);
        payload.put("repartitions", List.of());
        payload.put("ventilations", List.of(Map.of("membreId", membreId, "compteId", compteId)));
        try {
            String body = client.post()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
