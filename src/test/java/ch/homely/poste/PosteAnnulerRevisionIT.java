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
 * Tests d'intégration pour l'action d'annulation d'une révision de montant
 * (POST .../postes/{id}/annuler-revision) — fusion du maillon actif avec son
 * prédécesseur.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class PosteAnnulerRevisionIT {

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
    @DisplayName("Nominal : sans fin propre — le maillon actif disparaît, le précédent redevient actif sans fin")
    void annuler_nominal_sansFinPropre() throws Exception {
        String token = creerEtLogin("annuler_ok@test.ch");
        String foyerId = creerFoyer(token, "Foyer Annuler OK");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Loyer", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-01-01", null, 1800);

        JsonNode revision = reviser(token, foyerId, scenarioId, posteId, 1950, "2027-01-01");
        String nouveauId = revision.get("posteCree").get("id").asText();

        JsonNode precedent = annulerRevision(token, foyerId, scenarioId, nouveauId);

        assertThat(precedent.get("id").asText()).isEqualTo(posteId);
        assertThat(precedent.get("montant").asDouble()).isEqualTo(1800.0);
        assertThat(precedent.hasNonNull("fin")).isFalse();
        assertThat(precedent.hasNonNull("posteSuivantId")).isFalse();

        assertThatThrownBy(() -> obtenirPoste(token, foyerId, scenarioId, nouveauId))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("Nominal : fin propre restaurée telle quelle")
    void annuler_nominal_avecFinPropreRestauree() throws Exception {
        String token = creerEtLogin("annuler_fin@test.ch");
        String foyerId = creerFoyer(token, "Foyer Annuler Fin");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Loyer2", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-01-01", "2028-06-30", 1800);

        JsonNode revision = reviser(token, foyerId, scenarioId, posteId, 1950, "2027-01-01");
        String nouveauId = revision.get("posteCree").get("id").asText();

        JsonNode precedent = annulerRevision(token, foyerId, scenarioId, nouveauId);

        assertThat(precedent.get("fin").asText()).isEqualTo("2028-06-30");
    }

    @Test
    @DisplayName("Chaîne à 3 maillons : annuler le dernier laisse le premier maillon intact")
    void annuler_chaine_neTouchePasLeReste() throws Exception {
        String token = creerEtLogin("annuler_chaine@test.ch");
        String foyerId = creerFoyer(token, "Foyer Annuler Chaîne");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Chaîne", "CHARGE", 1);
        String origineId = creerPoste(token, foyerId, scenarioId, catId, "2024-01-01", null, 1000);

        JsonNode premiere = reviser(token, foyerId, scenarioId, origineId, 1100, "2026-01-01");
        String intermediaireId = premiere.get("posteCree").get("id").asText();

        JsonNode seconde = reviser(token, foyerId, scenarioId, intermediaireId, 1200, "2027-01-01");
        String dernierId = seconde.get("posteCree").get("id").asText();

        JsonNode precedent = annulerRevision(token, foyerId, scenarioId, dernierId);

        assertThat(precedent.get("id").asText()).isEqualTo(intermediaireId);
        assertThat(precedent.get("posteOrigineId").asText()).isEqualTo(origineId);
        assertThat(precedent.get("montant").asDouble()).isEqualTo(1100.0);

        // Le premier maillon de la chaîne reste inchangé
        JsonNode origine = obtenirPoste(token, foyerId, scenarioId, origineId);
        assertThat(origine.get("fin").asText()).isEqualTo("2025-12-31");
    }

    @Test
    @DisplayName("Rejet : le poste ciblé n'est pas issu d'une révision")
    void annuler_rejette_pasDeRevision() {
        String token = creerEtLogin("annuler_norev@test.ch");
        String foyerId = creerFoyer(token, "Foyer Sans Révision");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Normal", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-01-01", null, 500);

        assertThatThrownBy(() -> annulerRevision(token, foyerId, scenarioId, posteId))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Rejet : le poste ciblé n'est pas le dernier maillon (a un successeur)")
    void annuler_rejette_maillonIntermediaire() throws Exception {
        String token = creerEtLogin("annuler_interm@test.ch");
        String foyerId = creerFoyer(token, "Foyer Maillon Intermédiaire");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Chaîne2", "CHARGE", 1);
        String origineId = creerPoste(token, foyerId, scenarioId, catId, "2024-01-01", null, 1000);

        JsonNode premiere = reviser(token, foyerId, scenarioId, origineId, 1100, "2026-01-01");
        String intermediaireId = premiere.get("posteCree").get("id").asText();
        reviser(token, foyerId, scenarioId, intermediaireId, 1200, "2027-01-01");

        assertThatThrownBy(() -> annulerRevision(token, foyerId, scenarioId, intermediaireId))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Annulation inter-foyers renvoie 403")
    void annuler_interFoyers_renvoie403() throws Exception {
        String tokenA = creerEtLogin("annuler_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Annuler");
        String scenarioId = creerScenario(tokenA, foyerAId);
        String catId = creerCategorie(tokenA, foyerAId, "Cat A", "CHARGE", 1);
        String posteId = creerPoste(tokenA, foyerAId, scenarioId, catId, "2025-01-01", null, 100);
        JsonNode revision = reviser(tokenA, foyerAId, scenarioId, posteId, 150, "2027-01-01");
        String nouveauId = revision.get("posteCree").get("id").asText();

        String tokenB = creerEtLogin("annuler_b@test.ch");
        creerFoyer(tokenB, "Foyer B Annuler");

        assertThatThrownBy(() -> annulerRevision(tokenB, foyerAId, scenarioId, nouveauId))
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
        payload.put("description", "Poste test annulation révision");
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

    private JsonNode annulerRevision(String token, String foyerId, String scenarioId, String posteId) {
        String body = client.post()
                .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes/" + posteId + "/annuler-revision")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .retrieve().body(String.class);
        try {
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private JsonNode obtenirPoste(String token, String foyerId, String scenarioId, String posteId) {
        String body = client.get()
                .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes/" + posteId)
                .header("Authorization", "Bearer " + token)
                .retrieve().body(String.class);
        try {
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
