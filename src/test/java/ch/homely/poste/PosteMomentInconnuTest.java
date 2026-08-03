package ch.homely.poste;

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
 * moment=INCONNU (date de paiement effective non connue, ex. "dentiste 1x/an") impose
 * mode=MENSUALISE : seule stratégie possible, aucun mois d'ancrage où faire tomber le
 * montant plein. Vérifie le rejet de la combinaison invalide et le succès du cas nominal.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class PosteMomentInconnuTest {

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
    @DisplayName("moment=INCONNU + mode=PERIODIQUE est rejeté (POSTE_MOMENT_INCONNU_MODE_INVALIDE)")
    void momentInconnu_modePeriodique_rejete() throws Exception {
        String token = creerEtLogin("moment_inconnu_ko@test.ch");
        String foyerId = creerFoyer(token, "Foyer Moment Inconnu KO");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Santé", "CHARGE");

        assertThatThrownBy(() -> creerPoste(token, foyerId, scenarioId, catId, "PERIODIQUE", "INCONNU"))
                .cause()
                .isInstanceOfSatisfying(HttpClientErrorException.class, ex -> {
                    assertThat(ex.getStatusCode().value()).isEqualTo(422);
                    assertThat(ex.getResponseBodyAsString()).contains("POSTE_MOMENT_INCONNU_MODE_INVALIDE");
                });
    }

    @Test
    @DisplayName("moment=INCONNU + mode=MENSUALISE est accepté")
    void momentInconnu_modeMensualise_accepte() throws Exception {
        String token = creerEtLogin("moment_inconnu_ok@test.ch");
        String foyerId = creerFoyer(token, "Foyer Moment Inconnu OK");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Santé", "CHARGE");

        String posteId = creerPoste(token, foyerId, scenarioId, catId, "MENSUALISE", "INCONNU");

        assertThat(posteId).isNotBlank();
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

    private String creerPoste(String token, String foyerId, String scenarioId, String catId,
                               String mode, String moment) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "CHARGE");
        payload.put("description", "Dentiste");
        payload.put("categorieId", catId);
        payload.put("montant", 1200);
        payload.put("periodiciteMois", 12);
        payload.put("debut", "2025-01-01");
        payload.put("fin", null);
        payload.put("mode", mode);
        payload.put("moment", moment);
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
}
