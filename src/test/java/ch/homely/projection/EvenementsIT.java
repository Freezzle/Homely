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

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests d'intégration pour l'endpoint des événements budgétaires
 * (GET .../projection/evenements) — "ce qui change".
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class EvenementsIT {

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
    @DisplayName("Un poste qui démarre dans l'année génère un événement DEBUT")
    void posteQuiDemarreGenereDebut() throws Exception {
        String token = creerEtLogin("evt_debut@test.ch");
        String foyerId = creerFoyer(token, "Foyer Événements Début");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Salaire", "REVENU");
        creerPoste(token, foyerId, scenarioId, catId, "REVENU", "2026-03-01", null, 1000, 1);

        List<JsonNode> evts = evenements(token, foyerId, scenarioId, 2026);

        assertThat(evts).anySatisfy(e -> {
            assertThat(e.get("type").asText()).isEqualTo("DEBUT");
            assertThat(e.get("mois").asInt()).isEqualTo(3);
            assertThat(e.get("montantMensualiseDelta").asDouble()).isEqualTo(1000.0);
        });
    }

    @Test
    @DisplayName("Une révision de montant génère un événement REVISION avec le delta signé")
    void revisionGenereEvenementRevision() throws Exception {
        String token = creerEtLogin("evt_revision@test.ch");
        String foyerId = creerFoyer(token, "Foyer Événements Révision");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "CHARGE", "2025-01-01", null, 1500, 1);
        reviser(token, foyerId, scenarioId, posteId, 1650, "2026-07-01");

        List<JsonNode> evts = evenements(token, foyerId, scenarioId, 2026);

        assertThat(evts).anySatisfy(e -> {
            assertThat(e.get("type").asText()).isEqualTo("REVISION");
            assertThat(e.get("mois").asInt()).isEqualTo(7);
            assertThat(e.get("montantMensualiseDelta").asDouble()).isEqualTo(-150.0);
        });
        // pas de FIN pour l'ancien maillon (remplacé par la révision)
        assertThat(evts).noneMatch(e -> e.get("type").asText().equals("FIN"));
    }

    @Test
    @DisplayName("Un poste périodique non mensuel génère des événements OCCURRENCE hors DEBUT")
    void posteTrimestrielGenereOccurrences() throws Exception {
        String token = creerEtLogin("evt_occurrence@test.ch");
        String foyerId = creerFoyer(token, "Foyer Événements Occurrence");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Assurance", "CHARGE");
        creerPoste(token, foyerId, scenarioId, catId, "CHARGE", "2025-01-01", null, 300, 3);

        List<JsonNode> evts = evenements(token, foyerId, scenarioId, 2026);

        List<JsonNode> occurrences = evts.stream()
                .filter(e -> e.get("type").asText().equals("OCCURRENCE")).toList();
        assertThat(occurrences).extracting(e -> e.get("mois").asInt())
                .containsExactly(1, 4, 7, 10);
    }

    @Test
    @DisplayName("Accès inter-foyers refusé (403)")
    void accesInterFoyersRefuse() {
        String tokenA = creerEtLogin("evt_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Événements");
        String scenarioId = creerScenario(tokenA, foyerAId);

        String tokenB = creerEtLogin("evt_b@test.ch");
        creerFoyer(tokenB, "Foyer B Événements");

        assertThatThrownBy(() -> client.get()
                .uri("/api/foyers/" + foyerAId + "/scenarios/" + scenarioId + "/projection/evenements?annee=2026")
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
                "horizonAnnees", 3,
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

    private String creerPoste(String token, String foyerId, String scenarioId, String catId, String type,
                               String debut, String fin, double montant, int periodiciteMois) {
        return creerPoste(token, foyerId, scenarioId, catId, type, debut, fin, montant, periodiciteMois, "MENSUALISE");
    }

    private String creerPoste(String token, String foyerId, String scenarioId, String catId, String type,
                               String debut, String fin, double montant, int periodiciteMois, String mode) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("description", "Poste test événements");
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", periodiciteMois);
        payload.put("debut", debut);
        payload.put("fin", fin);
        payload.put("mode", mode);
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

    private void reviser(String token, String foyerId, String scenarioId, String posteId,
                          double nouveauMontant, String dateEffet) {
        Map<String, Object> payload = Map.of("nouveauMontant", nouveauMontant, "dateEffet", dateEffet);
        try {
            client.post()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes/" + posteId + "/reviser-montant")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().toBodilessEntity();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private List<JsonNode> evenements(String token, String foyerId, String scenarioId, int annee) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/projection/evenements?annee=" + annee)
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            JsonNode arr = MAPPER.readTree(body);
            List<JsonNode> result = new java.util.ArrayList<>();
            arr.forEach(result::add);
            return result;
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
