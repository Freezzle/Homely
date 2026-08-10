package ch.homely.foyer;

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

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests d'intégration pour la désignation du compte primaire directement lors du
 * wizard d'onboarding ({@code POST /api/foyers/onboarding}).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class FoyerOnboardingPrimaireIT {

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
    @DisplayName("Onboarding : membresPrimaireOrdres positionne le compte primaire de chaque membre désigné")
    void onboardingAvecComptesPrimaires() throws Exception {
        String token = creerUtilisateurEtLogin("onboarding_primaire@test.ch");

        Map<String, Object> payload = Map.of(
                "nom", "Foyer Onboarding Primaire",
                "deviseBase", "CHF",
                "membres", List.of(
                        Map.of("nom", "Alice", "couleur", "#FF0000"),
                        Map.of("nom", "Bob", "couleur", "#00FF00")
                ),
                "comptes", List.of(
                        Map.of("libelle", "Compte Alice", "soldeInitial", 0,
                                "membreOrdres", List.of(1), "membresPrimaireOrdres", List.of(1)),
                        Map.of("libelle", "Compte Bob", "soldeInitial", 0,
                                "membreOrdres", List.of(2), "membresPrimaireOrdres", List.of(2)),
                        Map.of("libelle", "Compte commun", "soldeInitial", 0,
                                "membreOrdres", List.of(1, 2))
                ),
                "categories", List.of(),
                "scenario", Map.of(
                        "nom", "Scénario Test", "anneeDepart", 2025, "tresorerieInitiale", 0,
                        "repartitions", List.of(
                                Map.of("membreOrdre", 1, "quotePart", 0.5),
                                Map.of("membreOrdre", 2, "quotePart", 0.5)
                        )
                )
        );

        String body = client.post().uri("/api/foyers/onboarding")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(MAPPER.writeValueAsString(payload))
                .retrieve().body(String.class);

        String foyerId = MAPPER.readTree(body).get("foyer").get("id").asText();

        String membresBody = client.get().uri("/api/foyers/" + foyerId + "/membres")
                .header("Authorization", "Bearer " + token).retrieve().body(String.class);
        JsonNode membres = MAPPER.readTree(membresBody);
        JsonNode alice = membres.get(0);
        JsonNode bob = membres.get(1);

        String comptesBody = client.get().uri("/api/foyers/" + foyerId + "/comptes")
                .header("Authorization", "Bearer " + token).retrieve().body(String.class);
        JsonNode comptes = MAPPER.readTree(comptesBody);
        String compteAliceId = trouverParLibelle(comptes, "Compte Alice").get("id").asText();
        String compteBobId = trouverParLibelle(comptes, "Compte Bob").get("id").asText();

        assertThat(alice.get("compteIdPrimaire").asText()).isEqualTo(compteAliceId);
        assertThat(bob.get("compteIdPrimaire").asText()).isEqualTo(compteBobId);
    }

    @Test
    @DisplayName("Onboarding : deux comptes désignant le même membre comme primaire sont refusés")
    void onboardingPrimaireDoubleRefuse() {
        String token = creerUtilisateurEtLogin("onboarding_primaire_double@test.ch");

        Map<String, Object> payload = Map.of(
                "nom", "Foyer Onboarding Primaire Double",
                "deviseBase", "CHF",
                "membres", List.of(Map.of("nom", "Alice", "couleur", "#FF0000")),
                "comptes", List.of(
                        Map.of("libelle", "Compte 1", "soldeInitial", 0,
                                "membreOrdres", List.of(1), "membresPrimaireOrdres", List.of(1)),
                        Map.of("libelle", "Compte 2", "soldeInitial", 0,
                                "membreOrdres", List.of(1), "membresPrimaireOrdres", List.of(1))
                ),
                "categories", List.of(),
                "scenario", Map.of(
                        "nom", "Scénario Test", "anneeDepart", 2025, "tresorerieInitiale", 0,
                        "repartitions", List.of(Map.of("membreOrdre", 1, "quotePart", 1.0))
                )
        );

        assertThatThrownBy(() -> client.post().uri("/api/foyers/onboarding")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(MAPPER.writeValueAsString(payload))
                .retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    private JsonNode trouverParLibelle(JsonNode comptes, String libelle) {
        for (JsonNode c : comptes) {
            if (c.get("libelle").asText().equals(libelle)) return c;
        }
        throw new AssertionError("Compte introuvable : " + libelle);
    }

    private String creerUtilisateurEtLogin(String email) {
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
}
