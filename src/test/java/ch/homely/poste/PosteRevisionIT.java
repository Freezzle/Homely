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
 * Tests d'intégration pour l'action de révision de montant planifiée
 * (POST .../postes/{id}/reviser-montant).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class PosteRevisionIT {

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
    @DisplayName("Révision nominale : clôture l'ancien, crée le nouveau, recopie répartitions/ventilations")
    void reviser_nominal() throws Exception {
        String token = creerEtLogin("revision_ok@test.ch");
        String foyerId = creerFoyer(token, "Foyer Révision OK");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Loyer", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-01-01", null, 1800);

        JsonNode reponse = reviser(token, foyerId, scenarioId, posteId, 1950, "2027-01-01");
        JsonNode ancien = reponse.get("posteCloture");
        JsonNode nouveau = reponse.get("posteCree");

        assertThat(ancien.get("id").asText()).isEqualTo(posteId);
        assertThat(ancien.get("fin").asText()).isEqualTo("2026-12-31");
        assertThat(ancien.get("posteSuivantId").asText()).isEqualTo(nouveau.get("id").asText());

        assertThat(nouveau.get("montant").asDouble()).isEqualTo(1950.0);
        assertThat(nouveau.get("debut").asText()).isEqualTo("2027-01-01");
        assertThat(nouveau.get("posteOrigineId").asText()).isEqualTo(posteId);
        assertThat(nouveau.get("categorieId").asText()).isEqualTo(catId);
        assertThat(nouveau.get("periodiciteMois").asInt()).isEqualTo(1);
        assertThat(nouveau.hasNonNull("fin")).isFalse();
    }

    @Test
    @DisplayName("Rejet : poste one-shot (périodicité=0) non révisable")
    void reviser_rejette_oneShot() {
        String token = creerEtLogin("revision_oneshot@test.ch");
        String foyerId = creerFoyer(token, "Foyer Révision OneShot");
        String scenarioId = creerScenario(token, foyerId);
        String posteId = creerPosteOneShot(token, foyerId, scenarioId, "2025-06-01", 500);

        assertThatThrownBy(() -> reviser(token, foyerId, scenarioId, posteId, 600, "2027-01-01"))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Rejet : poste déjà terminé dans le passé")
    void reviser_rejette_dejaTermine() {
        String token = creerEtLogin("revision_termine@test.ch");
        String foyerId = creerFoyer(token, "Foyer Révision Terminé");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Ancien", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2020-01-01", "2020-12-31", 100);

        assertThatThrownBy(() -> reviser(token, foyerId, scenarioId, posteId, 150, "2027-01-01"))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Rejet : date d'effet antérieure ou égale à la date de début")
    void reviser_rejette_dateEffetAvantDebut() {
        String token = creerEtLogin("revision_avant@test.ch");
        String foyerId = creerFoyer(token, "Foyer Révision Avant");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Test", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-06-01", null, 100);

        assertThatThrownBy(() -> reviser(token, foyerId, scenarioId, posteId, 150, "2025-06-01"))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Rejet : date d'effet postérieure à la fin déjà définie")
    void reviser_rejette_dateEffetApresFin() {
        String token = creerEtLogin("revision_apresfin@test.ch");
        String foyerId = creerFoyer(token, "Foyer Révision Après Fin");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Test2", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-01-01", "2026-06-30", 100);

        assertThatThrownBy(() -> reviser(token, foyerId, scenarioId, posteId, 150, "2027-01-01"))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Chaîne : réviser un poste déjà issu d'une révision référence le maillon intermédiaire")
    void reviser_chaine_referenceMaillonIntermediaire() throws Exception {
        String token = creerEtLogin("revision_chaine@test.ch");
        String foyerId = creerFoyer(token, "Foyer Révision Chaîne");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Chaîne", "CHARGE", 1);
        String origineId = creerPoste(token, foyerId, scenarioId, catId, "2024-01-01", null, 1000);

        JsonNode premiere = reviser(token, foyerId, scenarioId, origineId, 1100, "2026-01-01");
        String intermediaireId = premiere.get("posteCree").get("id").asText();

        JsonNode seconde = reviser(token, foyerId, scenarioId, intermediaireId, 1200, "2027-01-01");
        JsonNode finalPoste = seconde.get("posteCree");

        assertThat(finalPoste.get("posteOrigineId").asText()).isEqualTo(intermediaireId);
        assertThat(finalPoste.get("posteOrigineId").asText()).isNotEqualTo(origineId);
    }

    @Test
    @DisplayName("Révision inter-foyers renvoie 403")
    void reviser_interFoyers_renvoie403() {
        String tokenA = creerEtLogin("revision_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Révision");
        String scenarioId = creerScenario(tokenA, foyerAId);
        String catId = creerCategorie(tokenA, foyerAId, "Cat A", "CHARGE", 1);
        String posteId = creerPoste(tokenA, foyerAId, scenarioId, catId, "2025-01-01", null, 100);

        String tokenB = creerEtLogin("revision_b@test.ch");
        creerFoyer(tokenB, "Foyer B Révision");

        assertThatThrownBy(() -> reviser(tokenB, foyerAId, scenarioId, posteId, 150, "2027-01-01"))
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
        payload.put("description", "Poste test révision");
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
        return creerPosteInterne(token, foyerId, scenarioId, payload);
    }

    private String creerPosteOneShot(String token, String foyerId, String scenarioId, String debut, double montant) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "CHARGE");
        payload.put("description", "Poste one-shot test révision");
        payload.put("montant", montant);
        payload.put("periodiciteMois", 0);
        payload.put("debut", debut);
        payload.put("mode", "MENSUALISE");
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", "EFFECTIF");
        payload.put("ordre", 1);
        payload.put("repartitions", List.of());
        payload.put("ventilations", List.of());
        return creerPosteInterne(token, foyerId, scenarioId, payload);
    }

    private String creerPosteInterne(String token, String foyerId, String scenarioId, Map<String, Object> payload) {
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
}
