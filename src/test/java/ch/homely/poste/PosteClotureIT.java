package ch.homely.poste;

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

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests d'intégration pour les actions rapides de clôture/réactivation d'un poste
 * (POST .../postes/{id}/cloturer et POST .../postes/{id}/reactiver).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class PosteClotureIT {

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

    // ── Tests ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Clôture nominale : la fin est positionnée")
    void cloturer_nominal() throws Exception {
        String token = creerEtLogin("cloture_ok@test.ch");
        String foyerId = creerFoyer(token, "Foyer Clôture OK");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Loyer", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-01-01", null, 1800);

        JsonNode resultat = cloturer(token, foyerId, scenarioId, posteId, "2026-07-31");

        assertThat(resultat.get("id").asText()).isEqualTo(posteId);
        assertThat(resultat.get("fin").asText()).isEqualTo("2026-07-31");
    }

    @Test
    @DisplayName("Réactivation nominale : la fin est retirée")
    void reactiver_nominal() throws Exception {
        String token = creerEtLogin("reactiver_ok@test.ch");
        String foyerId = creerFoyer(token, "Foyer Réactiver OK");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Loyer2", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-01-01", "2020-01-31", 1800);

        JsonNode resultat = reactiver(token, foyerId, scenarioId, posteId);

        assertThat(resultat.get("id").asText()).isEqualTo(posteId);
        assertThat(resultat.hasNonNull("fin")).isFalse();
    }

    @Test
    @DisplayName("Rejet clôture : le poste ciblé n'est pas le dernier maillon (a un successeur)")
    void cloturer_rejette_maillonIntermediaire() throws Exception {
        String token = creerEtLogin("cloture_interm@test.ch");
        String foyerId = creerFoyer(token, "Foyer Clôture Intermédiaire");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Chaîne", "CHARGE", 1);
        String origineId = creerPoste(token, foyerId, scenarioId, catId, "2024-01-01", null, 1000);

        reviser(token, foyerId, scenarioId, origineId, 1100, "2026-01-01");

        assertThatThrownBy(() -> cloturer(token, foyerId, scenarioId, origineId, "2030-01-31"))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Rejet réactivation : le poste ciblé n'est pas le dernier maillon (a un successeur)")
    void reactiver_rejette_maillonIntermediaire() throws Exception {
        String token = creerEtLogin("reactiver_interm@test.ch");
        String foyerId = creerFoyer(token, "Foyer Réactiver Intermédiaire");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Chaîne2", "CHARGE", 1);
        String origineId = creerPoste(token, foyerId, scenarioId, catId, "2024-01-01", null, 1000);

        reviser(token, foyerId, scenarioId, origineId, 1100, "2026-01-01");

        assertThatThrownBy(() -> reactiver(token, foyerId, scenarioId, origineId))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Rejet clôture : la fin ne peut pas être antérieure au début")
    void cloturer_rejette_finAvantDebut() throws Exception {
        String token = creerEtLogin("cloture_avant@test.ch");
        String foyerId = creerFoyer(token, "Foyer Clôture Avant");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Test", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-06-01", null, 100);

        assertThatThrownBy(() -> cloturer(token, foyerId, scenarioId, posteId, "2025-01-31"))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Clôture inter-foyers renvoie 403")
    void cloturer_interFoyers_renvoie403() throws Exception {
        String tokenA = creerEtLogin("cloture_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Clôture");
        String scenarioId = creerScenario(tokenA, foyerAId);
        String catId = creerCategorie(tokenA, foyerAId, "Cat A", "CHARGE", 1);
        String posteId = creerPoste(tokenA, foyerAId, scenarioId, catId, "2025-01-01", null, 100);

        String tokenB = creerEtLogin("cloture_b@test.ch");
        creerFoyer(tokenB, "Foyer B Clôture");

        assertThatThrownBy(() -> cloturer(tokenB, foyerAId, scenarioId, posteId, "2026-01-31"))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("Réactivation inter-foyers renvoie 403")
    void reactiver_interFoyers_renvoie403() throws Exception {
        String tokenA = creerEtLogin("reactiver_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Réactiver");
        String scenarioId = creerScenario(tokenA, foyerAId);
        String catId = creerCategorie(tokenA, foyerAId, "Cat A", "CHARGE", 1);
        String posteId = creerPoste(tokenA, foyerAId, scenarioId, catId, "2025-01-01", "2020-01-31", 100);

        String tokenB = creerEtLogin("reactiver_b@test.ch");
        creerFoyer(tokenB, "Foyer B Réactiver");

        assertThatThrownBy(() -> reactiver(tokenB, foyerAId, scenarioId, posteId))
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

    private String premierMembreId(String token, String foyerId) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/membres")
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get(0).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String creerCategorie(String token, String foyerId, String libelle, String typePoste, int ordre) {
        Map<String, Object> payload = Map.of("libelle", libelle, "typePoste", typePoste, "ordre", ordre);
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

    private String creerPoste(String token, String foyerId, String scenarioId, String catId,
                               String debut, String fin, double montant) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "CHARGE");
        payload.put("description", "Poste test clôture");
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", 1);
        payload.put("debut", debut);
        payload.put("fin", fin);
        payload.put("mode", "MENSUALISE");
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", "EFFECTIF");
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

    private JsonNode reviser(String token, String foyerId, String scenarioId, String posteId,
                              double nouveauMontant, String dateEffet) {
        Map<String, Object> payload = Map.of("nouveauMontant", nouveauMontant, "dateEffet", dateEffet);
        String jsonPayload;
        try {
            jsonPayload = MAPPER.writeValueAsString(payload);
        } catch (Exception e) { throw new RuntimeException(e); }

        String body = client.post()
                .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes/" + posteId + "/reviser-montant")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(jsonPayload)
                .retrieve().body(String.class);
        try {
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private JsonNode cloturer(String token, String foyerId, String scenarioId, String posteId, String fin) {
        Map<String, Object> payload = Map.of("fin", fin);
        String jsonPayload;
        try {
            jsonPayload = MAPPER.writeValueAsString(payload);
        } catch (Exception e) { throw new RuntimeException(e); }

        String body = client.post()
                .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes/" + posteId + "/cloturer")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(jsonPayload)
                .retrieve().body(String.class);
        try {
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private JsonNode reactiver(String token, String foyerId, String scenarioId, String posteId) {
        String body = client.post()
                .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes/" + posteId + "/reactiver")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .retrieve().body(String.class);
        try {
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
