package ch.homely.projection;

import ch.homely.utilisateur.dto.LoginRequest;
import ch.homely.utilisateur.dto.RegisterRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.client.HttpClientErrorException;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Indicateur 04 — Tests d'intégration pour l'endpoint {@code /projection/taux-effort}
 * (revenus/charges/réserves par membre, avec scénario "pire cas" pour les postes
 * CHARGE/RESERVE de nature ESTIMATION).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class TauxEffortIT {

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
    @DisplayName("Cas nominal : revenus/charges/réserves du membre, pire cas égal au courant sans poste ESTIMATION")
    void casNominal_sansEstimation_pireCasEgalCourant() throws Exception {
        String token = creerEtLogin("effort_nominal@test.ch");
        String foyerId = creerFoyer(token, "Foyer Effort Nominal");
        String scenarioId = creerScenario(token, foyerId);
        String membreId = premierMembreId(token, foyerId);
        String catRevenu = creerCategorie(token, foyerId, "Salaire", "REVENU");
        String catCharge = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        String catReserve = creerCategorie(token, foyerId, "Épargne", "RESERVE");

        creerPoste(token, foyerId, scenarioId, catRevenu, "REVENU", 6300, "EFFECTIF", null);
        creerPoste(token, foyerId, scenarioId, catCharge, "CHARGE", 3850, "EFFECTIF", null);
        creerPoste(token, foyerId, scenarioId, catReserve, "RESERVE", 1380, "EFFECTIF", null);

        List<JsonNode> effort = tauxEffort(token, foyerId, scenarioId, 2025, 1);
        assertThat(effort).hasSize(1);
        JsonNode m = effort.get(0);
        assertThat(m.get("membreId").asText()).isEqualTo(membreId);
        assertThat(new BigDecimal(m.get("revenusTotal").asText())).isEqualByComparingTo("6300.00");
        assertThat(new BigDecimal(m.get("chargesTotal").asText())).isEqualByComparingTo("3850.00");
        assertThat(new BigDecimal(m.get("reservesTotal").asText())).isEqualByComparingTo("1380.00");
        // Pas de poste ESTIMATION -> pire cas == courant.
        assertThat(new BigDecimal(m.get("chargesTotalPireCas").asText())).isEqualByComparingTo("3850.00");
        assertThat(new BigDecimal(m.get("reservesTotalPireCas").asText())).isEqualByComparingTo("1380.00");
    }

    @Test
    @DisplayName("Poste CHARGE ESTIMATION : le pire cas majore le montant de estimPourcentage")
    void posteEstimation_majorePireCas() throws Exception {
        String token = creerEtLogin("effort_estim@test.ch");
        String foyerId = creerFoyer(token, "Foyer Effort Estimation");
        String scenarioId = creerScenario(token, foyerId);
        String catRevenu = creerCategorie(token, foyerId, "Salaire", "REVENU");
        String catCharge = creerCategorie(token, foyerId, "Alimentation", "CHARGE");

        creerPoste(token, foyerId, scenarioId, catRevenu, "REVENU", 6300, "EFFECTIF", null);
        // Charge ESTIMATION à 400, ±10% -> pire cas = 440.
        creerPoste(token, foyerId, scenarioId, catCharge, "CHARGE", 400, "ESTIMATION", new BigDecimal("10.0"));

        List<JsonNode> effort = tauxEffort(token, foyerId, scenarioId, 2025, 1);
        JsonNode m = effort.get(0);
        assertThat(new BigDecimal(m.get("chargesTotal").asText())).isEqualByComparingTo("400.00");
        assertThat(new BigDecimal(m.get("chargesTotalPireCas").asText())).isEqualByComparingTo("440.00");
    }

    @Test
    @DisplayName("Membre sans revenu (à charge) : revenusTotal = 0, charges partagées quand même comptées")
    void membreSansRevenu_revenusTotalZero() throws Exception {
        String token = creerEtLogin("effort_sansrevenu@test.ch");
        String foyerId = creerFoyer2Membres(token, "Foyer Effort Sans Revenu");
        String scenarioId = creerScenario2Membres(token, foyerId);
        List<String> membreIds = tousMembresIds(token, foyerId);
        String membre1 = membreIds.get(0);
        String membre2 = membreIds.get(1);

        String catRevenu = creerCategorie(token, foyerId, "Salaire", "REVENU");
        String catCharge = creerCategorie(token, foyerId, "Loyer", "CHARGE");

        // Revenu 100% attribué au membre 1 (CUSTOM), charge partagée 50/50 (AUTO, quote-part scénario).
        creerPosteCustom(token, foyerId, scenarioId, catRevenu, "REVENU", 6000, membre1, "1.0", membre2, "0.0");
        creerPoste(token, foyerId, scenarioId, catCharge, "CHARGE", 2000, "EFFECTIF", null);

        List<JsonNode> effort = tauxEffort(token, foyerId, scenarioId, 2025, 1);
        JsonNode dtoMembre2 = effort.stream().filter(e -> e.get("membreId").asText().equals(membre2))
                .findFirst().orElseThrow();
        assertThat(new BigDecimal(dtoMembre2.get("revenusTotal").asText())).isEqualByComparingTo("0.00");
        assertThat(new BigDecimal(dtoMembre2.get("chargesTotal").asText())).isEqualByComparingTo("1000.00");
    }

    @Test
    @DisplayName("Accès inter-foyers refusé (403)")
    void accesInterFoyersRefuse() {
        String tokenA = creerEtLogin("effort_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Effort");
        String scenarioId = creerScenario(tokenA, foyerAId);

        String tokenB = creerEtLogin("effort_b@test.ch");
        creerFoyer(tokenB, "Foyer B Effort");

        assertThatThrownBy(() -> client.get()
                .uri("/api/foyers/" + foyerAId + "/scenarios/" + scenarioId + "/projection/taux-effort?annee=2025&mois=1")
                .header("Authorization", "Bearer " + tokenB)
                .retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private String creerEtLogin(String email) {
        try {
            client.post().uri("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(new RegisterRequest(email, "password123", "Test User")))
                    .retrieve().toBodilessEntity();
        } catch (HttpClientErrorException.Conflict ignored) {
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

    private String creerFoyer2Membres(String token, String nom) {
        Map<String, Object> payload = Map.of(
                "nom", nom,
                "deviseBase", "CHF",
                "membres", List.of(
                        Map.of("nom", "Membre 1", "couleur", "#6366F1"),
                        Map.of("nom", "Membre 2", "couleur", "#F59E0B"))
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
        return tousMembresIds(token, foyerId).get(0);
    }

    private List<String> tousMembresIds(String token, String foyerId) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/membres")
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            JsonNode arr = MAPPER.readTree(body);
            List<String> ids = new java.util.ArrayList<>();
            arr.forEach(n -> ids.add(n.get("id").asText()));
            return ids;
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

    private String creerScenario2Membres(String token, String foyerId) {
        List<String> membreIds = tousMembresIds(token, foyerId);
        Map<String, Object> payload = Map.of(
                "nom", "Scénario Test 2 Membres",
                "anneeDepart", 2025,
                "horizonAnnees", 1,
                "tresorerieInitiale", 0,
                "repartitions", List.of(
                        Map.of("membreId", membreIds.get(0), "quotePart", 0.5),
                        Map.of("membreId", membreIds.get(1), "quotePart", 0.5))
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
                               String type, double montant, String nature, BigDecimal estimPourcentage) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("description", "Poste test effort");
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", 1);
        payload.put("debut", "2025-01-01");
        payload.put("fin", null);
        payload.put("mode", "MENSUALISE");
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", nature);
        if (estimPourcentage != null) payload.put("estimPourcentage", estimPourcentage);
        payload.put("ordre", 1);
        payload.put("repartitions", List.of());
        payload.put("ventilations", List.of());
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

    private String creerPosteCustom(String token, String foyerId, String scenarioId, String catId, String type,
                                     double montant, String membre1, String quotePart1,
                                     String membre2, String quotePart2) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("description", "Poste test effort custom");
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", 1);
        payload.put("debut", "2025-01-01");
        payload.put("fin", null);
        payload.put("mode", "MENSUALISE");
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", "EFFECTIF");
        payload.put("typeRepartition", "CUSTOM");
        payload.put("ordre", 1);
        payload.put("repartitions", List.of(
                Map.of("membreId", membre1, "quotePart", quotePart1),
                Map.of("membreId", membre2, "quotePart", quotePart2)));
        payload.put("ventilations", List.of());
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

    private List<JsonNode> tauxEffort(String token, String foyerId, String scenarioId, int annee, int mois) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId
                            + "/projection/taux-effort?annee=" + annee + "&mois=" + mois)
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            JsonNode arr = MAPPER.readTree(body);
            List<JsonNode> result = new java.util.ArrayList<>();
            arr.forEach(result::add);
            return result;
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
