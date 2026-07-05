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
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class MultiTenantSecurityTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @LocalServerPort int port;
    private static final ObjectMapper MAPPER = new ObjectMapper();
    RestClient client;

    @BeforeEach void setUp() {
        client = RestClient.builder().baseUrl("http://localhost:" + port).build();
    }

    @Test @DisplayName("T4.3 - Acces inter-foyers : 403")
    void accesCroiseRefuse() {
        String tokenA = creerUtilisateurEtLogin("alice_cross@test.ch", "password123");
        String foyerAId = creerFoyer(tokenA, "Foyer Alice");
        String tokenB = creerUtilisateurEtLogin("bob_cross@test.ch", "password123");
        assertThatThrownBy(() -> client.get().uri("/api/foyers/" + foyerAId)
            .header("Authorization", "Bearer " + tokenB).retrieve().toBodilessEntity())
            .isInstanceOfSatisfying(HttpClientErrorException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test @DisplayName("T4.3 - VIEWER bloque en ecriture (403)")
    void viewerBloqueEnEcriture() throws Exception {
        String tokenOwner = creerUtilisateurEtLogin("owner_viewer@test.ch", "password123");
        String foyerId = creerFoyer(tokenOwner, "Foyer Owner");
        creerUtilisateurEtLogin("viewer_block@test.ch", "password123");
        client.post().uri("/api/foyers/" + foyerId + "/acces").header("Authorization", "Bearer " + tokenOwner)
            .contentType(MediaType.APPLICATION_JSON)
            .body(MAPPER.writeValueAsString(Map.of("email", "viewer_block@test.ch", "role", "VIEWER")))
            .retrieve().toBodilessEntity();
        String tokenViewer = login("viewer_block@test.ch", "password123");
        assertThatThrownBy(() -> client.put().uri("/api/foyers/" + foyerId)
            .header("Authorization", "Bearer " + tokenViewer).contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("nom", "Modif interdite", "deviseBase", "CHF")).retrieve().toBodilessEntity())
            .isInstanceOfSatisfying(HttpClientErrorException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test @DisplayName("T4.3 - Sans token : 401")
    void sansTokenUnauthorized() {
        assertThatThrownBy(() -> client.get().uri("/api/foyers").retrieve().toBodilessEntity())
            .isInstanceOfSatisfying(HttpClientErrorException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    private String creerUtilisateurEtLogin(String email, String password) {
        try { client.post().uri("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
            .body(MAPPER.writeValueAsString(new RegisterRequest(email, password, "Test User")))
            .retrieve().toBodilessEntity();
        } catch (HttpClientErrorException.Conflict ignored) {
        } catch (Exception e) { throw new RuntimeException(e); }
        return login(email, password);
    }

    private String login(String email, String password) {
        try { String body = client.post().uri("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
            .body(MAPPER.writeValueAsString(new LoginRequest(email, password))).retrieve().body(String.class);
            return MAPPER.readTree(body).get("accessToken").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String creerFoyer(String token, String nom) {
        try { String body = client.post().uri("/api/foyers").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON)
            .body(MAPPER.writeValueAsString(Map.of("nom", nom, "deviseBase", "CHF")))
            .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
