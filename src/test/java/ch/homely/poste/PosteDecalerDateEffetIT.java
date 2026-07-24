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
 * Tests d'intégration pour l'action de déplacement de la date d'effet
 * (POST .../postes/{id}/decaler-date-effet) — ajustement atomique de la
 * frontière entre un maillon d'une chaîne de révisions et son prédécesseur.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class PosteDecalerDateEffetIT {

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
    @DisplayName("Nominal : repousser la date d'effet (le précédent absorbe plus de période)")
    void decaler_nominal_repousser() throws Exception {
        String token = creerEtLogin("decaler_repousser@test.ch");
        String foyerId = creerFoyer(token, "Foyer Décaler Repousser");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Loyer", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-01-01", null, 1800);

        JsonNode revision = reviser(token, foyerId, scenarioId, posteId, 1950, "2026-01-01");
        String nouveauId = revision.get("posteCree").get("id").asText();

        JsonNode resultat = decalerDateEffet(token, foyerId, scenarioId, nouveauId, "2026-04-01");

        JsonNode precedent = resultat.get("postePrecedent");
        JsonNode edite = resultat.get("posteEdite");
        assertThat(precedent.get("id").asText()).isEqualTo(posteId);
        assertThat(precedent.get("fin").asText()).isEqualTo("2026-03-31");
        assertThat(edite.get("id").asText()).isEqualTo(nouveauId);
        assertThat(edite.get("debut").asText()).isEqualTo("2026-04-01");
        assertThat(edite.get("montant").asDouble()).isEqualTo(1950.0);
    }

    @Test
    @DisplayName("Nominal : avancer la date d'effet (le précédent perd de la période)")
    void decaler_nominal_avancer() throws Exception {
        String token = creerEtLogin("decaler_avancer@test.ch");
        String foyerId = creerFoyer(token, "Foyer Décaler Avancer");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Loyer2", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-01-01", null, 1800);

        JsonNode revision = reviser(token, foyerId, scenarioId, posteId, 1950, "2026-06-01");
        String nouveauId = revision.get("posteCree").get("id").asText();

        JsonNode resultat = decalerDateEffet(token, foyerId, scenarioId, nouveauId, "2026-02-01");

        JsonNode precedent = resultat.get("postePrecedent");
        JsonNode edite = resultat.get("posteEdite");
        assertThat(precedent.get("fin").asText()).isEqualTo("2026-01-31");
        assertThat(edite.get("debut").asText()).isEqualTo("2026-02-01");
    }

    @Test
    @DisplayName("Chaîne à 3 maillons : décaler la frontière d'un maillon intermédiaire ne touche pas le 3e maillon")
    void decaler_maillonIntermediaire_neTouchePasLeReste() throws Exception {
        String token = creerEtLogin("decaler_interm@test.ch");
        String foyerId = creerFoyer(token, "Foyer Décaler Intermédiaire");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Chaîne", "CHARGE", 1);
        String origineId = creerPoste(token, foyerId, scenarioId, catId, "2024-01-01", null, 1000);

        JsonNode premiere = reviser(token, foyerId, scenarioId, origineId, 1100, "2025-06-01");
        String intermediaireId = premiere.get("posteCree").get("id").asText();

        JsonNode seconde = reviser(token, foyerId, scenarioId, intermediaireId, 1200, "2026-06-01");
        String dernierId = seconde.get("posteCree").get("id").asText();

        JsonNode resultat = decalerDateEffet(token, foyerId, scenarioId, intermediaireId, "2025-09-01");

        JsonNode precedent = resultat.get("postePrecedent");
        JsonNode edite = resultat.get("posteEdite");
        assertThat(precedent.get("id").asText()).isEqualTo(origineId);
        assertThat(precedent.get("fin").asText()).isEqualTo("2025-08-31");
        assertThat(edite.get("id").asText()).isEqualTo(intermediaireId);
        assertThat(edite.get("debut").asText()).isEqualTo("2025-09-01");
        // Toujours borné par la fin déjà figée par le successeur
        assertThat(edite.get("fin").asText()).isEqualTo("2026-05-31");

        // Le 3e maillon de la chaîne reste inchangé
        JsonNode dernier = obtenirPoste(token, foyerId, scenarioId, dernierId);
        assertThat(dernier.get("debut").asText()).isEqualTo("2026-06-01");
        assertThat(dernier.get("montant").asDouble()).isEqualTo(1200.0);
    }

    @Test
    @DisplayName("Rejet : nouvelle date d'effet égale à la date de début du précédent")
    void decaler_rejette_dateEgaleDebutPrecedent() throws Exception {
        String token = creerEtLogin("decaler_egaledebut@test.ch");
        String foyerId = creerFoyer(token, "Foyer Rejet Début");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Loyer3", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-01-01", null, 1800);

        JsonNode revision = reviser(token, foyerId, scenarioId, posteId, 1950, "2026-01-01");
        String nouveauId = revision.get("posteCree").get("id").asText();

        assertThatThrownBy(() -> decalerDateEffet(token, foyerId, scenarioId, nouveauId, "2025-01-01"))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Rejet : nouvelle date d'effet égale ou postérieure à la fin déjà figée du maillon édité")
    void decaler_rejette_dateEgaleOuApresFinEditee() throws Exception {
        String token = creerEtLogin("decaler_finfigee@test.ch");
        String foyerId = creerFoyer(token, "Foyer Rejet Fin");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Chaîne3", "CHARGE", 1);
        String origineId = creerPoste(token, foyerId, scenarioId, catId, "2024-01-01", null, 1000);

        JsonNode premiere = reviser(token, foyerId, scenarioId, origineId, 1100, "2025-06-01");
        String intermediaireId = premiere.get("posteCree").get("id").asText();
        reviser(token, foyerId, scenarioId, intermediaireId, 1200, "2026-06-01");

        assertThatThrownBy(() -> decalerDateEffet(token, foyerId, scenarioId, intermediaireId, "2026-06-01"))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Le dernier maillon d'une chaîne peut être décalé au-delà de sa propre fin manuelle (pas de successeur)")
    void decaler_dernierMaillonAvecFinManuelle_ignoreSaPropreFin() throws Exception {
        String token = creerEtLogin("decaler_finmanuelle@test.ch");
        String foyerId = creerFoyer(token, "Foyer Fin Manuelle");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Loyer4", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-01-01", null, 1800);

        JsonNode revision = reviser(token, foyerId, scenarioId, posteId, 1950, "2026-01-01");
        String nouveauId = revision.get("posteCree").get("id").asText();

        // Clôture manuelle du dernier maillon (fin propre, pas issue d'une révision suivante)
        Map<String, Object> clotureReq = Map.of("fin", "2026-08-31");
        client.post()
                .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes/" + nouveauId + "/cloturer")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(MAPPER.writeValueAsString(clotureReq))
                .retrieve().body(String.class);

        // La date choisie est postérieure à la fin manuelle : ne doit pas être rejetée,
        // car aucun successeur ne fige cette borne.
        JsonNode resultat = decalerDateEffet(token, foyerId, scenarioId, nouveauId, "2026-09-01");

        assertThat(resultat.get("posteEdite").get("debut").asText()).isEqualTo("2026-09-01");
        assertThat(resultat.get("posteEdite").get("fin").asText()).isEqualTo("2026-08-31");
    }

    @Test
    @DisplayName("Rejet : le poste ciblé n'est pas issu d'une révision (pas de prédécesseur)")
    void decaler_rejette_pasDeRevision() {
        String token = creerEtLogin("decaler_norev@test.ch");
        String foyerId = creerFoyer(token, "Foyer Sans Révision Décalage");
        String scenarioId = creerScenario(token, foyerId);
        String catId = creerCategorie(token, foyerId, "Normal", "CHARGE", 1);
        String posteId = creerPoste(token, foyerId, scenarioId, catId, "2025-01-01", null, 500);

        assertThatThrownBy(() -> decalerDateEffet(token, foyerId, scenarioId, posteId, "2025-06-01"))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Décalage inter-foyers renvoie 403")
    void decaler_interFoyers_renvoie403() throws Exception {
        String tokenA = creerEtLogin("decaler_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Décaler");
        String scenarioId = creerScenario(tokenA, foyerAId);
        String catId = creerCategorie(tokenA, foyerAId, "Cat A", "CHARGE", 1);
        String posteId = creerPoste(tokenA, foyerAId, scenarioId, catId, "2025-01-01", null, 100);
        JsonNode revision = reviser(tokenA, foyerAId, scenarioId, posteId, 150, "2026-01-01");
        String nouveauId = revision.get("posteCree").get("id").asText();

        String tokenB = creerEtLogin("decaler_b@test.ch");
        creerFoyer(tokenB, "Foyer B Décaler");

        assertThatThrownBy(() -> decalerDateEffet(tokenB, foyerAId, scenarioId, nouveauId, "2026-03-01"))
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
        payload.put("description", "Poste test décalage date d'effet");
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

    private JsonNode decalerDateEffet(String token, String foyerId, String scenarioId, String posteId,
                                       String nouvelleDateEffet) {
        Map<String, Object> payload = Map.of("nouvelleDateEffet", nouvelleDateEffet);
        String jsonPayload;
        try {
            jsonPayload = MAPPER.writeValueAsString(payload);
        } catch (Exception e) { throw new RuntimeException(e); }

        String body = client.post()
                .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes/" + posteId + "/decaler-date-effet")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(jsonPayload)
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
