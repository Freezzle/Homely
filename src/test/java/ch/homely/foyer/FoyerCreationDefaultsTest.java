package ch.homely.foyer;

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
import java.time.Year;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class FoyerCreationDefaultsTest {

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
    @DisplayName("Création foyer: membres initiaux + scénario de base par défaut")
    void creationFoyerInitialiseMembresEtScenarioParDefaut() throws Exception {
        String token = creerUtilisateurEtLogin("foyer_init@test.ch", "password123");

        Map<String, Object> payload = Map.of(
                "nom", "Foyer Initial",
                "deviseBase", "CHF",
                "membres", List.of(
                        Map.of("nom", "Alice", "couleur", "#FF0000"),
                        Map.of("nom", "Bob", "couleur", "#00FF00"),
                        Map.of("nom", "Charlie", "couleur", "#0000FF")
                )
        );

        String body = client.post().uri("/api/foyers")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(MAPPER.writeValueAsString(payload))
                .retrieve().body(String.class);

        JsonNode foyer = MAPPER.readTree(body);
        String foyerId = foyer.get("id").asText();

        String membresBody = client.get().uri("/api/foyers/" + foyerId + "/membres")
                .header("Authorization", "Bearer " + token)
                .retrieve().body(String.class);
        JsonNode membres = MAPPER.readTree(membresBody);

        assertThat(membres).hasSize(3);
        assertThat(membres.get(0).get("nom").asText()).isEqualTo("Alice");
        assertThat(membres.get(1).get("nom").asText()).isEqualTo("Bob");
        assertThat(membres.get(2).get("nom").asText()).isEqualTo("Charlie");
        assertThat(membres.get(0).get("ordre").asInt()).isEqualTo(1);
        assertThat(membres.get(1).get("ordre").asInt()).isEqualTo(2);
        assertThat(membres.get(2).get("ordre").asInt()).isEqualTo(3);

        String scenariosBody = client.get().uri("/api/foyers/" + foyerId + "/scenarios")
                .header("Authorization", "Bearer " + token)
                .retrieve().body(String.class);
        JsonNode scenarios = MAPPER.readTree(scenariosBody);

        assertThat(scenarios).hasSize(1);
        JsonNode scenario = scenarios.get(0);
        assertThat(scenario.get("nom").asText()).isEqualTo("Scénario de base");
        assertThat(scenario.get("estReference").asBoolean()).isTrue();
        assertThat(scenario.get("anneeDepart").asInt()).isEqualTo(Year.now().getValue());
        assertThat(scenario.get("tresorerieInitiale").decimalValue()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(scenario.get("horizonAnnees").asInt()).isEqualTo(25);

        JsonNode repartitions = scenario.get("repartitions");
        assertThat(repartitions).hasSize(3);

        BigDecimal somme = BigDecimal.ZERO;
        for (JsonNode r : repartitions) {
            BigDecimal part = r.get("quotePart").decimalValue();
            assertThat(part.scale()).isLessThanOrEqualTo(2);
            somme = somme.add(part);
        }
        assertThat(somme).isEqualByComparingTo(new BigDecimal("1.00"));
    }

    private String creerUtilisateurEtLogin(String email, String password) {
        try {
            client.post().uri("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(new RegisterRequest(email, password, "Test User")))
                    .retrieve().toBodilessEntity();
        } catch (Exception ignored) {
            // Utilisateur potentiellement déjà créé si relance locale.
        }
        return login(email, password);
    }

    private String login(String email, String password) {
        try {
            String body = client.post().uri("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(new LoginRequest(email, password))).retrieve().body(String.class);
            return MAPPER.readTree(body).get("accessToken").asText();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}

