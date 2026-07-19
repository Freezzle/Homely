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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Autowired;
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

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class FoyerSuppressionCascadeIT {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @LocalServerPort
    int port;

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private RestClient client;
    @Autowired
    JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        client = RestClient.builder().baseUrl("http://localhost:" + port).build();
    }

    @Test
    @DisplayName("DELETE /api/foyers/{id} supprime le foyer même avec des postes liés à une catégorie")
    void supprimerFoyer_avecPostesEtCategories_supprimeEnCascade() {
        String token = creerEtLogin("foyer_del_1@test.ch");
        String foyerId = creerFoyer(token, "Foyer suppression cascade");
        String catId = creerCategorie(token, foyerId, "Charges fixes", "CHARGE", 1);
        String scenarioId = premierScenarioId(token, foyerId);
        String membreId = premierMembreId(token, foyerId);
        String compteId = creerCompte(token, foyerId, membreId);
        creerActif(token, foyerId);
        creerPoste(token, foyerId, scenarioId, catId);
        creerObjectif(token, foyerId, scenarioId, catId, compteId);

        client.delete()
                .uri("/api/foyers/" + foyerId)
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .toBodilessEntity();

        assertThat(count("SELECT COUNT(*) FROM foyer WHERE id = ?", foyerId)).isZero();
        assertThat(count("SELECT COUNT(*) FROM acces_foyer WHERE foyer_id = ?", foyerId)).isZero();
        assertThat(count("SELECT COUNT(*) FROM scenario WHERE foyer_id = ?", foyerId)).isZero();
        assertThat(count("SELECT COUNT(*) FROM categorie WHERE foyer_id = ?", foyerId)).isZero();
        assertThat(count("SELECT COUNT(*) FROM membre WHERE foyer_id = ?", foyerId)).isZero();
        assertThat(count("SELECT COUNT(*) FROM compte WHERE foyer_id = ?", foyerId)).isZero();
        assertThat(count("SELECT COUNT(*) FROM actif WHERE foyer_id = ?", foyerId)).isZero();
        assertThat(count("SELECT COUNT(*) FROM taux_change WHERE foyer_id = ?", foyerId)).isZero();
        assertThat(count("SELECT COUNT(*) FROM poste p JOIN scenario s ON s.id = p.scenario_id WHERE s.foyer_id = ?", foyerId)).isZero();
        assertThat(count("SELECT COUNT(*) FROM objectif o JOIN scenario s ON s.id = o.scenario_id WHERE s.foyer_id = ?", foyerId)).isZero();
        assertThat(count("SELECT COUNT(*) FROM repartition_defaut rd JOIN scenario s ON s.id = rd.scenario_id WHERE s.foyer_id = ?", foyerId)).isZero();
        assertThat(count("SELECT COUNT(*) FROM repartition_periode rp JOIN scenario s ON s.id = rp.scenario_id WHERE s.foyer_id = ?", foyerId)).isZero();
        assertThat(count("SELECT COUNT(*) FROM repartition_poste rp JOIN poste p ON p.id = rp.poste_id JOIN scenario s ON s.id = p.scenario_id WHERE s.foyer_id = ?", foyerId)).isZero();
        assertThat(count("SELECT COUNT(*) FROM ventilation_compte vc JOIN poste p ON p.id = vc.poste_id JOIN scenario s ON s.id = p.scenario_id WHERE s.foyer_id = ?", foyerId)).isZero();

        String foyersBody = client.get()
                .uri("/api/foyers")
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .body(String.class);

        assertThat(foyersBody).isNotNull();
        assertThat(foyersBody).doesNotContain(foyerId);
    }

    @Test
    @DisplayName("Suppression de foyer inter-foyers renvoie 403")
    void supprimerFoyer_interFoyers_renvoie403() {
        String tokenA = creerEtLogin("foyer_del_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A");

        String tokenB = creerEtLogin("foyer_del_b@test.ch");
        creerFoyer(tokenB, "Foyer B");

        assertThatThrownBy(() -> client.delete()
                .uri("/api/foyers/" + foyerAId)
                .header("Authorization", "Bearer " + tokenB)
                .retrieve()
                .toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    private String creerEtLogin(String email) {
        try {
            client.post().uri("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(new RegisterRequest(email, "password123", "Test User")))
                    .retrieve().toBodilessEntity();
        } catch (HttpClientErrorException.Conflict ignored) {
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return login(email);
    }

    private String login(String email) {
        try {
            String body = client.post().uri("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(new LoginRequest(email, "password123")))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("accessToken").asText();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private String creerFoyer(String token, String nom) {
        Map<String, Object> payload = Map.of(
                "nom", nom,
                "deviseBase", "CHF",
                "membres", List.of(Map.of("nom", "Membre 1", "couleur", "#6366F1"))
        );
        try {
            String body = client.post().uri("/api/foyers")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
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
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private String premierScenarioId(String token, String foyerId) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios")
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            JsonNode scenarios = MAPPER.readTree(body);
            return scenarios.get(0).get("id").asText();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private String premierMembreId(String token, String foyerId) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/membres")
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            JsonNode membres = MAPPER.readTree(body);
            return membres.get(0).get("id").asText();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private String creerCompte(String token, String foyerId, String membreId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("libelle", "Compte purge");
        payload.put("soldeInitial", 1200);
        payload.put("devise", "CHF");
        payload.put("ordre", 10);
        payload.put("membreIds", List.of(membreId));
        try {
            String body = client.post()
                    .uri("/api/foyers/" + foyerId + "/comptes")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private String creerActif(String token, String foyerId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("libelle", "Actif purge");
        payload.put("typeActif", "AUTRE");
        payload.put("soldeInitial", 5000);
        payload.put("devise", "CHF");
        payload.put("tauxCroissanceAnnuel", 0);
        payload.put("ordre", 1);
        try {
            String body = client.post()
                    .uri("/api/foyers/" + foyerId + "/actifs")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private String creerObjectif(String token, String foyerId, String scenarioId, String categorieId, String compteId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("libelle", "Objectif purge");
        payload.put("categorieProjetId", categorieId);
        payload.put("montantCible", 3000);
        payload.put("compteId", compteId);
        payload.put("actifId", null);
        try {
            String body = client.post()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/objectifs")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private String creerPoste(String token, String foyerId, String scenarioId, String catId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "CHARGE");
        payload.put("description", "Poste lié à une catégorie");
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
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private long count(String sql, String foyerId) {
        Long count = jdbcTemplate.queryForObject(sql, Long.class, java.util.UUID.fromString(foyerId));
        return count == null ? -1 : count;
    }
}

