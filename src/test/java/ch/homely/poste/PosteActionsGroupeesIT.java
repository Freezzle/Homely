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
 * Tests d'intégration pour les actions groupées sur les postes
 * (POST .../postes/actions-groupees et POST .../postes/supprimer-groupe).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class PosteActionsGroupeesIT {

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

    // ── Mise à jour groupée : catégorie ─────────────────────────────────────

    @Test
    @DisplayName("Action groupée catégorie : applique la nouvelle catégorie à tous les postes")
    void actionsGroupees_categorie_nominal() throws Exception {
        String token = creerEtLogin("bulk_cat_ok@test.ch");
        String foyerId = creerFoyer(token, "Foyer Bulk Catégorie");
        String scenarioId = creerScenario(token, foyerId);
        String catA = creerCategorie(token, foyerId, "Cat A", "CHARGE");
        String catB = creerCategorie(token, foyerId, "Cat B", "CHARGE");
        String poste1 = creerPoste(token, foyerId, scenarioId, catA, 100);
        String poste2 = creerPoste(token, foyerId, scenarioId, catA, 200);

        JsonNode resultat = actionsGroupees(token, foyerId, scenarioId,
                Map.of("ids", List.of(poste1, poste2), "champ", "CATEGORIE", "categorieId", catB));

        assertThat(resultat).hasSize(2);
        resultat.forEach(p -> assertThat(p.get("categorieId").asText()).isEqualTo(catB));
    }

    @Test
    @DisplayName("Action groupée importance : applique la nouvelle importance à tous les postes")
    void actionsGroupees_importance_nominal() throws Exception {
        String token = creerEtLogin("bulk_imp_ok@test.ch");
        String foyerId = creerFoyer(token, "Foyer Bulk Importance");
        String scenarioId = creerScenario(token, foyerId);
        String cat = creerCategorie(token, foyerId, "Cat", "CHARGE");
        String poste1 = creerPoste(token, foyerId, scenarioId, cat, 100);
        String poste2 = creerPoste(token, foyerId, scenarioId, cat, 200);

        JsonNode resultat = actionsGroupees(token, foyerId, scenarioId,
                Map.of("ids", List.of(poste1, poste2), "champ", "IMPORTANCE", "importance", 5));

        assertThat(resultat).hasSize(2);
        resultat.forEach(p -> assertThat(p.get("importance").asInt()).isEqualTo(5));
    }

    @Test
    @DisplayName("Action groupée potentiel d'optimisation : applique la nouvelle valeur à tous les postes")
    void actionsGroupees_potentielOptimisation_nominal() throws Exception {
        String token = creerEtLogin("bulk_pot_ok@test.ch");
        String foyerId = creerFoyer(token, "Foyer Bulk Potentiel");
        String scenarioId = creerScenario(token, foyerId);
        String cat = creerCategorie(token, foyerId, "Cat", "CHARGE");
        String poste1 = creerPoste(token, foyerId, scenarioId, cat, 100);

        JsonNode resultat = actionsGroupees(token, foyerId, scenarioId,
                Map.of("ids", List.of(poste1), "champ", "POTENTIEL_OPTIMISATION", "potentielOptimisation", 1));

        assertThat(resultat).hasSize(1);
        assertThat(resultat.get(0).get("potentielOptimisation").asInt()).isEqualTo(1);
    }

    @Test
    @DisplayName("Action groupée importance : valeur hors bornes (>5) rejetée")
    void actionsGroupees_importance_horsBornes_rejetee() throws Exception {
        String token = creerEtLogin("bulk_imp_bad@test.ch");
        String foyerId = creerFoyer(token, "Foyer Bulk Importance Invalide");
        String scenarioId = creerScenario(token, foyerId);
        String cat = creerCategorie(token, foyerId, "Cat", "CHARGE");
        String poste1 = creerPoste(token, foyerId, scenarioId, cat, 100);

        assertThatThrownBy(() -> actionsGroupees(token, foyerId, scenarioId,
                Map.of("ids", List.of(poste1), "champ", "IMPORTANCE", "importance", 9)))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("Action groupée catégorie : catégorie inexistante rejetée")
    void actionsGroupees_categorieInexistante_rejetee() throws Exception {
        String token = creerEtLogin("bulk_cat_bad@test.ch");
        String foyerId = creerFoyer(token, "Foyer Bulk Cat Invalide");
        String scenarioId = creerScenario(token, foyerId);
        String cat = creerCategorie(token, foyerId, "Cat", "CHARGE");
        String poste1 = creerPoste(token, foyerId, scenarioId, cat, 100);

        assertThatThrownBy(() -> actionsGroupees(token, foyerId, scenarioId,
                Map.of("ids", List.of(poste1), "champ", "CATEGORIE", "categorieId", "00000000-0000-0000-0000-000000000000")))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("Action groupée : un id appartenant à un autre scénario est rejetée intégralement")
    void actionsGroupees_idHorsScenario_rejetee() throws Exception {
        String token = creerEtLogin("bulk_hors_scenario@test.ch");
        String foyerId = creerFoyer(token, "Foyer Bulk Hors Scénario");
        String scenarioId1 = creerScenario(token, foyerId);
        String scenarioId2 = creerScenario(token, foyerId);
        String cat = creerCategorie(token, foyerId, "Cat", "CHARGE");
        String posteScenario1 = creerPoste(token, foyerId, scenarioId1, cat, 100);
        String posteScenario2 = creerPoste(token, foyerId, scenarioId2, cat, 100);

        assertThatThrownBy(() -> actionsGroupees(token, foyerId, scenarioId1,
                Map.of("ids", List.of(posteScenario1, posteScenario2), "champ", "IMPORTANCE", "importance", 4)))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Action groupée inter-foyers renvoie 403")
    void actionsGroupees_interFoyers_renvoie403() throws Exception {
        String tokenA = creerEtLogin("bulk_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Bulk");
        String scenarioId = creerScenario(tokenA, foyerAId);
        String cat = creerCategorie(tokenA, foyerAId, "Cat A", "CHARGE");
        String posteId = creerPoste(tokenA, foyerAId, scenarioId, cat, 100);

        String tokenB = creerEtLogin("bulk_b@test.ch");
        creerFoyer(tokenB, "Foyer B Bulk");

        assertThatThrownBy(() -> actionsGroupees(tokenB, foyerAId, scenarioId,
                Map.of("ids", List.of(posteId), "champ", "IMPORTANCE", "importance", 4)))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    // ── Suppression groupée ──────────────────────────────────────────────────

    @Test
    @DisplayName("Suppression groupée nominale : tous les postes ciblés sont supprimés")
    void supprimerGroupe_nominal() throws Exception {
        String token = creerEtLogin("bulk_del_ok@test.ch");
        String foyerId = creerFoyer(token, "Foyer Bulk Suppression");
        String scenarioId = creerScenario(token, foyerId);
        String cat = creerCategorie(token, foyerId, "Cat", "CHARGE");
        String poste1 = creerPoste(token, foyerId, scenarioId, cat, 100);
        String poste2 = creerPoste(token, foyerId, scenarioId, cat, 200);

        supprimerGroupe(token, foyerId, scenarioId, List.of(poste1, poste2));

        String listeBody = client.get()
                .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes")
                .header("Authorization", "Bearer " + token)
                .retrieve().body(String.class);
        assertThat(MAPPER.readTree(listeBody)).isEmpty();
    }

    @Test
    @DisplayName("Suppression groupée : un id appartenant à un autre scénario est rejetée intégralement")
    void supprimerGroupe_idHorsScenario_rejetee() throws Exception {
        String token = creerEtLogin("bulk_del_hors@test.ch");
        String foyerId = creerFoyer(token, "Foyer Bulk Suppr Hors Scénario");
        String scenarioId1 = creerScenario(token, foyerId);
        String scenarioId2 = creerScenario(token, foyerId);
        String cat = creerCategorie(token, foyerId, "Cat", "CHARGE");
        String posteScenario1 = creerPoste(token, foyerId, scenarioId1, cat, 100);
        String posteScenario2 = creerPoste(token, foyerId, scenarioId2, cat, 100);

        assertThatThrownBy(() -> supprimerGroupe(token, foyerId, scenarioId1,
                List.of(posteScenario1, posteScenario2)))
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("Suppression groupée inter-foyers renvoie 403")
    void supprimerGroupe_interFoyers_renvoie403() throws Exception {
        String tokenA = creerEtLogin("bulk_del_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Bulk Suppr");
        String scenarioId = creerScenario(tokenA, foyerAId);
        String cat = creerCategorie(tokenA, foyerAId, "Cat A", "CHARGE");
        String posteId = creerPoste(tokenA, foyerAId, scenarioId, cat, 100);

        String tokenB = creerEtLogin("bulk_del_b@test.ch");
        creerFoyer(tokenB, "Foyer B Bulk Suppr");

        assertThatThrownBy(() -> supprimerGroupe(tokenB, foyerAId, scenarioId, List.of(posteId)))
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
                "nom", "Scénario Test " + System.nanoTime(),
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

    private String creerPoste(String token, String foyerId, String scenarioId, String catId, double montant) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "CHARGE");
        payload.put("description", "Poste test bulk");
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", 1);
        payload.put("debut", "2025-01-01");
        payload.put("fin", null);
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

    private JsonNode actionsGroupees(String token, String foyerId, String scenarioId, Map<String, Object> payload) {
        String jsonPayload;
        try {
            jsonPayload = MAPPER.writeValueAsString(payload);
        } catch (Exception e) { throw new RuntimeException(e); }

        String body = client.post()
                .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes/actions-groupees")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(jsonPayload)
                .retrieve().body(String.class);
        try {
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private void supprimerGroupe(String token, String foyerId, String scenarioId, List<String> ids) {
        Map<String, Object> payload = Map.of("ids", ids);
        String jsonPayload;
        try {
            jsonPayload = MAPPER.writeValueAsString(payload);
        } catch (Exception e) { throw new RuntimeException(e); }

        client.post()
                .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes/supprimer-groupe")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body(jsonPayload)
                .retrieve().toBodilessEntity();
    }
}
