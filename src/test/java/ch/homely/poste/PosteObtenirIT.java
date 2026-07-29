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
 * Test de non-régression sécurité : GET .../postes/{id} doit rester scopé au foyer,
 * même lorsque l'appelant est membre légitime d'un *autre* foyer (T4.3 — garde
 * multi-tenant sur la lecture unitaire d'un poste, cf. PosteService#obtenir).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class PosteObtenirIT {

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
    @DisplayName("Lecture nominale : le poste est retourné")
    void obtenir_nominal() throws Exception {
        String token = creerEtLogin("obtenir_ok@test.ch");
        String foyerId = creerFoyer(token, "Foyer Obtenir OK");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-01-01", null, 1800);

        JsonNode resultat = obtenir(token, foyerId, scenarioId, posteId);

        assertThat(resultat.get("id").asText()).isEqualTo(posteId);
    }

    @Test
    @DisplayName("IDOR : un membre d'un autre foyer ne peut pas lire un poste via un scenarioId qui ne lui appartient pas")
    void obtenir_scenarioAutreFoyer_renvoie404() throws Exception {
        String tokenA = creerEtLogin("obtenir_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Obtenir");
        String scenarioAId = creerScenario(tokenA, foyerAId);
        String catAId = creerCategorie(tokenA, foyerAId, "Cat A", "CHARGE");
        String posteAId = creerPoste(tokenA, foyerAId, scenarioAId, catAId, "2025-01-01", null, 100);

        // Utilisateur B, membre légitime de SON PROPRE foyer B (pas de foyerA).
        String tokenB = creerEtLogin("obtenir_b@test.ch");
        String foyerBId = creerFoyer(tokenB, "Foyer B Obtenir");

        // B passe son propre foyerId (accès autorisé) mais le scenarioId/posteId de A :
        // la ressource ne doit pas fuiter, quel que soit le foyerId utilisé dans le path.
        assertThatThrownBy(() -> obtenir(tokenB, foyerBId, scenarioAId, posteAId))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("Lecture inter-foyers (foyerId d'autrui) renvoie 403")
    void obtenir_interFoyers_renvoie403() throws Exception {
        String tokenA = creerEtLogin("obtenir_403_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Obtenir 403");
        String scenarioId = creerScenario(tokenA, foyerAId);
        String catId = creerCategorie(tokenA, foyerAId, "Cat A", "CHARGE");
        String posteId = creerPoste(tokenA, foyerAId, scenarioId, catId, "2025-01-01", null, 100);

        String tokenB = creerEtLogin("obtenir_403_b@test.ch");
        creerFoyer(tokenB, "Foyer B Obtenir 403");

        assertThatThrownBy(() -> obtenir(tokenB, foyerAId, scenarioId, posteId))
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
                               String debut, String fin, double montant) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "CHARGE");
        payload.put("description", "Poste test obtenir");
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

    private JsonNode obtenir(String token, String foyerId, String scenarioId, String posteId) {
        String body = client.get()
                .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes/" + posteId)
                .header("Authorization", "Bearer " + token)
                .retrieve().body(String.class);
        try {
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
