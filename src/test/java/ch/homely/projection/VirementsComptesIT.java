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
 * Tests d'intégration pour les endpoints de virements inter-comptes du dashboard
 * (GET .../projection/virements-comptes[-annuel]) — remplace l'ancienne vue hub/satellite qui
 * n'exposait que des agrégats entrants/sortants par compte.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class VirementsComptesIT {

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
    @DisplayName("Comblement via compte primaire : une seule paire source→destination, montant = topUp + base")
    void pairesComblementViaComptePrimaire() throws Exception {
        String token = creerEtLogin("virements_topup@test.ch");
        String foyerId = creerFoyer(token, "Foyer Virements TopUp");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String comptePrimaireId = creerCompte(token, foyerId, membreId, "Compte primaire");
        String compteCible = creerCompte(token, foyerId, membreId, "Compte réserve");

        definirComptePrimaire(token, foyerId, membreId, comptePrimaireId);

        String catReserve = creerCategorie(token, foyerId, "3e pilier", "RESERVE");
        // Réserve annuelle 1200 (D=12, ancre janvier) : mensualisée = 100/mois, échue en pleine
        // à 1200 en janvier -> topUp nécessaire de 1100, financé entièrement par le primaire.
        creerPoste(token, foyerId, scenarioId, catReserve, "RESERVE", "2025-01-01", null, 1200, 12, "MENSUALISE", membreId, compteCible);

        List<JsonNode> virements = virementsComptes(token, foyerId, scenarioId, 2025, 1, membreId);
        assertThat(virements).hasSize(1);
        JsonNode v = virements.get(0);
        assertThat(v.get("compteSourceId").asText()).isEqualTo(comptePrimaireId);
        assertThat(v.get("compteDestinationId").asText()).isEqualTo(compteCible);
        assertThat(v.get("montant").asDouble()).isCloseTo(1200.0, within(0.01));
    }

    @Test
    @DisplayName("Aucun virement simulé quand tous les membres sont auto-financés (pas de primaire différent)")
    void aucuneVirementSiAutoFinance() throws Exception {
        String token = creerEtLogin("virements_aucun@test.ch");
        String foyerId = creerFoyer(token, "Foyer Virements Aucun");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String compteId = creerCompte(token, foyerId, membreId, "Compte courant");

        String catRevenu = creerCategorie(token, foyerId, "Salaire", "REVENU");
        creerPoste(token, foyerId, scenarioId, catRevenu, "REVENU", "2025-01-01", null, 5000, 1, "MENSUALISE", membreId, compteId);

        List<JsonNode> virements = virementsComptes(token, foyerId, scenarioId, 2025, 1, membreId);
        assertThat(virements).isEmpty();
    }

    @Test
    @DisplayName("Deux comptes financés depuis le même primaire : une paire par destination (1 source → N destinations)")
    void unePaireParDestinationDepuisMemeSource() throws Exception {
        String token = creerEtLogin("virements_multi@test.ch");
        String foyerId = creerFoyer(token, "Foyer Virements Multi");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String comptePrimaireId = creerCompte(token, foyerId, membreId, "Compte primaire");
        String compteA = creerCompte(token, foyerId, membreId, "Compte A");
        String compteB = creerCompte(token, foyerId, membreId, "Compte B");

        definirComptePrimaire(token, foyerId, membreId, comptePrimaireId);

        String catChargeA = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        String catChargeB = creerCategorie(token, foyerId, "Assurance", "CHARGE");
        creerPoste(token, foyerId, scenarioId, catChargeA, "CHARGE", "2025-01-01", null, 500, 1, "MENSUALISE", membreId, compteA);
        creerPoste(token, foyerId, scenarioId, catChargeB, "CHARGE", "2025-01-01", null, 200, 1, "MENSUALISE", membreId, compteB);

        List<JsonNode> virements = virementsComptes(token, foyerId, scenarioId, 2025, 1, membreId);
        assertThat(virements).hasSize(2);
        assertThat(virements).allMatch(v -> v.get("compteSourceId").asText().equals(comptePrimaireId));

        JsonNode versA = trouverParDestination(virements, compteA);
        JsonNode versB = trouverParDestination(virements, compteB);
        assertThat(versA.get("montant").asDouble()).isCloseTo(500.0, within(0.01));
        assertThat(versB.get("montant").asDouble()).isCloseTo(200.0, within(0.01));
    }

    @Test
    @DisplayName("Variante annuelle : montants d'une paire identique sommés sur les 12 mois")
    void variantAnnuelleSommeLesMois() throws Exception {
        String token = creerEtLogin("virements_annuel@test.ch");
        String foyerId = creerFoyer(token, "Foyer Virements Annuel");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String comptePrimaireId = creerCompte(token, foyerId, membreId, "Compte primaire");
        String compteCible = creerCompte(token, foyerId, membreId, "Compte cible");

        definirComptePrimaire(token, foyerId, membreId, comptePrimaireId);

        String catCharge = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        // Charge mensuelle 300, échue chaque mois -> 12 x 300 = 3600 sur l'année.
        creerPoste(token, foyerId, scenarioId, catCharge, "CHARGE", "2025-01-01", null, 300, 1, "MENSUALISE", membreId, compteCible);

        List<JsonNode> virementsAnnuel = virementsComptesAnnuel(token, foyerId, scenarioId, 2025, membreId);
        assertThat(virementsAnnuel).hasSize(1);
        JsonNode v = virementsAnnuel.get(0);
        assertThat(v.get("compteSourceId").asText()).isEqualTo(comptePrimaireId);
        assertThat(v.get("compteDestinationId").asText()).isEqualTo(compteCible);
        assertThat(v.get("montant").asDouble()).isCloseTo(3600.0, within(0.01));
    }

    @Test
    @DisplayName("Un membre ne voit que les virements dont le compte destination l'inclut (pas les transferts vers les comptes exclusifs d'un autre membre)")
    void filtragePasDestinataire() throws Exception {
        String token = creerEtLogin("virements_filtrage@test.ch");
        String foyerId = creerFoyer(token, "Foyer Virements Filtrage");

        String membreAId = premierMembreId(token, foyerId);
        String membreBId = creerMembre(token, foyerId, "Membre 2");

        String scenarioId = creerScenarioDeuxMembres(token, foyerId, membreAId, membreBId, 0.5, 0.5);

        String comptePrimaireA = creerCompte(token, foyerId, membreAId, "Primaire A");
        String comptePrimaireB = creerCompte(token, foyerId, membreBId, "Primaire B");
        // Compte exclusif à B (A n'en est pas co-titulaire).
        String compteExclusifB = creerCompte(token, foyerId, membreBId, "Compte exclusif B");
        // Compte commun (A et B co-titulaires) — transfert que A doit voir même si B est aussi dessus.
        String compteCommun = creerCompteJoint(token, foyerId, List.of(membreAId, membreBId), "Compte commun");

        definirComptePrimaire(token, foyerId, membreAId, comptePrimaireA);
        definirComptePrimaire(token, foyerId, membreBId, comptePrimaireB);

        String catChargeExclusive = creerCategorie(token, foyerId, "Loisirs B", "CHARGE");
        String catChargeCommune = creerCategorie(token, foyerId, "Loyer commun", "CHARGE");
        // Postes entièrement à la charge de B (CUSTOM 100%) : seul le primaire de B finance.
        // Financé par le primaire de B, vers un compte exclusif à B -> A ne doit pas le voir.
        creerPosteCustomMembreUnique(token, foyerId, scenarioId, catChargeExclusive, "CHARGE", "2025-01-01", 150, 1, "MENSUALISE", membreBId, compteExclusifB);
        // Financé par le primaire de B, vers le compte commun -> A doit le voir (il est co-titulaire de la destination).
        creerPosteCustomMembreUnique(token, foyerId, scenarioId, catChargeCommune, "CHARGE", "2025-01-01", 400, 1, "MENSUALISE", membreBId, compteCommun);

        List<JsonNode> virementsPourA = virementsComptes(token, foyerId, scenarioId, 2025, 1, membreAId);
        assertThat(virementsPourA).hasSize(1);
        assertThat(virementsPourA.get(0).get("compteDestinationId").asText()).isEqualTo(compteCommun);

        List<JsonNode> virementsPourB = virementsComptes(token, foyerId, scenarioId, 2025, 1, membreBId);
        assertThat(virementsPourB).hasSize(2);
        assertThat(virementsPourB).anyMatch(v -> v.get("compteDestinationId").asText().equals(compteExclusifB));
        assertThat(virementsPourB).anyMatch(v -> v.get("compteDestinationId").asText().equals(compteCommun));
    }

    @Test
    @DisplayName("Accès inter-foyers refusé (403) sur virements-comptes")
    void accesInterFoyersRefuse() {
        String tokenA = creerEtLogin("virements_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Virements");
        String membreAId = premierMembreId(tokenA, foyerAId);
        String scenarioId = creerScenario(tokenA, foyerAId, membreAId);

        String tokenB = creerEtLogin("virements_b@test.ch");
        creerFoyer(tokenB, "Foyer B Virements");

        assertThatThrownBy(() -> client.get()
                .uri("/api/foyers/" + foyerAId + "/scenarios/" + scenarioId
                        + "/projection/virements-comptes?annee=2025&mois=1&membreId=" + membreAId)
                .header("Authorization", "Bearer " + tokenB)
                .retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("Accès inter-foyers refusé (403) sur virements-comptes-annuel")
    void accesInterFoyersRefuseAnnuel() {
        String tokenA = creerEtLogin("virements_annuel_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Virements Annuel");
        String membreAId = premierMembreId(tokenA, foyerAId);
        String scenarioId = creerScenario(tokenA, foyerAId, membreAId);

        String tokenB = creerEtLogin("virements_annuel_b@test.ch");
        creerFoyer(tokenB, "Foyer B Virements Annuel");

        assertThatThrownBy(() -> client.get()
                .uri("/api/foyers/" + foyerAId + "/scenarios/" + scenarioId
                        + "/projection/virements-comptes-annuel?annee=2025&membreId=" + membreAId)
                .header("Authorization", "Bearer " + tokenB)
                .retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("Détail d'un virement : une ligne par poste financé, avec libellé et catégorie")
    void detailVirementParPoste() throws Exception {
        String token = creerEtLogin("virements_detail@test.ch");
        String foyerId = creerFoyer(token, "Foyer Détail Virement");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String comptePrimaireId = creerCompte(token, foyerId, membreId, "Compte primaire");
        String compteCible = creerCompte(token, foyerId, membreId, "Compte charges");

        definirComptePrimaire(token, foyerId, membreId, comptePrimaireId);

        String catLoyer = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        String catAssurance = creerCategorie(token, foyerId, "Assurance", "CHARGE");
        creerPosteDecrit(token, foyerId, scenarioId, catLoyer, "CHARGE", "2025-01-01", 1200, 1, membreId, compteCible, "Loyer appartement");
        creerPosteDecrit(token, foyerId, scenarioId, catAssurance, "CHARGE", "2025-01-01", 300, 1, membreId, compteCible, "Assurance ménage");

        List<JsonNode> lignes = virementDetail(token, foyerId, scenarioId, 2025, 1, comptePrimaireId, compteCible);
        assertThat(lignes).hasSize(2);
        // Tri par montant décroissant.
        assertThat(lignes.get(0).get("libelle").asText()).isEqualTo("Loyer appartement");
        assertThat(lignes.get(0).get("categorieNom").asText()).isEqualTo("Loyer");
        assertThat(lignes.get(0).get("origine").asText()).isEqualTo("POSTE");
        assertThat(lignes.get(0).get("type").asText()).isEqualTo("CHARGE");
        assertThat(lignes.get(0).get("montant").asDouble()).isCloseTo(1200.0, within(0.01));
        assertThat(lignes.get(1).get("libelle").asText()).isEqualTo("Assurance ménage");
        assertThat(lignes.get(1).get("montant").asDouble()).isCloseTo(300.0, within(0.01));

        // Invariant : la somme des lignes = le montant de la paire.
        JsonNode paire = trouverParDestination(
                virementsComptes(token, foyerId, scenarioId, 2025, 1, membreId), compteCible);
        assertThat(sommeMontants(lignes)).isCloseTo(paire.get("montant").asDouble(), within(0.01));
    }

    @Test
    @DisplayName("Détail d'un virement : charge annuelle échue -> ligne poste + ligne comblement de trésorerie")
    void detailVirementComblementTresorerie() throws Exception {
        String token = creerEtLogin("virements_detail_topup@test.ch");
        String foyerId = creerFoyer(token, "Foyer Détail Comblement");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String comptePrimaireId = creerCompte(token, foyerId, membreId, "Compte primaire");
        String compteCible = creerCompte(token, foyerId, membreId, "Compte réserve");

        definirComptePrimaire(token, foyerId, membreId, comptePrimaireId);

        String catReserve = creerCategorie(token, foyerId, "3e pilier", "RESERVE");
        // D=12 ancré en janvier : mensualisé = 100, échu = 1200 -> 1100 de comblement.
        creerPosteDecrit(token, foyerId, scenarioId, catReserve, "RESERVE", "2025-01-01", 1200, 12, membreId, compteCible, "Pilier 3a");

        List<JsonNode> lignes = virementDetail(token, foyerId, scenarioId, 2025, 1, comptePrimaireId, compteCible);
        assertThat(lignes).isNotEmpty();
        assertThat(lignes).anyMatch(l -> l.get("origine").asText().equals("COMBLEMENT_TRESORERIE"));
        assertThat(sommeMontants(lignes)).isCloseTo(1200.0, within(0.01));
    }

    @Test
    @DisplayName("Détail d'un virement : variante annuelle = somme des composantes mensuelles")
    void detailVirementAnnuel() throws Exception {
        String token = creerEtLogin("virements_detail_annuel@test.ch");
        String foyerId = creerFoyer(token, "Foyer Détail Annuel");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String comptePrimaireId = creerCompte(token, foyerId, membreId, "Compte primaire");
        String compteCible = creerCompte(token, foyerId, membreId, "Compte cible");

        definirComptePrimaire(token, foyerId, membreId, comptePrimaireId);

        String catCharge = creerCategorie(token, foyerId, "Loyer", "CHARGE");
        creerPosteDecrit(token, foyerId, scenarioId, catCharge, "CHARGE", "2025-01-01", 300, 1, membreId, compteCible, "Loyer mensuel");

        List<JsonNode> lignes = virementDetailAnnuel(token, foyerId, scenarioId, 2025, comptePrimaireId, compteCible);
        assertThat(lignes).hasSize(1);
        assertThat(lignes.get(0).get("libelle").asText()).isEqualTo("Loyer mensuel");
        assertThat(lignes.get(0).get("montant").asDouble()).isCloseTo(3600.0, within(0.01));
    }

    @Test
    @DisplayName("Détail d'un virement : argent de poche tracé comme ligne dédiée")
    void detailVirementArgentPoche() throws Exception {
        String token = creerEtLogin("virements_detail_poche@test.ch");
        String foyerId = creerFoyer(token, "Foyer Détail Poche");
        String membreId = premierMembreId(token, foyerId);
        String scenarioId = creerScenario(token, foyerId, membreId);
        String comptePrimaireId = creerCompte(token, foyerId, membreId, "Compte primaire");
        String comptePoche = creerCompte(token, foyerId, membreId, "Compte argent de poche");

        definirComptePrimaire(token, foyerId, membreId, comptePrimaireId);

        String catRevenu = creerCategorie(token, foyerId, "Salaire", "REVENU");
        creerPosteDecrit(token, foyerId, scenarioId, catRevenu, "REVENU", "2025-01-01", 5000, 1, membreId, comptePrimaireId, "Salaire");
        definirArgentPocheFixe(token, foyerId, scenarioId, membreId, 400, comptePoche);

        List<JsonNode> lignes = virementDetail(token, foyerId, scenarioId, 2025, 1, comptePrimaireId, comptePoche);
        assertThat(lignes).isNotEmpty();
        assertThat(lignes).anyMatch(l -> l.get("origine").asText().equals("ARGENT_POCHE"));
    }

    @Test
    @DisplayName("Accès inter-foyers refusé (403) sur le détail d'un virement")
    void accesInterFoyersRefuseDetail() {
        String tokenA = creerEtLogin("virements_detail_a@test.ch");
        String foyerAId = creerFoyer(tokenA, "Foyer A Détail");
        String membreAId = premierMembreId(tokenA, foyerAId);
        String scenarioId = creerScenario(tokenA, foyerAId, membreAId);
        String compteA = creerCompte(tokenA, foyerAId, membreAId, "Compte A");
        String compteB = creerCompte(tokenA, foyerAId, membreAId, "Compte B");

        String tokenB = creerEtLogin("virements_detail_b@test.ch");
        creerFoyer(tokenB, "Foyer B Détail");

        assertThatThrownBy(() -> client.get()
                .uri("/api/foyers/" + foyerAId + "/scenarios/" + scenarioId
                        + "/projection/virements-comptes/detail?annee=2025&mois=1&compteSourceId=" + compteA
                        + "&compteDestinationId=" + compteB)
                .header("Authorization", "Bearer " + tokenB)
                .retrieve().toBodilessEntity())
                .isInstanceOfSatisfying(HttpClientErrorException.class,
                        ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    // ── Helpers (mêmes conventions que ComptesRecapIT) ──────────────────────

    private double sommeMontants(List<JsonNode> lignes) {
        return lignes.stream().mapToDouble(l -> l.get("montant").asDouble()).sum();
    }

    /** Politique d'argent de poche en mode FIXE, créditée sur {@code compteId}. */
    private void definirArgentPocheFixe(String token, String foyerId, String scenarioId,
                                        String membreId, double montantFixe, String compteId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("membreId", membreId);
        payload.put("routage", List.of(Map.of("compteId", compteId)));
        payload.put("nom", "Poche Test");
        payload.put("dateDebut", "2025-01");
        payload.put("mode", "FIXE");
        payload.put("montantFixe", montantFixe);
        try {
            client.post()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/argent-poche/politiques")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().toBodilessEntity();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private List<JsonNode> virementDetail(String token, String foyerId, String scenarioId, int annee, int mois,
                                          String compteSourceId, String compteDestinationId) {
        return getListe(token, "/api/foyers/" + foyerId + "/scenarios/" + scenarioId
                + "/projection/virements-comptes/detail?annee=" + annee + "&mois=" + mois
                + "&compteSourceId=" + compteSourceId + "&compteDestinationId=" + compteDestinationId);
    }

    private List<JsonNode> virementDetailAnnuel(String token, String foyerId, String scenarioId, int annee,
                                                String compteSourceId, String compteDestinationId) {
        return getListe(token, "/api/foyers/" + foyerId + "/scenarios/" + scenarioId
                + "/projection/virements-comptes-annuel/detail?annee=" + annee
                + "&compteSourceId=" + compteSourceId + "&compteDestinationId=" + compteDestinationId);
    }

    private List<JsonNode> getListe(String token, String uri) {
        try {
            String body = client.get().uri(uri)
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            JsonNode arr = MAPPER.readTree(body);
            List<JsonNode> result = new ArrayList<>();
            arr.forEach(result::add);
            return result;
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private void creerPosteDecrit(String token, String foyerId, String scenarioId, String catId, String type,
                                  String debut, double montant, int periodiciteMois,
                                  String membreId, String compteId, String description) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("description", description);
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", periodiciteMois);
        payload.put("debut", debut);
        payload.put("mode", "MENSUALISE");
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", "EFFECTIF");
        payload.put("ordre", 1);
        payload.put("repartitions", List.of());
        payload.put("ventilations", List.of(Map.of("membreId", membreId, "compteId", compteId)));
        try {
            client.post()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().toBodilessEntity();
        } catch (Exception e) { throw new RuntimeException(e); }
    }


    private JsonNode trouverParDestination(List<JsonNode> virements, String compteDestinationId) {
        return virements.stream()
                .filter(v -> v.get("compteDestinationId").asText().equals(compteDestinationId))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Virement introuvable vers : " + compteDestinationId));
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

    private String creerPoste(String token, String foyerId, String scenarioId, String catId, String type,
                               String debut, String fin, double montant, int periodiciteMois, String mode,
                               String membreId, String compteId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("description", "Poste test virements");
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

    private void creerPosteCustomMembreUnique(String token, String foyerId, String scenarioId, String catId, String type,
                                              String debut, double montant, int periodiciteMois, String mode,
                                              String membreId, String compteId) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("description", "Poste test virements");
        payload.put("categorieId", catId);
        payload.put("montant", montant);
        payload.put("periodiciteMois", periodiciteMois);
        payload.put("debut", debut);
        payload.put("mode", mode);
        payload.put("moment", "DEBUT_PERIODE");
        payload.put("nature", "EFFECTIF");
        payload.put("ordre", 1);
        payload.put("typeRepartition", "CUSTOM");
        payload.put("repartitions", List.of(Map.of("membreId", membreId, "quotePart", 1)));
        payload.put("ventilations", List.of(Map.of("membreId", membreId, "compteId", compteId)));
        try {
            client.post()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId + "/postes")
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(MAPPER.writeValueAsString(payload))
                    .retrieve().toBodilessEntity();
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

    private List<JsonNode> virementsComptes(String token, String foyerId, String scenarioId, int annee, int mois, String membreId) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId
                            + "/projection/virements-comptes?annee=" + annee + "&mois=" + mois + "&membreId=" + membreId)
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            JsonNode arr = MAPPER.readTree(body);
            List<JsonNode> result = new ArrayList<>();
            arr.forEach(result::add);
            return result;
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    private List<JsonNode> virementsComptesAnnuel(String token, String foyerId, String scenarioId, int annee, String membreId) {
        try {
            String body = client.get()
                    .uri("/api/foyers/" + foyerId + "/scenarios/" + scenarioId
                            + "/projection/virements-comptes-annuel?annee=" + annee + "&membreId=" + membreId)
                    .header("Authorization", "Bearer " + token)
                    .retrieve().body(String.class);
            JsonNode arr = MAPPER.readTree(body);
            List<JsonNode> result = new ArrayList<>();
            arr.forEach(result::add);
            return result;
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
