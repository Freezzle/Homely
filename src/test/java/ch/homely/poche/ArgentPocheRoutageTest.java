package ch.homely.poche;

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
 * Tests d'intégration REST — <b>routage de comptes</b> de l'argent de poche (V29).
 *
 * <p>Modèle vérifié : chaque politique/allocation porte un compte <b>pivot</b> (la
 * source qui finance) et N <b>contreparties</b> (les comptes de poche crédités), au
 * sens REVENU — le pivot alimente les contreparties.</p>
 *
 * <p>Couvre : éclatement multi-comptes, validation de la somme des quotes-parts,
 * refus des doublons de compte, résolution automatique du pivot, et accès croisé
 * multi-tenant sur le pivot comme sur les contreparties.</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class ArgentPocheRoutageTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @LocalServerPort
    int port;

    private RestClient client;

    @BeforeEach
    void setUp() {
        client = RestClient.builder().baseUrl("http://localhost:" + port).build();
    }

    @Test
    @DisplayName("Politique : le versement s'éclate sur deux comptes de poche (75/25)")
    void politique_routage_deux_comptes() {
        Contexte c = setup("routage_2c@test.ch");
        String comptePerso = creerCompte(c, "Perso");
        String compteLoisirs = creerCompte(c, "Loisirs");

        JsonNode p = creerPolitique(c, Map.of(
                "membreId", c.membreId,
                "comptePivotId", c.compteSalaire,
                "routage", List.of(
                        Map.of("compteId", comptePerso, "quotePart", 0.75),
                        Map.of("compteId", compteLoisirs, "quotePart", 0.25)),
                "nom", "Poche éclatée",
                "dateDebut", "2026-01",
                "mode", "FIXE",
                "montantFixe", 400));

        assertThat(p.get("comptePivotId").asText()).isEqualTo(c.compteSalaire);
        assertThat(p.get("routage")).hasSize(2);

        // Les quotes-parts sont persistées telles quelles et rattachées au bon compte.
        Map<String, Double> parts = new HashMap<>();
        p.get("routage").forEach(l -> parts.put(l.get("compteId").asText(), l.get("quotePart").asDouble()));
        assertThat(parts).containsEntry(comptePerso, 0.75).containsEntry(compteLoisirs, 0.25);
    }

    @Test
    @DisplayName("Politique : une somme de quotes-parts ≠ 1 est refusée (422 ROUTAGE_INVALIDE)")
    void politique_routage_somme_invalide_rejete() {
        Contexte c = setup("routage_somme@test.ch");
        String autre = creerCompte(c, "Autre");

        assertThatThrownBy(() -> creerPolitique(c, Map.of(
                "membreId", c.membreId,
                "routage", List.of(
                        Map.of("compteId", c.compteSalaire, "quotePart", 0.5),
                        Map.of("compteId", autre, "quotePart", 0.2)),
                "nom", "Somme KO",
                "dateDebut", "2026-01",
                "mode", "FIXE",
                "montantFixe", 100)))
                .isInstanceOf(HttpClientErrorException.class)
                .satisfies(e -> {
                    HttpClientErrorException ex = (HttpClientErrorException) e;
                    assertThat(ex.getStatusCode().value()).isEqualTo(422);
                    assertThat(ex.getResponseBodyAsString()).contains("ROUTAGE_INVALIDE");
                });
    }

    @Test
    @DisplayName("Politique : deux lignes sur le même compte sont refusées (422)")
    void politique_routage_compte_duplique_rejete() {
        Contexte c = setup("routage_dup@test.ch");

        assertThatThrownBy(() -> creerPolitique(c, Map.of(
                "membreId", c.membreId,
                "routage", List.of(
                        Map.of("compteId", c.compteSalaire, "quotePart", 0.5),
                        Map.of("compteId", c.compteSalaire, "quotePart", 0.5)),
                "nom", "Doublon",
                "dateDebut", "2026-01",
                "mode", "FIXE",
                "montantFixe", 100)))
                .isInstanceOf(HttpClientErrorException.class)
                .satisfies(e -> assertThat(((HttpClientErrorException) e).getResponseBodyAsString())
                        .contains("ROUTAGE_INVALIDE"));
    }

    @Test
    @DisplayName("Politique : un routage vide est refusé (400, @NotEmpty)")
    void politique_routage_vide_rejete() {
        Contexte c = setup("routage_vide@test.ch");

        assertThatThrownBy(() -> creerPolitique(c, Map.of(
                "membreId", c.membreId,
                "routage", List.of(),
                "nom", "Vide",
                "dateDebut", "2026-01",
                "mode", "FIXE",
                "montantFixe", 100)))
                .isInstanceOf(HttpClientErrorException.class)
                .satisfies(e -> assertThat(((HttpClientErrorException) e).getStatusCode())
                        .isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("Pivot omis : résolu côté serveur, un poste a toujours une source")
    void pivot_omis_est_resolu_par_le_serveur() {
        Contexte c = setup("pivot_auto@test.ch");

        JsonNode p = creerPolitique(c, Map.of(
                "membreId", c.membreId,
                "routage", List.of(Map.of("compteId", c.compteSalaire)),
                "nom", "Sans pivot",
                "dateDebut", "2026-01",
                "mode", "FIXE",
                "montantFixe", 200));

        assertThat(p.get("comptePivotId").isNull()).isFalse();
        // Aucun compte primaire n'est défini ici : repli sur la contrepartie → auto-routage.
        assertThat(p.get("comptePivotId").asText()).isEqualTo(c.compteSalaire);
    }

    @Test
    @DisplayName("quotePart omise sur une ligne unique : vaut 1 par défaut")
    void quote_part_omise_vaut_un() {
        Contexte c = setup("quote_defaut@test.ch");

        JsonNode p = creerPolitique(c, Map.of(
                "membreId", c.membreId,
                "routage", List.of(Map.of("compteId", c.compteSalaire)),
                "nom", "Implicite",
                "dateDebut", "2026-01",
                "mode", "FIXE",
                "montantFixe", 200));

        assertThat(p.get("routage").get(0).get("quotePart").asDouble()).isEqualTo(1.0);
    }

    @Test
    @DisplayName("Allocation : routage multi-comptes accepté et relu à l'identique")
    void allocation_routage_deux_comptes() {
        Contexte c = setup("alloc_routage@test.ch");
        String bonus = creerCompte(c, "Bonus");

        JsonNode a = creerAllocation(c, Map.of(
                "membreId", c.membreId,
                "comptePivotId", c.compteSalaire,
                "routage", List.of(
                        Map.of("compteId", c.compteSalaire, "quotePart", 0.6),
                        Map.of("compteId", bonus, "quotePart", 0.4)),
                "mois", "2026-03",
                "montant", 300));

        assertThat(a.get("comptePivotId").asText()).isEqualTo(c.compteSalaire);
        assertThat(a.get("routage")).hasSize(2);
    }

    @Test
    @DisplayName("Multi-tenant : un compte pivot d'un autre foyer est refusé")
    void pivot_autre_foyer_refuse() {
        Contexte a = setup("tenant_a@test.ch");
        Contexte b = setup("tenant_b@test.ch");

        assertThatThrownBy(() -> creerPolitique(a, Map.of(
                "membreId", a.membreId,
                "comptePivotId", b.compteSalaire,   // compte du foyer B
                "routage", List.of(Map.of("compteId", a.compteSalaire)),
                "nom", "Pivot volé",
                "dateDebut", "2026-01",
                "mode", "FIXE",
                "montantFixe", 100)))
                .isInstanceOf(HttpClientErrorException.class)
                .satisfies(e -> assertThat(((HttpClientErrorException) e).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("Multi-tenant : une contrepartie d'un autre foyer est refusée")
    void contrepartie_autre_foyer_refusee() {
        Contexte a = setup("tenant_c@test.ch");
        Contexte b = setup("tenant_d@test.ch");

        assertThatThrownBy(() -> creerPolitique(a, Map.of(
                "membreId", a.membreId,
                "comptePivotId", a.compteSalaire,
                "routage", List.of(Map.of("compteId", b.compteSalaire)),  // compte du foyer B
                "nom", "Contrepartie volée",
                "dateDebut", "2026-01",
                "mode", "FIXE",
                "montantFixe", 100)))
                .isInstanceOf(HttpClientErrorException.class)
                .satisfies(e -> assertThat(((HttpClientErrorException) e).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("Modification : réduire le routage à un seul compte ne viole pas l'unicité")
    void modifier_routage_reduit_sans_conflit_unicite() {
        Contexte c = setup("routage_modif@test.ch");
        String secondaire = creerCompte(c, "Secondaire");

        JsonNode p = creerPolitique(c, Map.of(
                "membreId", c.membreId,
                "comptePivotId", c.compteSalaire,
                "routage", List.of(
                        Map.of("compteId", c.compteSalaire, "quotePart", 0.5),
                        Map.of("compteId", secondaire, "quotePart", 0.5)),
                "nom", "À réduire",
                "dateDebut", "2026-01",
                "mode", "FIXE",
                "montantFixe", 200));

        // Le compte conservé est réutilisé : la ligne doit être mise à jour, pas
        // supprimée puis réinsérée (uq_routage_politique_poche).
        JsonNode modifiee = modifierPolitique(c, p.get("id").asText(), Map.of(
                "membreId", c.membreId,
                "comptePivotId", c.compteSalaire,
                "routage", List.of(Map.of("compteId", c.compteSalaire, "quotePart", 1.0)),
                "nom", "Réduite",
                "dateDebut", "2026-01",
                "mode", "FIXE",
                "montantFixe", 200));

        assertThat(modifiee.get("routage")).hasSize(1);
        assertThat(modifiee.get("routage").get(0).get("compteId").asText()).isEqualTo(c.compteSalaire);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private record Contexte(String token, String foyerId, String membreId,
                            String compteSalaire, String scenarioId) {}

    private Contexte setup(String email) {
        String token = creerEtLogin(email);
        String foyerId = creerFoyer(token, "Foyer " + email);
        String membreId = premierMembreId(token, foyerId);
        Contexte sansCompte = new Contexte(token, foyerId, membreId, null, null);
        String compteId = creerCompte(sansCompte, "Salaire");
        String scenarioId = creerScenario(token, foyerId, List.of(membreId));
        return new Contexte(token, foyerId, membreId, compteId, scenarioId);
    }

    private String creerEtLogin(String email) {
        try {
            client.post().uri("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(new RegisterRequest(email, "password123", "Test User")))
                    .retrieve().toBodilessEntity();
        } catch (HttpClientErrorException.Conflict ignored) {
        } catch (Exception e) { throw new RuntimeException(e); }
        try {
            String body = client.post().uri("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(new LoginRequest(email, "password123")))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("accessToken").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String creerFoyer(String token, String nom) {
        Map<String, Object> payload = Map.of(
                "nom", nom, "deviseBase", "CHF",
                "membres", List.of(Map.of("nom", "Membre 1", "couleur", "#6366F1")));
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
            String body = client.get().uri("/api/foyers/" + foyerId + "/membres")
                    .header("Authorization", "Bearer " + token).retrieve().body(String.class);
            return MAPPER.readTree(body).get(0).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String creerCompte(Contexte c, String libelle) {
        Map<String, Object> payload = Map.of(
                "libelle", libelle, "soldeInitial", 0, "devise", "CHF",
                "membreIds", List.of(c.membreId));
        try {
            String body = client.post().uri("/api/foyers/" + c.foyerId + "/comptes")
                    .header("Authorization", "Bearer " + c.token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String creerScenario(String token, String foyerId, List<String> membreIds) {
        List<Map<String, Object>> repartitions = membreIds.stream()
                .map(id -> Map.<String, Object>of("membreId", id, "quotePart", 1.0 / membreIds.size()))
                .toList();
        Map<String, Object> payload = new HashMap<>();
        payload.put("nom", "Scénario Test");
        payload.put("anneeDepart", 2026);
        payload.put("horizonAnnees", 2);
        payload.put("tresorerieInitiale", 0);
        payload.put("repartitions", repartitions);
        try {
            String body = client.post().uri("/api/foyers/" + foyerId + "/scenarios")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private JsonNode creerPolitique(Contexte c, Map<String, Object> payload) {
        return post("/api/foyers/" + c.foyerId + "/scenarios/" + c.scenarioId
                + "/argent-poche/politiques", c.token, payload);
    }

    private JsonNode modifierPolitique(Contexte c, String id, Map<String, Object> payload) {
        String url = "/api/foyers/" + c.foyerId + "/scenarios/" + c.scenarioId
                + "/argent-poche/politiques/" + id;
        try {
            String body = client.put().uri(url).header("Authorization", "Bearer " + c.token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body);
        } catch (Exception e) {
            if (e instanceof HttpClientErrorException ex) throw ex;
            throw new RuntimeException(e);
        }
    }

    private JsonNode creerAllocation(Contexte c, Map<String, Object> payload) {
        return post("/api/foyers/" + c.foyerId + "/scenarios/" + c.scenarioId
                + "/argent-poche/allocations", c.token, payload);
    }

    private JsonNode post(String url, String token, Map<String, Object> payload) {
        try {
            String body = client.post().uri(url).header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body);
        } catch (Exception e) {
            if (e instanceof HttpClientErrorException ex) throw ex;
            throw new RuntimeException(e);
        }
    }
}
