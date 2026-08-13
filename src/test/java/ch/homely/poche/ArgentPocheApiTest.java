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
 * Tests d'intégration REST — argent de poche (PR3).
 *
 * <p>Couvre :
 * <ul>
 *   <li>CRUD nominal politiques et allocations</li>
 *   <li>Résolution avec priorité <b>allocation &gt; politique &gt; aucune</b></li>
 *   <li>Doublon d'allocation {@code (membre, mois)} → HTTP 409</li>
 *   <li>Chevauchement de politiques d'un même membre → HTTP 409</li>
 *   <li>Trous entre politiques → autorisés (résolution = 0 CHF sur les trous)</li>
 *   <li>Validation métier : mode FIXE sans montant, plafond &lt; socle → HTTP 422</li>
 *   <li>Accès inter-foyers refusé → HTTP 403 sur chaque endpoint sensible</li>
 * </ul>
 * </p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class ArgentPocheApiTest {

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

    // ── Politiques ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("POST /politiques (mode VARIABLE) : crée puis renvoie 201 + DTO")
    void creer_politique_variable_nominal() throws Exception {
        Contexte c = setupFoyerScenarioCompte("pol_var@test.ch");

        JsonNode politique = creerPolitique(c, Map.of(
                "membreId",    c.membreId,
                "compteId",    c.compteId,
                "nom",         "Poche 2026",
                "dateDebut",   "2026-01",
                "dateFin",     "2026-12",
                "mode",        "VARIABLE",
                "socle",       500,
                "pourcentage", 20,
                "plafond",     1000
        ));

        assertThat(politique.get("id").asText()).isNotBlank();
        assertThat(politique.get("mode").asText()).isEqualTo("VARIABLE");
        assertThat(politique.get("socle").asDouble()).isEqualTo(500.0);
        assertThat(politique.get("dateDebut").asText()).isEqualTo("2026-01");
    }

    @Test
    @DisplayName("POST /politiques (mode FIXE sans montantFixe) : 422")
    void creer_politique_fixe_sans_montant_renvoie_422() {
        Contexte c = setupFoyerScenarioCompte("pol_fixe_ko@test.ch");

        assertThatThrownBy(() -> creerPolitique(c, Map.of(
                "membreId",  c.membreId,
                "compteId",  c.compteId,
                "nom",       "Poche fixe KO",
                "dateDebut", "2026-01",
                "mode",      "FIXE"
        ))).isInstanceOfSatisfying(HttpClientErrorException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("POST /politiques (plafond < socle) : 422")
    void creer_politique_variable_plafond_inferieur_socle_renvoie_422() {
        Contexte c = setupFoyerScenarioCompte("pol_plafond_ko@test.ch");

        assertThatThrownBy(() -> creerPolitique(c, Map.of(
                "membreId",    c.membreId,
                "compteId",    c.compteId,
                "nom",         "Poche KO",
                "dateDebut",   "2026-01",
                "mode",        "VARIABLE",
                "socle",       500,
                "pourcentage", 20,
                "plafond",     300
        ))).isInstanceOfSatisfying(HttpClientErrorException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));
    }

    @Test
    @DisplayName("POST /politiques : chevauchement même membre → 409")
    void creer_politique_chevauchement_renvoie_409() throws Exception {
        Contexte c = setupFoyerScenarioCompte("pol_chevauche@test.ch");

        creerPolitique(c, Map.of(
                "membreId",    c.membreId,
                "compteId",    c.compteId,
                "nom",         "Politique 1",
                "dateDebut",   "2026-01",
                "dateFin",     "2026-06",
                "mode",        "FIXE",
                "montantFixe", 250
        ));

        assertThatThrownBy(() -> creerPolitique(c, Map.of(
                "membreId",    c.membreId,
                "compteId",    c.compteId,
                "nom",         "Politique 2 qui chevauche",
                "dateDebut",   "2026-05",
                "dateFin",     "2026-12",
                "mode",        "FIXE",
                "montantFixe", 300
        ))).isInstanceOfSatisfying(HttpClientErrorException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("Politiques adjacentes non chevauchantes : autorisées")
    void politiques_adjacentes_autorisees() throws Exception {
        Contexte c = setupFoyerScenarioCompte("pol_adjacentes@test.ch");

        creerPolitique(c, Map.of(
                "membreId", c.membreId, "compteId", c.compteId,
                "nom", "P1", "dateDebut", "2026-01", "dateFin", "2026-06",
                "mode", "FIXE", "montantFixe", 100));

        JsonNode p2 = creerPolitique(c, Map.of(
                "membreId", c.membreId, "compteId", c.compteId,
                "nom", "P2", "dateDebut", "2026-07", "dateFin", "2026-12",
                "mode", "FIXE", "montantFixe", 200));
        assertThat(p2.get("id").asText()).isNotBlank();
    }

    @Test
    @DisplayName("PUT /politiques : chevauchement autorise si on modifie la MÊME politique")
    void modifier_politique_meme_id_ne_declenche_pas_chevauchement() throws Exception {
        Contexte c = setupFoyerScenarioCompte("pol_modif@test.ch");
        JsonNode p = creerPolitique(c, Map.of(
                "membreId", c.membreId, "compteId", c.compteId,
                "nom", "P", "dateDebut", "2026-01", "dateFin", "2026-06",
                "mode", "FIXE", "montantFixe", 100));

        String url = "/api/foyers/" + c.foyerId + "/scenarios/" + c.scenarioId
                + "/argent-poche/politiques/" + p.get("id").asText();
        Map<String, Object> update = Map.of(
                "membreId", c.membreId, "compteId", c.compteId,
                "nom", "P v2", "dateDebut", "2026-02", "dateFin", "2026-08",
                "mode", "FIXE", "montantFixe", 150);
        try {
            String body = client.put().uri(url).header("Authorization", "Bearer " + c.token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(update))
                    .retrieve().body(String.class);
            JsonNode retour = MAPPER.readTree(body);
            assertThat(retour.get("montantFixe").asDouble()).isEqualTo(150.0);
            assertThat(retour.get("dateFin").asText()).isEqualTo("2026-08");
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    // ── Allocations ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("POST /allocations : nominal + doublon renvoie 409")
    void creer_allocation_doublon_renvoie_409() throws Exception {
        Contexte c = setupFoyerScenarioCompte("alloc_doublon@test.ch");

        creerAllocation(c, Map.of(
                "membreId", c.membreId, "compteId", c.compteId,
                "mois", "2026-07", "montant", 200, "raison", "Vacances"));

        assertThatThrownBy(() -> creerAllocation(c, Map.of(
                "membreId", c.membreId, "compteId", c.compteId,
                "mois", "2026-07", "montant", 999, "raison", "Duplicata"
        ))).isInstanceOfSatisfying(HttpClientErrorException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    // ── Résolution ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /resolution : priorité allocation > politique > aucune")
    void resolution_respecte_la_priorite() throws Exception {
        Contexte c = setupFoyerScenarioCompte("resol@test.ch");

        // Politique FIXE 300 CHF/mois toute l'année 2026
        creerPolitique(c, Map.of(
                "membreId", c.membreId, "compteId", c.compteId,
                "nom", "Poche 2026", "dateDebut", "2026-01", "dateFin", "2026-12",
                "mode", "FIXE", "montantFixe", 300));

        // Allocation ponctuelle pour juillet 2026 : 200 CHF (remplace les 300 de la politique)
        creerAllocation(c, Map.of(
                "membreId", c.membreId, "compteId", c.compteId,
                "mois", "2026-07", "montant", 200));

        // Juillet 2026 → allocation
        JsonNode juillet = resolution(c, "2026-07");
        assertThat(juillet.get("source").asText()).isEqualTo("ALLOCATION");
        assertThat(juillet.get("montant").asDouble()).isEqualTo(200.0);

        // Mars 2026 → politique (pas d'allocation)
        JsonNode mars = resolution(c, "2026-03");
        assertThat(mars.get("source").asText()).isEqualTo("POLITIQUE");
        assertThat(mars.get("montant").asDouble()).isEqualTo(300.0);

        // Janvier 2027 → hors période politique → aucune
        JsonNode hors = resolution(c, "2027-01");
        assertThat(hors.get("source").asText()).isEqualTo("AUCUNE");
        assertThat(hors.get("montant").asDouble()).isEqualTo(0.0);
    }

    // ── Accès croisé multi-tenant ───────────────────────────────────────────

    @Test
    @DisplayName("Foyer B ne peut ni lister ni créer ni lire une politique du foyer A")
    void acces_croise_politique_renvoie_403() throws Exception {
        Contexte cA = setupFoyerScenarioCompte("cross_a@test.ch");
        JsonNode p = creerPolitique(cA, Map.of(
                "membreId", cA.membreId, "compteId", cA.compteId,
                "nom", "P foyer A", "dateDebut", "2026-01",
                "mode", "FIXE", "montantFixe", 100));
        String politiqueAId = p.get("id").asText();

        // Foyer B : différent utilisateur, différent foyer
        String tokenB = creerEtLogin("cross_b@test.ch");
        creerFoyer(tokenB, "Foyer B");

        String urlListe = "/api/foyers/" + cA.foyerId + "/scenarios/" + cA.scenarioId
                + "/argent-poche/politiques";
        String urlDetail = urlListe + "/" + politiqueAId;

        assertThatThrownBy(() -> client.get().uri(urlListe)
                .header("Authorization", "Bearer " + tokenB).retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));

        assertThatThrownBy(() -> client.get().uri(urlDetail)
                .header("Authorization", "Bearer " + tokenB).retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));

        assertThatThrownBy(() -> client.delete().uri(urlDetail)
                .header("Authorization", "Bearer " + tokenB).retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("Foyer B ne peut pas accéder aux allocations du foyer A")
    void acces_croise_allocation_renvoie_403() throws Exception {
        Contexte cA = setupFoyerScenarioCompte("cross_alloc_a@test.ch");
        JsonNode a = creerAllocation(cA, Map.of(
                "membreId", cA.membreId, "compteId", cA.compteId,
                "mois", "2026-03", "montant", 150));
        String allocationAId = a.get("id").asText();

        String tokenB = creerEtLogin("cross_alloc_b@test.ch");
        creerFoyer(tokenB, "Foyer B");

        String url = "/api/foyers/" + cA.foyerId + "/scenarios/" + cA.scenarioId
                + "/argent-poche/allocations/" + allocationAId;

        assertThatThrownBy(() -> client.get().uri(url)
                .header("Authorization", "Bearer " + tokenB).retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("Foyer B ne peut pas résoudre le montant du foyer A")
    void acces_croise_resolution_renvoie_403() throws Exception {
        Contexte cA = setupFoyerScenarioCompte("cross_resol_a@test.ch");
        String tokenB = creerEtLogin("cross_resol_b@test.ch");
        creerFoyer(tokenB, "Foyer B");

        String url = "/api/foyers/" + cA.foyerId + "/scenarios/" + cA.scenarioId
                + "/argent-poche/resolution?membreId=" + cA.membreId + "&mois=2026-01";

        assertThatThrownBy(() -> client.get().uri(url)
                .header("Authorization", "Bearer " + tokenB).retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("GET /resolution-annee : retourne 12 mois cohérents avec la politique")
    void resolution_annee_couvre_12_mois() throws Exception {
        Contexte c = setupFoyerScenarioCompte("resol_annee@test.ch");

        creerPolitique(c, Map.of(
                "membreId", c.membreId, "compteId", c.compteId,
                "nom", "Poche 2026", "dateDebut", "2026-01", "dateFin", "2026-12",
                "mode", "FIXE", "montantFixe", 300));

        creerAllocation(c, Map.of(
                "membreId", c.membreId, "compteId", c.compteId,
                "mois", "2026-07", "montant", 200));

        String url = "/api/foyers/" + c.foyerId + "/scenarios/" + c.scenarioId
                + "/argent-poche/resolution-annee?membreId=" + c.membreId + "&annee=2026";
        JsonNode arr;
        try {
            String body = client.get().uri(url).header("Authorization", "Bearer " + c.token)
                    .retrieve().body(String.class);
            arr = MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }

        assertThat(arr.size()).isEqualTo(12);
        assertThat(arr.get(6).get("source").asText()).isEqualTo("ALLOCATION");
        assertThat(arr.get(6).get("montant").asDouble()).isEqualTo(200.0);
        assertThat(arr.get(0).get("source").asText()).isEqualTo("POLITIQUE");
        assertThat(arr.get(0).get("montant").asDouble()).isEqualTo(300.0);
        assertThat(arr.get(11).get("montant").asDouble()).isEqualTo(300.0);
    }

    @Test
    @DisplayName("GET /resolution-annee : accès croisé foyer B → 403")
    void resolution_annee_acces_croise_renvoie_403() {
        Contexte cA = setupFoyerScenarioCompte("resol_annee_a@test.ch");
        String tokenB = creerEtLogin("resol_annee_b@test.ch");
        creerFoyer(tokenB, "Foyer B");

        String url = "/api/foyers/" + cA.foyerId + "/scenarios/" + cA.scenarioId
                + "/argent-poche/resolution-annee?membreId=" + cA.membreId + "&annee=2026";

        assertThatThrownBy(() -> client.get().uri(url)
                .header("Authorization", "Bearer " + tokenB).retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    // ── PR6 : rav-brut & resolution-foyer-annee ─────────────────────────────

    @Test
    @DisplayName("GET /rav-brut : 12 mois, indépendant de toute politique/allocation persistée")
    void rav_brut_annee_ignore_politiques_et_allocations() throws Exception {
        Contexte c = setupFoyerScenarioCompte("rav_brut@test.ch");

        JsonNode ravAvant = getJson(
                "/api/foyers/" + c.foyerId + "/scenarios/" + c.scenarioId
                        + "/argent-poche/rav-brut?membreId=" + c.membreId + "&annee=2026",
                c.token);
        assertThat(ravAvant.size()).isEqualTo(12);
        double ravJanvierAvant = ravAvant.get(0).get("rav").asDouble();

        // Politique/allocation persistées : ne doivent PAS influencer le RàV brut,
        // seulement le montant "résolu" (endpoint /resolution-annee).
        creerPolitique(c, Map.of(
                "membreId", c.membreId, "compteId", c.compteId,
                "nom", "Poche 2026", "dateDebut", "2026-01", "dateFin", "2026-12",
                "mode", "FIXE", "montantFixe", 300));

        JsonNode ravApres = getJson(
                "/api/foyers/" + c.foyerId + "/scenarios/" + c.scenarioId
                        + "/argent-poche/rav-brut?membreId=" + c.membreId + "&annee=2026",
                c.token);
        assertThat(ravApres.get(0).get("mois").asInt()).isEqualTo(1);
        assertThat(ravApres.get(0).get("rav").asDouble()).isEqualTo(ravJanvierAvant);
    }

    @Test
    @DisplayName("GET /rav-brut : accès croisé foyer B → 403")
    void rav_brut_acces_croise_renvoie_403() {
        Contexte cA = setupFoyerScenarioCompte("rav_brut_a@test.ch");
        String tokenB = creerEtLogin("rav_brut_b@test.ch");
        creerFoyer(tokenB, "Foyer B");

        String url = "/api/foyers/" + cA.foyerId + "/scenarios/" + cA.scenarioId
                + "/argent-poche/rav-brut?membreId=" + cA.membreId + "&annee=2026";

        assertThatThrownBy(() -> client.get().uri(url)
                .header("Authorization", "Bearer " + tokenB).retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("GET /resolution-foyer-annee : somme des résolutions de tous les membres du foyer")
    void resolution_foyer_annee_agrege_tous_les_membres() throws Exception {
        Contexte c = setupFoyerScenarioDeuxMembres("resol_foyer@test.ch");

        creerPolitique(c, Map.of(
                "membreId", c.membreId, "compteId", c.compteId,
                "nom", "Poche membre 1", "dateDebut", "2026-01", "dateFin", "2026-12",
                "mode", "FIXE", "montantFixe", 300));
        creerPolitique(c, Map.of(
                "membreId", c.membreId2, "compteId", c.compteId,
                "nom", "Poche membre 2", "dateDebut", "2026-01", "dateFin", "2026-12",
                "mode", "FIXE", "montantFixe", 150));

        JsonNode arr = getJson(
                "/api/foyers/" + c.foyerId + "/scenarios/" + c.scenarioId
                        + "/argent-poche/resolution-foyer-annee?annee=2026",
                c.token);

        assertThat(arr.size()).isEqualTo(12);
        assertThat(arr.get(0).get("mois").asInt()).isEqualTo(1);
        assertThat(arr.get(0).get("total").asDouble()).isEqualTo(450.0);
        assertThat(arr.get(0).get("parMembre").size()).isEqualTo(2);
    }

    @Test
    @DisplayName("GET /resolution-foyer-annee : accès croisé foyer B → 403")
    void resolution_foyer_annee_acces_croise_renvoie_403() {
        Contexte cA = setupFoyerScenarioCompte("resol_foyer_a@test.ch");
        String tokenB = creerEtLogin("resol_foyer_b@test.ch");
        creerFoyer(tokenB, "Foyer B");

        String url = "/api/foyers/" + cA.foyerId + "/scenarios/" + cA.scenarioId
                + "/argent-poche/resolution-foyer-annee?annee=2026";

        assertThatThrownBy(() -> client.get().uri(url)
                .header("Authorization", "Bearer " + tokenB).retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** Contexte partagé — un utilisateur, un foyer avec un membre et un compte, un scénario.
     *  {@code membreId2} est {@code null} sauf pour les contextes à deux membres (PR6, agrégat foyer). */
    private record Contexte(String token, String foyerId, String membreId,
                            String compteId, String scenarioId, String membreId2) {}

    private Contexte setupFoyerScenarioCompte(String email) {
        String token = creerEtLogin(email);
        String foyerId = creerFoyer(token, "Foyer " + email);
        String membreId = premierMembreId(token, foyerId);
        String compteId = creerCompte(token, foyerId, membreId, "Compte poche");
        String scenarioId = creerScenario(token, foyerId, List.of(membreId));
        return new Contexte(token, foyerId, membreId, compteId, scenarioId, null);
    }

    /** Variante à deux membres — nécessaire pour tester l'agrégat foyer
     *  ({@code /resolution-foyer-annee}), qui somme les résolutions de tous les
     *  membres actifs du scénario. */
    private Contexte setupFoyerScenarioDeuxMembres(String email) {
        String token = creerEtLogin(email);
        String foyerId = creerFoyer(token, "Foyer " + email);
        String membreId = premierMembreId(token, foyerId);
        String membreId2 = creerMembre(token, foyerId, "Membre 2");
        String compteId = creerCompte(token, foyerId, membreId, "Compte poche");
        String scenarioId = creerScenario(token, foyerId, List.of(membreId, membreId2));
        return new Contexte(token, foyerId, membreId, compteId, scenarioId, membreId2);
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

    private String creerCompte(String token, String foyerId, String membreId, String libelle) {
        Map<String, Object> payload = Map.of(
                "libelle", libelle, "soldeInitial", 0, "devise", "CHF",
                "membreIds", List.of(membreId));
        try {
            String body = client.post().uri("/api/foyers/" + foyerId + "/comptes")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String creerMembre(String token, String foyerId, String nom) {
        Map<String, Object> payload = Map.of("nom", nom, "couleur", "#F59E0B");
        try {
            String body = client.post().uri("/api/foyers/" + foyerId + "/membres")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private String creerScenario(String token, String foyerId, List<String> membreIds) {
        double quotePart = 1.0 / membreIds.size();
        List<Map<String, Object>> repartitions = membreIds.stream()
                .map(id -> Map.<String, Object>of("membreId", id, "quotePart", quotePart))
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
        String url = "/api/foyers/" + c.foyerId + "/scenarios/" + c.scenarioId + "/argent-poche/politiques";
        try {
            String body = client.post().uri(url).header("Authorization", "Bearer " + c.token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body);
        } catch (Exception e) {
            if (e instanceof HttpClientErrorException) throw (HttpClientErrorException) e;
            throw new RuntimeException(e);
        }
    }

    private JsonNode creerAllocation(Contexte c, Map<String, Object> payload) {
        String url = "/api/foyers/" + c.foyerId + "/scenarios/" + c.scenarioId + "/argent-poche/allocations";
        try {
            String body = client.post().uri(url).header("Authorization", "Bearer " + c.token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body);
        } catch (Exception e) {
            if (e instanceof HttpClientErrorException) throw (HttpClientErrorException) e;
            throw new RuntimeException(e);
        }
    }

    private JsonNode resolution(Contexte c, String mois) {
        String url = "/api/foyers/" + c.foyerId + "/scenarios/" + c.scenarioId
                + "/argent-poche/resolution?membreId=" + c.membreId + "&mois=" + mois;
        try {
            String body = client.get().uri(url).header("Authorization", "Bearer " + c.token)
                    .retrieve().body(String.class);
            return MAPPER.readTree(body);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private JsonNode getJson(String url, String token) {
        try {
            String body = client.get().uri(url).header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            return MAPPER.readTree(body);
        } catch (Exception e) {
            if (e instanceof HttpClientErrorException) throw (HttpClientErrorException) e;
            throw new RuntimeException(e);
        }
    }
}
