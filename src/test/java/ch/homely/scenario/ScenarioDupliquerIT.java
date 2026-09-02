package ch.homely.scenario;

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

/**
 * Tests d'intégration pour la duplication profonde d'un scénario
 * (POST .../scenarios/{id}:dupliquer) : vérifie que postes (+ répartitions/
 * ventilations, chaîne de révision remappée), politiques et allocations
 * d'argent de poche sont bien copiés, de façon totalement indépendante du
 * scénario source.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class ScenarioDupliquerIT {

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
    @DisplayName("Dupliquer copie postes (+ répartitions/ventilations + chaîne de révision), " +
            "politiques et allocations d'argent de poche, indépendamment du scénario source")
    void dupliquer_copieProfondeComplete() throws Exception {
        String token = creerEtLogin("dupliquer_complet@test.ch");
        String foyerId = creerFoyer(token, "Foyer Dupliquer");
        String membreId = premierMembreId(token, foyerId);
        String compteId = creerCompte(token, foyerId, membreId, "Compte courant");
        String catId = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        String scenarioId = creerScenario(token, foyerId, membreId);

        // Poste simple avec répartition et ventilation
        String posteSimpleId = creerPoste(token, foyerId, scenarioId, catId, membreId, compteId,
                "2025-01-01", null, 1000);

        // Chaîne de révision : poste origine -> poste révisé (posteOrigineId)
        String origineId = creerPoste(token, foyerId, scenarioId, catId, membreId, compteId,
                "2024-01-01", null, 500);
        JsonNode revision = reviser(token, foyerId, scenarioId, origineId, 600, "2026-01-01");
        String posteRevise = revision.get("posteCree").get("id").asText();

        // Politique d'argent de poche
        creerPolitique(token, foyerId, scenarioId, membreId, compteId);

        // Allocation ponctuelle
        creerAllocation(token, foyerId, scenarioId, membreId, compteId);

        // ── Duplication ──────────────────────────────────────────────────
        JsonNode copie = dupliquer(token, foyerId, scenarioId);
        String copieId = copie.get("id").asText();

        assertThat(copieId).isNotEqualTo(scenarioId);
        assertThat(copie.get("nom").asText()).isEqualTo("Scénario Test (copie)");
        assertThat(copie.get("estReference").asBoolean()).isFalse();

        // Postes copiés (3 : simple, origine, révisé), avec mêmes valeurs mais nouveaux ids
        JsonNode postesCopie = listerPostes(token, foyerId, copieId);
        assertThat(postesCopie).hasSize(3);

        JsonNode simpleCopie = trouverPosteParMontant(postesCopie, 1000);
        assertThat(simpleCopie.get("id").asText()).isNotEqualTo(posteSimpleId);
        assertThat(simpleCopie.get("repartitions")).hasSize(1);
        assertThat(simpleCopie.get("repartitions").get(0).get("membreId").asText()).isEqualTo(membreId);
        assertThat(simpleCopie.get("ventilations")).hasSize(1);
        assertThat(simpleCopie.get("ventilations").get(0).get("compteId").asText()).isEqualTo(compteId);

        JsonNode origineCopie = trouverPosteParMontant(postesCopie, 500);
        JsonNode reviseCopie = postesCopie.get(indexAutreQue(postesCopie, simpleCopie.get("id").asText(),
                origineCopie.get("id").asText()));

        assertThat(origineCopie.get("id").asText()).isNotEqualTo(origineId);
        assertThat(reviseCopie.get("id").asText()).isNotEqualTo(posteRevise);
        // La chaîne de révision est remappée vers le poste copié, pas l'ancien scénario
        assertThat(reviseCopie.get("posteOrigineId").asText()).isEqualTo(origineCopie.get("id").asText());
        assertThat(reviseCopie.get("posteOrigineId").asText()).isNotEqualTo(origineId);

        // Politiques et allocations copiées
        JsonNode politiquesCopie = listerPolitiques(token, foyerId, copieId);
        assertThat(politiquesCopie).hasSize(1);
        assertThat(politiquesCopie.get(0).get("scenarioId").asText()).isEqualTo(copieId);
        assertThat(politiquesCopie.get(0).get("membreId").asText()).isEqualTo(membreId);

        JsonNode allocationsCopie = listerAllocations(token, foyerId, copieId);
        assertThat(allocationsCopie).hasSize(1);
        assertThat(allocationsCopie.get(0).get("scenarioId").asText()).isEqualTo(copieId);
        assertThat(allocationsCopie.get(0).get("montant").asDouble()).isEqualTo(75.0);

        // Le scénario source n'est pas affecté
        JsonNode postesSource = listerPostes(token, foyerId, scenarioId);
        assertThat(postesSource).hasSize(3);
        JsonNode politiquesSource = listerPolitiques(token, foyerId, scenarioId);
        assertThat(politiquesSource).hasSize(1);
        JsonNode allocationsSource = listerAllocations(token, foyerId, scenarioId);
        assertThat(allocationsSource).hasSize(1);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private int indexAutreQue(JsonNode postes, String id1, String id2) {
        for (int i = 0; i < postes.size(); i++) {
            String id = postes.get(i).get("id").asText();
            if (!id.equals(id1) && !id.equals(id2)) return i;
        }
        throw new AssertionError("Aucun poste restant trouvé");
    }

    private JsonNode trouverPosteParMontant(JsonNode postes, double montant) {
        for (JsonNode p : postes) {
            if (p.get("montant").asDouble() == montant) return p;
        }
        throw new AssertionError("Poste avec montant=" + montant + " introuvable");
    }

    private String creerEtLogin(String email) {
        try {
            client.post().uri("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(new RegisterRequest(email, "password123", "Test User")))
                    .retrieve().toBodilessEntity();
        } catch (Exception ignored) {
        }
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
                "libelle", libelle,
                "soldeInitial", 0,
                "devise", "CHF",
                "membreIds", List.of(membreId)
        );
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

    private String creerScenario(String token, String foyerId, String membreId) {
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
                               String membreId, String compteId, String debut, String fin, double montant) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "CHARGE");
        payload.put("description", "Poste test dupliquer");
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", 1);
        payload.put("debut", debut);
        payload.put("fin", fin);
        payload.put("mode", "MENSUALISE");
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", "EFFECTIF");
        payload.put("ordre", 1);
        // CUSTOM requis pour que les répartitions saisies soient effectivement persistées
        // (en mode AUTO/REVERSE_AUTO, req.repartitions() est ignoré par PosteService).
        payload.put("typeRepartition", "CUSTOM");
        payload.put("repartitions", List.of(Map.of("membreId", membreId, "quotePart", 1.0)));
        payload.put("ventilations", List.of(Map.of("membreId", membreId, "compteId", compteId)));
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
        try {
            String body = client.post()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes/" + posteId + "/reviser-montant")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private void creerPolitique(String token, String foyerId, String scenarioId, String membreId, String compteId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("membreId", membreId);
        payload.put("compteId", compteId);
        payload.put("nom", "Politique test");
        payload.put("dateDebut", "2025-01");
        payload.put("dateFin", null);
        payload.put("mode", "FIXE");
        payload.put("montantFixe", 100);
        try {
            client.post()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/argent-poche/politiques")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().toBodilessEntity();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private void creerAllocation(String token, String foyerId, String scenarioId, String membreId, String compteId) {
        Map<String, Object> payload = Map.of(
                "membreId", membreId,
                "compteId", compteId,
                "mois", "2025-06",
                "montant", 75,
                "raison", "Vacances"
        );
        try {
            client.post()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/argent-poche/allocations")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().toBodilessEntity();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private JsonNode dupliquer(String token, String foyerId, String scenarioId) {
        try {
            String body = client.post()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + ":dupliquer")
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private JsonNode listerPostes(String token, String foyerId, String scenarioId) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes")
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private JsonNode listerPolitiques(String token, String foyerId, String scenarioId) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/argent-poche/politiques")
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private JsonNode listerAllocations(String token, String foyerId, String scenarioId) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/argent-poche/allocations")
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
