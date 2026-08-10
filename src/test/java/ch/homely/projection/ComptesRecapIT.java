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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/**
 * Tests d'intégration pour les endpoints de récapitulatif mensuel par compte du dashboard
 * (GET .../projection/comptes-recap et .../projection/comptes-tresorerie).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class ComptesRecapIT {

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
    @DisplayName("Récap mensuel : virements = sorties planifiées, entrées = revenu échu, solde restant cohérent")
    void recapMensuelCoherent() throws Exception {
        String token = creerEtLogin("recap_ok@test.ch");
        String foyerId = creerFoyer(token, "Foyer Recap");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String compteId = creerCompte(token, foyerId, membreId, "Compte courant");

        String catRevenu = creerCategorie(token, foyerId, "Salaire", "REVENU");
        String catCharge = creerCategorie(token, foyerId, "Loyer", "CHARGE");

        // Revenu mensuel 5000, échu chaque mois (D=1)
        creerPoste(token, foyerId, scenarioId, catRevenu, "REVENU", "2025-01-01", null, 5000, 1, "MENSUALISE", membreId, compteId);
        // Charge annuelle 1200 (D=12) : mensualisée = 100/mois, échue en janvier (mois d'ancrage)
        creerPoste(token, foyerId, scenarioId, catCharge, "CHARGE", "2025-01-01", null, 1200, 12, "MENSUALISE", membreId, compteId);

        List<JsonNode> recap = comptesRecap(token, foyerId, scenarioId, 2025, 1, membreId);
        assertThat(recap).hasSize(1);
        JsonNode c = recap.get(0);
        assertThat(c.get("virementsEntrants").asDouble()).isCloseTo(100.0, within(0.01)); // sorties planifiées
        assertThat(c.get("entrees").asDouble()).isCloseTo(5000.0, within(0.01));
        assertThat(c.get("sortiesPlanifiees").asDouble()).isCloseTo(100.0, within(0.01));
        assertThat(c.get("sortiesEchues").asDouble()).isCloseTo(1200.0, within(0.01)); // échu en janvier (ancre)
        // soldeRestant = virements(100) + entrees(5000) - sortiesEchues(1200) = 3900
        assertThat(c.get("soldeRestant").asDouble()).isCloseTo(3900.0, within(0.01));
        assertThat(c.get("insuffisant").asBoolean()).isFalse();
        assertThat(c.get("montantManquant").asDouble()).isCloseTo(0.0, within(0.01));

        // Mois sans échéance (février) : sortiesEchues = 0 (la charge D=12 n'échoit qu'en janvier,
        // son mois d'ancrage) ; sortiesPlanifiees reste mensualisée (100), pas d'insuffisance.
        List<JsonNode> recapFevrier = comptesRecap(token, foyerId, scenarioId, 2025, 2, membreId);
        JsonNode cFevrier = recapFevrier.get(0);
        assertThat(cFevrier.get("sortiesEchues").asDouble()).isCloseTo(0.0, within(0.01));
        assertThat(cFevrier.get("sortiesPlanifiees").asDouble()).isCloseTo(100.0, within(0.01));
        assertThat(cFevrier.get("insuffisant").asBoolean()).isFalse();
    }

    @Test
    @DisplayName("Insuffisance détectée quand les sorties échues dépassent virements + entrées")
    void insuffisanceDetectee() throws Exception {
        String token = creerEtLogin("recap_insuffisant@test.ch");
        String foyerId = creerFoyer(token, "Foyer Insuffisant");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String compteId = creerCompte(token, foyerId, membreId, "Compte épargne");

        String catRevenu = creerCategorie(token, foyerId, "Petit revenu", "REVENU");
        String catReserve = creerCategorie(token, foyerId, "3e pilier", "RESERVE");

        // Revenu faible 100/mois (échu chaque mois)
        creerPoste(token, foyerId, scenarioId, catRevenu, "REVENU", "2025-01-01", null, 100, 1, "MENSUALISE", membreId, compteId);
        // Réserve annuelle 1200 (D=12, ancre janvier) : mensualisée = 100/mois, mais échue en
        // pleine à 1200 CHF en janvier -> sorties échues (1200) très supérieures à
        // virements(100, mensualisé) + entrées(100) ce mois-là.
        creerPoste(token, foyerId, scenarioId, catReserve, "RESERVE", "2025-01-01", null, 1200, 12, "MENSUALISE", membreId, compteId);

        List<JsonNode> recap = comptesRecap(token, foyerId, scenarioId, 2025, 1, membreId);
        JsonNode c = recap.get(0);
        assertThat(c.get("virementsEntrants").asDouble()).isCloseTo(100.0, within(0.01));
        assertThat(c.get("sortiesEchues").asDouble()).isCloseTo(1200.0, within(0.01));
        assertThat(c.get("insuffisant").asBoolean()).isTrue();
        double soldeRestant = c.get("soldeRestant").asDouble();
        double manquant = c.get("montantManquant").asDouble();
        assertThat(soldeRestant).isCloseTo(-1000.0, within(0.01)); // 100 + 100 - 1200
        assertThat(manquant).isCloseTo(1000.0, within(0.01));
    }

    @Test
    @DisplayName("Mois déficitaire absorbé par la trésorerie cumulée du compte : pas d'insuffisance signalée")
    void deficitAbsorbeParTresorerieCumulee() throws Exception {
        String token = creerEtLogin("recap_buffer@test.ch");
        String foyerId = creerFoyer(token, "Foyer Buffer");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        // Solde initial confortable : peut encaisser un mois déficitaire sans passer sous zéro.
        String compteId = creerCompte(token, foyerId, membreId, "Compte épargne", 5000);

        String catRevenu = creerCategorie(token, foyerId, "Petit revenu", "REVENU");
        String catReserve = creerCategorie(token, foyerId, "3e pilier", "RESERVE");

        creerPoste(token, foyerId, scenarioId, catRevenu, "REVENU", "2025-01-01", null, 100, 1, "MENSUALISE", membreId, compteId);
        // Réserve annuelle 1200 (D=12, ancre janvier) : soldeRestant janvier = 100+100-1200 = -1000,
        // mais le solde initial (5000) suffit à l'encaisser -> trésorerie cumulée reste positive.
        creerPoste(token, foyerId, scenarioId, catReserve, "RESERVE", "2025-01-01", null, 1200, 12, "MENSUALISE", membreId, compteId);

        List<JsonNode> recap = comptesRecap(token, foyerId, scenarioId, 2025, 1, membreId);
        JsonNode c = recap.get(0);
        assertThat(c.get("soldeRestant").asDouble()).isCloseTo(-1000.0, within(0.01));
        // Trésorerie cumulée = 5000 - 1000 = 4000 > 0 -> pas d'insuffisance malgré le mois négatif.
        assertThat(c.get("insuffisant").asBoolean()).isFalse();
        assertThat(c.get("montantManquant").asDouble()).isCloseTo(0.0, within(0.01));
    }

    @Test
    @DisplayName("Timeline trésorerie : chaîne solde initial + soldes restants mensuels sur nbMois, mois courant et 2 mois futurs inclus")
    void timelineTresorerieChainee() throws Exception {
        String token = creerEtLogin("treso_ok@test.ch");
        String foyerId = creerFoyer(token, "Foyer Treso");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String compteId = creerCompte(token, foyerId, membreId, "Compte treso", 1000);

        String catRevenu = creerCategorie(token, foyerId, "Salaire", "REVENU");
        creerPoste(token, foyerId, scenarioId, catRevenu, "REVENU", "2025-01-01", null, 500, 1, "MENSUALISE", membreId, compteId);

        List<JsonNode> treso = comptesTresorerie(token, foyerId, scenarioId, 2025, 3, membreId, 6);
        assertThat(treso).hasSize(1);
        List<JsonNode> points = new ArrayList<>();
        treso.get(0).get("points").forEach(points::add);
        // Fenêtre demandée mars (M-3..M+2) = Jan..Mai, mais scenario ne commence qu'en
        // janvier -> 5 points dispo (nbMois=6 borné par l'historique disponible).
        assertThat(points).hasSize(5);
        assertThat(points.get(0).get("tresorerieCumulee").asDouble()).isCloseTo(1500.0, within(0.01)); // Jan : 1000 + 500
        assertThat(points.get(1).get("tresorerieCumulee").asDouble()).isCloseTo(2000.0, within(0.01)); // Fev
        assertThat(points.get(2).get("tresorerieCumulee").asDouble()).isCloseTo(2500.0, within(0.01)); // Mar (mois demandé)
        assertThat(points.get(3).get("tresorerieCumulee").asDouble()).isCloseTo(3000.0, within(0.01)); // Avr (futur)
        assertThat(points.get(4).get("tresorerieCumulee").asDouble()).isCloseTo(3500.0, within(0.01)); // Mai (futur)
    }


    @Test
    @DisplayName("Compte primaire configuré : comble le manque de trésorerie ce mois (topUp), pas d'insuffisance")
    void comblementViaComptePrimaire() throws Exception {
        String token = creerEtLogin("primaire_topup@test.ch");
        String foyerId = creerFoyer(token, "Foyer Primaire TopUp");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String comptePrimaireId = creerCompte(token, foyerId, membreId, "Compte primaire");
        String compteCible = creerCompte(token, foyerId, membreId, "Compte réserve");

        definirComptePrimaire(token, foyerId, membreId, comptePrimaireId);

        String catReserve = creerCategorie(token, foyerId, "3e pilier", "RESERVE");
        // Réserve annuelle 1200 (D=12, ancre janvier) : mensualisée = 100/mois, échue en
        // pleine à 1200 en janvier. Compte cible sans revenu propre.
        creerPoste(token, foyerId, scenarioId, catReserve, "RESERVE", "2025-01-01", null, 1200, 12, "MENSUALISE", membreId, compteCible);

        List<JsonNode> recap = comptesRecap(token, foyerId, scenarioId, 2025, 1, membreId);
        JsonNode cible = trouverCompte(recap, compteCible);
        JsonNode primaire = trouverCompte(recap, comptePrimaireId);

        // virementsEntrants = base(100) + topUp(1100) = 1200 -> soldeRestant = 0, plus insuffisant
        assertThat(cible.get("virementsEntrants").asDouble()).isCloseTo(1200.0, within(0.01));
        assertThat(cible.get("soldeRestant").asDouble()).isCloseTo(0.0, within(0.01));
        assertThat(cible.get("insuffisant").asBoolean()).isFalse();

        // Le primaire fournit exactement ce virement en sortant
        assertThat(primaire.get("virementsSortants").asDouble()).isCloseTo(1200.0, within(0.01));
        assertThat(primaire.get("soldeRestant").asDouble()).isCloseTo(-1200.0, within(0.01));
        assertThat(primaire.get("insuffisant").asBoolean()).isTrue();
    }

    @Test
    @DisplayName("Compte joint : virements répartis au prorata de la quote-part, vue scopée à chaque membre")
    void repartitionProrataCompteJoint() throws Exception {
        String token = creerEtLogin("primaire_joint@test.ch");
        String foyerId = creerFoyer(token, "Foyer Primaire Joint");
        String membreAId = premierMembreId(token, foyerId);
        String membreBId = creerMembre(token, foyerId, "Membre 2");
        String scenarioId = creerScenarioDeuxMembres(token, foyerId, membreAId, membreBId, 0.6, 0.4);

        String comptePrimaireA = creerCompte(token, foyerId, membreAId, "Compte A perso");
        String comptePrimaireB = creerCompte(token, foyerId, membreBId, "Compte B perso");
        String compteJoint = creerCompteJoint(token, foyerId, List.of(membreAId, membreBId), "Compte commun");

        definirComptePrimaire(token, foyerId, membreAId, comptePrimaireA);
        definirComptePrimaire(token, foyerId, membreBId, comptePrimaireB);

        String catCharge = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        // Charge mensuelle 1000, échue chaque mois, répartie 60/40 entre A et B (défaut scénario),
        // ventilée sur le compte joint pour les deux membres.
        creerPosteDeuxMembres(token, foyerId, scenarioId, catCharge, "CHARGE", "2025-01-01", 1000, 1, "MENSUALISE",
                membreAId, membreBId, compteJoint);

        List<JsonNode> recap = comptesRecap(token, foyerId, scenarioId, 2025, 1, membreAId);
        JsonNode joint = trouverCompte(recap, compteJoint);
        // Vue membreA : seule sa part (60%) sur le compte joint est restituée.
        assertThat(joint.get("virementsEntrants").asDouble()).isCloseTo(600.0, within(0.01));
        assertThat(joint.get("soldeRestant").asDouble()).isCloseTo(0.0, within(0.01));

        List<JsonNode> recapB2 = comptesRecap(token, foyerId, scenarioId, 2025, 1, membreBId);
        JsonNode jointB = trouverCompte(recapB2, compteJoint);
        // Vue membreB : seule sa part (40%) sur le compte joint est restituée.
        assertThat(jointB.get("virementsEntrants").asDouble()).isCloseTo(400.0, within(0.01));
        assertThat(jointB.get("soldeRestant").asDouble()).isCloseTo(0.0, within(0.01));

        List<JsonNode> recapA = comptesRecap(token, foyerId, scenarioId, 2025, 1, membreAId);
        JsonNode primaireA = trouverCompte(recapA, comptePrimaireA);
        assertThat(primaireA.get("virementsSortants").asDouble()).isCloseTo(600.0, within(0.01)); // 60% de 1000

        List<JsonNode> recapB = comptesRecap(token, foyerId, scenarioId, 2025, 1, membreBId);
        JsonNode primaireB = trouverCompte(recapB, comptePrimaireB);
        assertThat(primaireB.get("virementsSortants").asDouble()).isCloseTo(400.0, within(0.01)); // 40% de 1000
    }

    @Test
    @DisplayName("Le compte primaire lui-même peut devenir insuffisant s'il ne peut pas tout financer")
    void comptePrimaireLuiMemeInsuffisant() throws Exception {
        String token = creerEtLogin("primaire_insuffisant@test.ch");
        String foyerId = creerFoyer(token, "Foyer Primaire Insuffisant");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String comptePrimaireId = creerCompte(token, foyerId, membreId, "Compte primaire");
        String compteCommun = creerCompte(token, foyerId, membreId, "Compte commun");

        definirComptePrimaire(token, foyerId, membreId, comptePrimaireId);

        String catRevenu = creerCategorie(token, foyerId, "Salaire", "REVENU");
        String catCharge = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        // Revenu 3000/mois directement sur le compte primaire
        creerPoste(token, foyerId, scenarioId, catRevenu, "REVENU", "2025-01-01", null, 3000, 1, "MENSUALISE", membreId, comptePrimaireId);
        // Charge 3500/mois sur le compte commun (financée entièrement par le primaire)
        creerPoste(token, foyerId, scenarioId, catCharge, "CHARGE", "2025-01-01", null, 3500, 1, "MENSUALISE", membreId, compteCommun);

        List<JsonNode> recap = comptesRecap(token, foyerId, scenarioId, 2025, 1, membreId);
        JsonNode primaire = trouverCompte(recap, comptePrimaireId);
        JsonNode commun = trouverCompte(recap, compteCommun);

        assertThat(commun.get("soldeRestant").asDouble()).isCloseTo(0.0, within(0.01));
        assertThat(commun.get("insuffisant").asBoolean()).isFalse();

        // Le primaire encaisse 3000 mais doit sortir 3500 -> insuffisant de 500
        assertThat(primaire.get("virementsSortants").asDouble()).isCloseTo(3500.0, within(0.01));
        assertThat(primaire.get("soldeRestant").asDouble()).isCloseTo(-500.0, within(0.01));
        assertThat(primaire.get("insuffisant").asBoolean()).isTrue();
        assertThat(primaire.get("montantManquant").asDouble()).isCloseTo(500.0, within(0.01));
    }

    @Test
    @DisplayName("Compte primaire : redéfinir le primaire d'un membre retire automatiquement l'ancien (unicité)")
    void redefinirComptePrimaireRetireAncien() throws Exception {
        String token = creerEtLogin("primaire_unique@test.ch");
        String foyerId = creerFoyer(token, "Foyer Primaire Unique");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String compteA = creerCompte(token, foyerId, membreId, "Compte A");
        String compteB = creerCompte(token, foyerId, membreId, "Compte B");

        definirComptePrimaire(token, foyerId, membreId, compteA);
        String membreBody = client.get().uri("/api/foyers/" + foyerId + "/membres/" + membreId)
                .header("Authorization", "Bearer " + token).retrieve().body(String.class);
        assertThat(MAPPER.readTree(membreBody).get("compteIdPrimaire").asText()).isEqualTo(compteA);

        // Redéfinir vers compteB : compteA ne doit plus être primaire.
        definirComptePrimaire(token, foyerId, membreId, compteB);
        membreBody = client.get().uri("/api/foyers/" + foyerId + "/membres/" + membreId)
                .header("Authorization", "Bearer " + token).retrieve().body(String.class);
        assertThat(MAPPER.readTree(membreBody).get("compteIdPrimaire").asText()).isEqualTo(compteB);

        // Retrait explicite (compteId null)
        client.put().uri("/api/foyers/" + foyerId + "/membres/" + membreId + "/compte-primaire")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"compteId\":null}")
                .retrieve().toBodilessEntity();
        membreBody = client.get().uri("/api/foyers/" + foyerId + "/membres/" + membreId)
                .header("Authorization", "Bearer " + token).retrieve().body(String.class);
        assertThat(MAPPER.readTree(membreBody).get("compteIdPrimaire").isNull()).isTrue();
    }

    @Test
    @DisplayName("Compte primaire : validation refusée si le compte n'est pas rattaché au membre, accès inter-foyers refusé")
    void comptePrimaireValidationEtAccesRefuses() {
        String token = creerEtLogin("primaire_valid@test.ch");
        String foyerId = creerFoyer(token, "Foyer Primaire Valid");
        String membreId = premierMembreId(token, foyerId);
        String autreMembreId = creerMembre(token, foyerId, "Autre membre");
        String compteAutreMembre = creerCompte(token, foyerId, autreMembreId, "Compte autre membre");

        // Refus : membre non co-titulaire du compte visé
        assertThatThrownBy(() -> client.put()
                .uri("/api/foyers/" + foyerId + "/membres/" + membreId + "/compte-primaire")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"compteId\":\"" + compteAutreMembre + "\"}")
                .retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_CONTENT));

        // Accès inter-foyers refusé
        String tokenB = creerEtLogin("primaire_valid_b@test.ch");
        String compteId = creerCompte(token, foyerId, membreId, "Compte");
        assertThatThrownBy(() -> client.put()
                .uri("/api/foyers/" + foyerId + "/membres/" + membreId + "/compte-primaire")
                .header("Authorization", "Bearer " + tokenB)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"compteId\":\"" + compteId + "\"}")
                .retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("Accès inter-foyers refusé (403) sur comptes-recap et comptes-tresorerie")
    void accesInterFoyersRefuse() {
        String tokenA = creerEtLogin("recap_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Recap");
        String membreAId = premierMembreId(tokenA, foyerAId);
        String scenarioId = creerScenario(tokenA, foyerAId, membreAId);

        String tokenB = creerEtLogin("recap_b@test.ch");
        creerFoyer(tokenB, "Foyer B Recap");

        assertThatThrownBy(() -> client.get()
                .uri("/api/foyers/" + foyerAId + "/scenarios/" + scenarioId
                        + "/projection/comptes-recap?annee=2025&mois=1&membreId=" + membreAId)
                .header("Authorization", "Bearer " + tokenB)
                .retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));

        assertThatThrownBy(() -> client.get()
                .uri("/api/foyers/" + foyerAId + "/scenarios/" + scenarioId
                        + "/projection/comptes-tresorerie?annee=2025&mois=1&membreId=" + membreAId)
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

    private String creerScenario(String token, String foyerId, String membreId) {
        Map<String, Object> payload = Map.of(
                "nom", "Scénario Test",
                "anneeDepart", 2025,
                "horizonAnnees", 3,
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

    private String creerCompte(String token, String foyerId, String membreId, String libelle) {
        return creerCompte(token, foyerId, membreId, libelle, 0);
    }

    private String creerCompte(String token, String foyerId, String membreId, String libelle, double soldeInitial) {
        Map<String, Object> payload = Map.of(
                "libelle", libelle,
                "soldeInitial", soldeInitial,
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

    private String creerPoste(String token, String foyerId, String scenarioId, String catId, String type,
                               String debut, String fin, double montant, int periodiciteMois, String mode,
                               String membreId, String compteId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("description", "Poste test recap");
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", periodiciteMois);
        payload.put("debut", debut);
        payload.put("fin", fin);
        payload.put("mode", mode);
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", "EFFECTIF");
        payload.put("ordre", 1);
        payload.put("repartitions", List.of());
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

    private String creerMembre(String token, String foyerId, String nom) {
        Map<String, Object> payload = Map.of("nom", nom, "couleur", "#22C55E");
        try {
            String body = client.post()
                    .uri("/api/foyers/" + foyerId + "/membres")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().body(String.class);
            return MAPPER.readTree(body).get("id").asText();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private void definirComptePrimaire(String token, String foyerId, String membreId, String compteId) {
        try {
            client.put()
                    .uri("/api/foyers/" + foyerId + "/membres/" + membreId + "/compte-primaire")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body("{\"compteId\":\"" + compteId + "\"}")
                    .retrieve().toBodilessEntity();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private JsonNode trouverCompte(List<JsonNode> recap, String compteId) {
        return recap.stream()
                .filter(c -> c.get("compteId").asText().equals(compteId))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Compte introuvable dans le récap : " + compteId));
    }

    private String creerScenarioDeuxMembres(String token, String foyerId, String membreAId, String membreBId,
                                             double quotePartA, double quotePartB) {
        Map<String, Object> payload = Map.of(
                "nom", "Scénario Test",
                "anneeDepart", 2025,
                "horizonAnnees", 3,
                "tresorerieInitiale", 0,
                "repartitions", List.of(
                        Map.of("membreId", membreAId, "quotePart", quotePartA),
                        Map.of("membreId", membreBId, "quotePart", quotePartB))
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

    private String creerCompteJoint(String token, String foyerId, List<String> membreIds, String libelle) {
        Map<String, Object> payload = Map.of(
                "libelle", libelle,
                "soldeInitial", 0,
                "devise", "CHF",
                "membreIds", membreIds
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

    private String creerPosteDeuxMembres(String token, String foyerId, String scenarioId, String catId, String type,
                                          String debut, double montant, int periodiciteMois, String mode,
                                          String membreAId, String membreBId, String compteId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("description", "Poste test recap joint");
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", periodiciteMois);
        payload.put("debut", debut);
        payload.put("fin", null);
        payload.put("mode", mode);
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", "EFFECTIF");
        payload.put("ordre", 1);
        payload.put("repartitions", List.of()); // vide -> hérite de la répartition par défaut du scénario (60/40)
        payload.put("ventilations", List.of(
                Map.of("membreId", membreAId, "compteId", compteId),
                Map.of("membreId", membreBId, "compteId", compteId)));
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

    private List<JsonNode> comptesRecap(String token, String foyerId, String scenarioId, int annee, int mois, String membreId) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId
                            + "/projection/comptes-recap?annee=" + annee + "&mois=" + mois + "&membreId=" + membreId)
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            JsonNode arr = MAPPER.readTree(body);
            List<JsonNode> result = new ArrayList<>();
            arr.forEach(result::add);
            return result;
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private List<JsonNode> comptesTresorerie(String token, String foyerId, String scenarioId, int annee, int mois,
                                              String membreId, int nbMois) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId
                            + "/projection/comptes-tresorerie?annee=" + annee + "&mois=" + mois
                            + "&membreId=" + membreId + "&nbMois=" + nbMois)
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            JsonNode arr = MAPPER.readTree(body);
            List<JsonNode> result = new ArrayList<>();
            arr.forEach(result::add);
            return result;
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
