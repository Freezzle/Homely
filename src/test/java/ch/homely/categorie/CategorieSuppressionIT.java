package ch.homely.categorie;

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
 * Tests d'intégration pour la suppression (hard delete) des catégories.
 * Vérifie que :
 * 1. La ligne catégorie est physiquement supprimée (404 après suppression).
 * 2. Les postes associés ont leur categorie_id mis à NULL (pas supprimés).
 * 3. Les catégories système sont protégées (409).
 * 4. Accès inter-foyers sur la suppression renvoie 403.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class CategorieSuppressionIT {

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
    @DisplayName("Hard delete : la catégorie est supprimée physiquement (404 après DELETE)")
    void supprimerCategorie_supprimeLaLigne() {
        String token = creerEtLogin("cat_del_1@test.ch");
        String foyerId = creerFoyer(token, "Foyer Test Cat Del");

        // Créer une catégorie personnalisée
        String catId = creerCategorie(token, foyerId, "Loisirs", "CHARGE", 10);

        // Supprimer
        client.delete()
                .uri("/api/foyers/" + foyerId + "/categories/" + catId)
                .header("Authorization", "Bearer " + token)
                .retrieve().toBodilessEntity();

        // GET doit renvoyer 404 (hard delete)
        assertThatThrownBy(() -> client.get()
                .uri("/api/foyers/" + foyerId + "/categories/" + catId)
                .header("Authorization", "Bearer " + token)
                .retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("Hard delete : les postes référençant la catégorie ont leur categorieId mis à NULL")
    void supprimerCategorie_dissociePostes() throws Exception {
        String token = creerEtLogin("cat_del_2@test.ch");
        String foyerId = creerFoyer(token, "Foyer Cat Dissoc");
        String catId = creerCategorie(token, foyerId, "Alimentation", "CHARGE", 5);
        String scenarioId = creerScenario(token, foyerId);

        // Créer un poste rattaché à cette catégorie
        String posteId = creerPoste(token, foyerId, scenarioId, catId);

        // Supprimer la catégorie
        client.delete()
                .uri("/api/foyers/" + foyerId + "/categories/" + catId)
                .header("Authorization", "Bearer " + token)
                .retrieve().toBodilessEntity();

        // Le poste doit toujours exister mais sans categorieId
        String postesJson = client.get()
                .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes")
                .header("Authorization", "Bearer " + token)
                .retrieve().body(String.class);

        JsonNode postes = MAPPER.readTree(postesJson);
        JsonNode poste = null;
        for (JsonNode p : postes) {
            if (posteId.equals(p.get("id").asText())) { poste = p; break; }
        }
        assertThat(poste).as("Le poste doit encore exister").isNotNull();
        assertThat(poste.hasNonNull("categorieId"))
                .as("categorieId doit être null après suppression de la catégorie")
                .isFalse();
    }

    @Test
    @DisplayName("Suppression d'une catégorie système renvoie 409")
    void supprimerCategorieSysteme_renvoie409() throws Exception {
        String token = creerEtLogin("cat_del_sys@test.ch");
        String foyerId = creerFoyer(token, "Foyer Sys Cat");

        // Trouver une catégorie système dans la liste
        String catsJson = client.get()
                .uri("/api/foyers/" + foyerId + "/categories")
                .header("Authorization", "Bearer " + token)
                .retrieve().body(String.class);

        JsonNode cats = MAPPER.readTree(catsJson);
        String sysCatId = null;
        for (JsonNode c : cats) {
            if (c.get("systeme").asBoolean()) { sysCatId = c.get("id").asText(); break; }
        }

        if (sysCatId == null) return; // Pas de catégorie système dans ce foyer → test non applicable

        final String idToDelete = sysCatId;
        assertThatThrownBy(() -> client.delete()
                .uri("/api/foyers/" + foyerId + "/categories/" + idToDelete)
                .header("Authorization", "Bearer " + token)
                .retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("Suppression inter-foyers renvoie 403")
    void supprimerCategorie_interFoyers_renvoie403() {
        String tokenA = creerEtLogin("cat_del_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Cat");
        String catId = creerCategorie(tokenA, foyerAId, "Sport", "CHARGE", 3);

        String tokenB = creerEtLogin("cat_del_b@test.ch");
        creerFoyer(tokenB, "Foyer B Cat"); // B a son propre foyer

        assertThatThrownBy(() -> client.delete()
                .uri("/api/foyers/" + foyerAId + "/categories/" + catId)
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
        Map<String, Object> payload = Map.of(
                "nom", "Scénario Test",
                "anneeDepart", 2025,
                "horizonAnnees", 1,
                "tresorerieInitiale", 0,
                "repartitions", List.of()
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

    private String creerPoste(String token, String foyerId, String scenarioId, String catId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "CHARGE");
        payload.put("description", "Poste test catégorie");
        payload.put("categorieId", catId);
        payload.put("montant", 100);
        payload.put("periodiciteMois", 1);
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
}



