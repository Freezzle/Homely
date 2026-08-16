package ch.homely.projection;

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

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Indicateur "Prorata des postes partagés" — Tests d'intégration pour les endpoints
 * {@code /projection/prorata-partage} et {@code /projection/prorata-partage-annuel} :
 * prorata moyen réellement appliqué (pondéré par montant) sur les postes CHARGE/RESERVE
 * partagés, comparé au prorata théorique selon le poids des revenus de chaque membre.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class ProrataPartageIT {

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
    @DisplayName("Prorata moyen appliqué pondéré par montant sur 2 postes partagés (CUSTOM 70/30 + AUTO 50/50)")
    void prorataMoyenApplique_pondereParMontant() throws Exception {
        String token = creerEtLogin("prorata_pondere@test.ch");
        String foyerId = creerFoyer2Membres(token, "Foyer Prorata Pondéré");
        String scenarioId = creerScenario2Membres(token, foyerId);
        List<String> membreIds = tousMembresIds(token, foyerId);
        String membre1 = membreIds.get(0);
        String membre2 = membreIds.get(1);

        String catCharge = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        // Poste 1 : 1000, réparti CUSTOM 70/30.
        creerPosteCustom(token, foyerId, scenarioId, catCharge, "CHARGE", 1000, membre1, "0.7", membre2, "0.3");
        // Poste 2 : 500, AUTO -> hérite de la période active du scénario (50/50).
        creerPoste(token, foyerId, scenarioId, catCharge, "CHARGE", 500, "EFFECTIF");

        List<JsonNode> resultat = prorataPartage(token, foyerId, scenarioId, 2025, 1);
        assertThat(resultat).hasSize(2);

        // (1000*0.7 + 500*0.5) / 1500 = 0.633333...
        JsonNode dtoMembre1 = parMembre(resultat, membre1);
        assertThat(dtoMembre1.get("aDesPostesPartages").asBoolean()).isTrue();
        assertThat(new BigDecimal(dtoMembre1.get("prorataMoyenApplique").asText()))
                .isEqualByComparingTo("0.633333");

        JsonNode dtoMembre2 = parMembre(resultat, membre2);
        assertThat(new BigDecimal(dtoMembre2.get("prorataMoyenApplique").asText()))
                .isEqualByComparingTo("0.366667");
    }

    @Test
    @DisplayName("Prorata théorique selon les revenus = poids des revenus de chaque membre dans le total du foyer")
    void prorataTheoriqueRevenu_poidsDesRevenus() throws Exception {
        String token = creerEtLogin("prorata_revenu@test.ch");
        String foyerId = creerFoyer2Membres(token, "Foyer Prorata Revenu");
        String scenarioId = creerScenario2Membres(token, foyerId);
        List<String> membreIds = tousMembresIds(token, foyerId);
        String membre1 = membreIds.get(0);
        String membre2 = membreIds.get(1);

        String catRevenu = creerCategorie(token, foyerId, "Salaire", "REVENU");
        String catCharge = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        // Revenus très différents : 6000 vs 2000 -> théorique 0.75 / 0.25.
        creerPosteCustom(token, foyerId, scenarioId, catRevenu, "REVENU", 6000, membre1, "1.0", membre2, "0.0");
        creerPosteCustom(token, foyerId, scenarioId, catRevenu, "REVENU", 2000, membre1, "0.0", membre2, "1.0");
        // Un seul poste partagé (AUTO 50/50), juste pour avoir aDesPostesPartages=true.
        creerPoste(token, foyerId, scenarioId, catCharge, "CHARGE", 1000, "EFFECTIF");

        List<JsonNode> resultat = prorataPartage(token, foyerId, scenarioId, 2025, 1);
        JsonNode dtoMembre1 = parMembre(resultat, membre1);
        JsonNode dtoMembre2 = parMembre(resultat, membre2);
        assertThat(new BigDecimal(dtoMembre1.get("prorataTheoriqueRevenu").asText()))
                .isEqualByComparingTo("0.750000");
        assertThat(new BigDecimal(dtoMembre2.get("prorataTheoriqueRevenu").asText()))
                .isEqualByComparingTo("0.250000");
        // Prorata appliqué (AUTO 50/50) reste 0.5, indépendant du prorata revenu.
        assertThat(new BigDecimal(dtoMembre1.get("prorataMoyenApplique").asText()))
                .isEqualByComparingTo("0.500000");
    }

    @Test
    @DisplayName("Poste personnel (CUSTOM à un seul membre) exclu du calcul du prorata appliqué")
    void postePersonnel_exclu() throws Exception {
        String token = creerEtLogin("prorata_personnel@test.ch");
        String foyerId = creerFoyer2Membres(token, "Foyer Prorata Personnel");
        String scenarioId = creerScenario2Membres(token, foyerId);
        List<String> membreIds = tousMembresIds(token, foyerId);
        String membre1 = membreIds.get(0);
        String membre2 = membreIds.get(1);

        String catCharge = creerCategorie(token, foyerId, "Loisirs", "CHARGE");
        // Poste personnel à membre1 (ne doit pas influencer le prorata appliqué).
        creerPosteCustom(token, foyerId, scenarioId, catCharge, "CHARGE", 5000, membre1, "1.0", membre2, "0.0");
        // Poste partagé AUTO 50/50 -> seul poste pris en compte.
        creerPoste(token, foyerId, scenarioId, catCharge, "CHARGE", 1000, "EFFECTIF");

        List<JsonNode> resultat = prorataPartage(token, foyerId, scenarioId, 2025, 1);
        JsonNode dtoMembre1 = parMembre(resultat, membre1);
        // Si le poste personnel de 5000 était inclus, le prorata serait proche de 1.0.
        assertThat(new BigDecimal(dtoMembre1.get("prorataMoyenApplique").asText()))
                .isEqualByComparingTo("0.500000");
    }

    @Test
    @DisplayName("Poste REVENU exclu du calcul (inclureProrataTheorique=false) n'influence pas le prorata théorique")
    void prorataTheoriqueRevenu_posteExclu() throws Exception {
        String token = creerEtLogin("prorata_revenu_exclu@test.ch");
        String foyerId = creerFoyer2Membres(token, "Foyer Prorata Revenu Exclu");
        String scenarioId = creerScenario2Membres(token, foyerId);
        List<String> membreIds = tousMembresIds(token, foyerId);
        String membre1 = membreIds.get(0);
        String membre2 = membreIds.get(1);

        String catRevenu = creerCategorie(token, foyerId, "Salaire", "REVENU");
        String catCharge = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        // Revenu "normal" 100% membre1, compté dans le prorata théorique.
        creerPosteCustom(token, foyerId, scenarioId, catRevenu, "REVENU", 1000, membre1, "1.0", membre2, "0.0");
        // Revenu 100% membre2, mais exclu du prorata théorique (ex. allocation ponctuelle) : ne doit
        // pas rééquilibrer le calcul malgré son montant élevé.
        creerPosteRevenuExclu(token, foyerId, scenarioId, catRevenu, 5000, membre2);
        // Un seul poste partagé, juste pour avoir aDesPostesPartages=true.
        creerPoste(token, foyerId, scenarioId, catCharge, "CHARGE", 1000, "EFFECTIF");

        List<JsonNode> resultat = prorataPartage(token, foyerId, scenarioId, 2025, 1);
        JsonNode dtoMembre1 = parMembre(resultat, membre1);
        JsonNode dtoMembre2 = parMembre(resultat, membre2);
        // Seul le poste de 1000 (100% membre1) compte -> théorique 1.0 / 0.0.
        assertThat(new BigDecimal(dtoMembre1.get("prorataTheoriqueRevenu").asText()))
                .isEqualByComparingTo("1.000000");
        assertThat(new BigDecimal(dtoMembre2.get("prorataTheoriqueRevenu").asText()))
                .isEqualByComparingTo("0.000000");
    }

    @Test
    @DisplayName("Foyer mono-membre : liste vide")
    void monoMembre_listeVide() throws Exception {
        String token = creerEtLogin("prorata_mono@test.ch");
        String foyerId = creerFoyer(token, "Foyer Prorata Mono");
        String scenarioId = creerScenario(token, foyerId);
        String catCharge = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        creerPoste(token, foyerId, scenarioId, catCharge, "CHARGE", 1000, "EFFECTIF");

        List<JsonNode> resultat = prorataPartage(token, foyerId, scenarioId, 2025, 1);
        assertThat(resultat).isEmpty();
    }

    @Test
    @DisplayName("Aucun poste partagé (tous personnels) : aDesPostesPartages=false pour tous, prorataMoyenApplique=null")
    void aucunPostePartage_flagFalse() throws Exception {
        String token = creerEtLogin("prorata_aucun@test.ch");
        String foyerId = creerFoyer2Membres(token, "Foyer Prorata Aucun Partagé");
        String scenarioId = creerScenario2Membres(token, foyerId);
        List<String> membreIds = tousMembresIds(token, foyerId);
        String membre1 = membreIds.get(0);
        String membre2 = membreIds.get(1);

        String catCharge = creerCategorie(token, foyerId, "Loisirs", "CHARGE");
        creerPosteCustom(token, foyerId, scenarioId, catCharge, "CHARGE", 1000, membre1, "1.0", membre2, "0.0");
        creerPosteCustom(token, foyerId, scenarioId, catCharge, "CHARGE", 500, membre2, "1.0", membre1, "0.0");

        List<JsonNode> resultat = prorataPartage(token, foyerId, scenarioId, 2025, 1);
        assertThat(resultat).hasSize(2);
        for (JsonNode dto : resultat) {
            assertThat(dto.get("aDesPostesPartages").asBoolean()).isFalse();
            assertThat(dto.get("prorataMoyenApplique").isNull()).isTrue();
        }
    }

    @Test
    @DisplayName("Variante annuelle : cumule les 12 mois")
    void varianteAnnuelle_cumule12Mois() throws Exception {
        String token = creerEtLogin("prorata_annuel@test.ch");
        String foyerId = creerFoyer2Membres(token, "Foyer Prorata Annuel");
        String scenarioId = creerScenario2Membres(token, foyerId);
        String catCharge = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        creerPoste(token, foyerId, scenarioId, catCharge, "CHARGE", 1000, "EFFECTIF");

        List<JsonNode> resultat = prorataPartageAnnuel(token, foyerId, scenarioId, 2025);
        assertThat(resultat).hasSize(2);
        assertThat(resultat.get(0).get("aDesPostesPartages").asBoolean()).isTrue();
    }

    @Test
    @DisplayName("Accès inter-foyers refusé (403)")
    void accesInterFoyersRefuse() {
        String tokenA = creerEtLogin("prorata_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Prorata");
        String scenarioId = creerScenario(tokenA, foyerAId);

        String tokenB = creerEtLogin("prorata_b@test.ch");
        creerFoyer(tokenB, "Foyer B Prorata");

        assertThatThrownBy(() -> client.get()
                .uri("/api/foyers/" + foyerAId + "/scenarios/" + scenarioId + "/projection/prorata-partage?annee=2025&mois=1")
                .header("Authorization", "Bearer " + tokenB)
                .retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private JsonNode parMembre(List<JsonNode> resultat, String membreId) {
        return resultat.stream().filter(e -> e.get("membreId").asText().equals(membreId))
                .findFirst().orElseThrow();
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

    private String creerFoyer2Membres(String token, String nom) {
        Map<String, Object> payload = Map.of(
                "nom", nom,
                "deviseBase", "CHF",
                "membres", List.of(
                        Map.of("nom", "Membre 1", "couleur", "#6366F1"),
                        Map.of("nom", "Membre 2", "couleur", "#F59E0B"))
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
        return tousMembresIds(token, foyerId).get(0);
    }

    private List<String> tousMembresIds(String token, String foyerId) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/membres")
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            JsonNode arr = MAPPER.readTree(body);
            List<String> ids = new java.util.ArrayList<>();
            arr.forEach(n -> ids.add(n.get("id").asText()));
            return ids;
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

    private String creerScenario2Membres(String token, String foyerId) {
        List<String> membreIds = tousMembresIds(token, foyerId);
        Map<String, Object> payload = Map.of(
                "nom", "Scénario Test 2 Membres",
                "anneeDepart", 2025,
                "horizonAnnees", 1,
                "tresorerieInitiale", 0,
                "repartitions", List.of(
                        Map.of("membreId", membreIds.get(0), "quotePart", 0.5),
                        Map.of("membreId", membreIds.get(1), "quotePart", 0.5))
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
                               String type, double montant, String nature) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("description", "Poste test prorata");
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", 1);
        payload.put("debut", "2025-01-01");
        payload.put("fin", null);
        payload.put("mode", "MENSUALISE");
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", nature);
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

    private String creerPosteCustom(String token, String foyerId, String scenarioId, String catId, String type,
                                     double montant, String membre1, String quotePart1,
                                     String membre2, String quotePart2) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("description", "Poste test prorata custom");
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", 1);
        payload.put("debut", "2025-01-01");
        payload.put("fin", null);
        payload.put("mode", "MENSUALISE");
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", "EFFECTIF");
        payload.put("typeRepartition", "CUSTOM");
        payload.put("ordre", 1);
        payload.put("repartitions", List.of(
                Map.of("membreId", membre1, "quotePart", quotePart1),
                Map.of("membreId", membre2, "quotePart", quotePart2)));
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

    /** Poste REVENU en CUSTOM 100% pour {@code membreId}, avec inclureProrataTheorique=false. */
    private String creerPosteRevenuExclu(String token, String foyerId, String scenarioId, String catId,
                                          double montant, String membreId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "REVENU");
        payload.put("description", "Poste revenu exclu du prorata théorique");
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", 1);
        payload.put("debut", "2025-01-01");
        payload.put("fin", null);
        payload.put("mode", "MENSUALISE");
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", "EFFECTIF");
        payload.put("typeRepartition", "CUSTOM");
        payload.put("ordre", 1);
        payload.put("repartitions", List.of(Map.of("membreId", membreId, "quotePart", "1.0")));
        payload.put("ventilations", List.of());
        payload.put("inclureProrataTheorique", false);
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

    private List<JsonNode> prorataPartage(String token, String foyerId, String scenarioId, int annee, int mois) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId
                            + "/projection/prorata-partage?annee=" + annee + "&mois=" + mois)
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            JsonNode arr = MAPPER.readTree(body);
            List<JsonNode> result = new java.util.ArrayList<>();
            arr.forEach(result::add);
            return result;
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private List<JsonNode> prorataPartageAnnuel(String token, String foyerId, String scenarioId, int annee) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId
                            + "/projection/prorata-partage-annuel?annee=" + annee)
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            JsonNode arr = MAPPER.readTree(body);
            List<JsonNode> result = new java.util.ArrayList<>();
            arr.forEach(result::add);
            return result;
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
