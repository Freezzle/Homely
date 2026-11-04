package ch.homely.poste;

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
 * API du <b>routage comptes</b> d'un poste : compte pivot (là où la transaction a lieu) et
 * contreparties au prorata. Couvre l'aller-retour REST, la validation des quotes-parts et
 * l'isolation multi-tenant du compte pivot.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class PosteRoutageCompteTest {

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
    @DisplayName("A3 — un membre peut router sa part sur plusieurs comptes (60/40)")
    void routageMultiComptesPourUnMembre() throws Exception {
        String token = creerEtLogin("routage_multi@test.ch");
        String foyerId = creerFoyer(token, "Foyer Routage Multi");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId);
        String compte1 = creerCompte(token, foyerId, membreId, "Compte 1");
        String compte2 = creerCompte(token, foyerId, membreId, "Compte 2");
        String compte3 = creerCompte(token, foyerId, membreId, "Compte 3");
        String catId = creerCategorie(token, foyerId, "Allocations", "REVENU");

        String posteId = creerPoste(token, foyerId, scenarioId, catId, compte1, List.of(
                Map.of("membreId", membreId, "compteId", compte2, "quotePart", 0.6),
                Map.of("membreId", membreId, "compteId", compte3, "quotePart", 0.4)));

        JsonNode poste = lirePoste(token, foyerId, scenarioId, posteId);
        assertThat(poste.get("comptePivotId").asText()).isEqualTo(compte1);
        assertThat(poste.get("ventilations")).hasSize(2);
        assertThat(quotePartVers(poste, compte2)).isEqualTo(0.6);
        assertThat(quotePartVers(poste, compte3)).isEqualTo(0.4);
    }

    @Test
    @DisplayName("Quotes-parts de routage ne sommant pas à 1 pour un membre : rejeté (ROUTAGE_INVALIDE)")
    void routageSommeInvalideRejete() throws Exception {
        String token = creerEtLogin("routage_somme@test.ch");
        String foyerId = creerFoyer(token, "Foyer Routage Somme");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId);
        String compte1 = creerCompte(token, foyerId, membreId, "Compte 1");
        String compte2 = creerCompte(token, foyerId, membreId, "Compte 2");
        String catId = creerCategorie(token, foyerId, "Loyer", "CHARGE");

        assertThatThrownBy(() -> creerPoste(token, foyerId, scenarioId, catId, compte1, List.of(
                Map.of("membreId", membreId, "compteId", compte2, "quotePart", 0.5))))
                .cause()
                .isInstanceOfSatisfying(HttpClientErrorException.class, ex -> {
                    assertThat(ex.getStatusCode().value()).isEqualTo(422);
                    assertThat(ex.getResponseBodyAsString()).contains("ROUTAGE_INVALIDE");
                });
    }

    @Test
    @DisplayName("Multi-tenant : un compte pivot d'un autre foyer est refusé (404)")
    void comptePivotDUnAutreFoyerRefuse() throws Exception {
        String tokenA = creerEtLogin("routage_tenant_a@test.ch");
        String foyerA = creerFoyer(tokenA, "Foyer A");
        String membreA = premierMembreId(tokenA, foyerA);
        String scenarioA = creerScenario(tokenA, foyerA);
        String catA = creerCategorie(tokenA, foyerA, "Loyer", "CHARGE");

        String tokenB = creerEtLogin("routage_tenant_b@test.ch");
        String foyerB = creerFoyer(tokenB, "Foyer B");
        String membreB = premierMembreId(tokenB, foyerB);
        String compteB = creerCompte(tokenB, foyerB, membreB, "Compte de B");

        assertThatThrownBy(() -> creerPoste(tokenA, foyerA, scenarioA, catA, compteB, List.of()))
                .cause()
                .isInstanceOfSatisfying(HttpClientErrorException.class, ex ->
                        assertThat(ex.getStatusCode().value()).isEqualTo(404));

        // Et symétriquement, le compte de B ne doit pas devenir une contrepartie chez A.
        String compteA = creerCompte(tokenA, foyerA, membreA, "Compte de A");
        assertThatThrownBy(() -> creerPoste(tokenA, foyerA, scenarioA, catA, compteA, List.of(
                Map.of("membreId", membreA, "compteId", compteB, "quotePart", 1.0))))
                .cause()
                .isInstanceOfSatisfying(HttpClientErrorException.class, ex ->
                        assertThat(ex.getStatusCode().value()).isEqualTo(404));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private double quotePartVers(JsonNode poste, String compteId) {
        for (JsonNode v : poste.get("ventilations")) {
            if (v.get("compteId").asText().equals(compteId)) {
                return v.get("quotePart").asDouble();
            }
        }
        throw new AssertionError("Aucune ventilation vers le compte " + compteId);
    }

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

    private String creerCompte(String token, String foyerId, String membreId, String libelle) {
        Map<String, Object> payload = Map.of(
                "libelle", libelle, "type", "COURANT", "soldeInitial", 0,
                "devise", "CHF", "actif", true, "membreIds", List.of(membreId));
        try {
            String body = client.post()
                    .uri("/api/foyers/" + foyerId + "/comptes")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
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
                              String comptePivotId, List<Map<String, Object>> ventilations) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "CHARGE");
        payload.put("description", "Poste routage");
        payload.put("categorieId", catId);
        payload.put("montant", 100);
        payload.put("periodiciteMois", 1);
        payload.put("debut", "2025-01-01");
        payload.put("fin", null);
        payload.put("mode", "MENSUALISE");
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", "EFFECTIF");
        payload.put("ordre", 1);
        payload.put("comptePivotId", comptePivotId);
        payload.put("repartitions", List.of());
        payload.put("ventilations", ventilations);
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

    private JsonNode lirePoste(String token, String foyerId, String scenarioId, String posteId) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes/" + posteId)
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
