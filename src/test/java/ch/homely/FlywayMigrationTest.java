package ch.homely;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * T1.1 — Vérifie que la migration Flyway V1__init.sql s'applique sur
 * un PostgreSQL vierge (Testcontainers) et que ddl-auto=validate passe.
 */
@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
class FlywayMigrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("homely_test")
                    .withUsername("test")
                    .withPassword("test");

    @Test
    void contextLoads() {
        // Si le contexte Spring démarre sans exception, Flyway et ddl-auto=validate ont réussi.
    }
}
