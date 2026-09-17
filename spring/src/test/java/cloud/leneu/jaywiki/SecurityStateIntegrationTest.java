package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.auth.JwtService;
import cloud.leneu.jaywiki.auth.TokenRevocations;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import java.time.Duration;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.opensearch.enabled=false")
@Import(TestcontainersConfiguration.class)
class SecurityStateIntegrationTest {
    @Container static GenericContainer<?> isolated = new GenericContainer<>(DockerImageName.parse("redis:7.4-alpine"))
            .withExposedPorts(6379).withCommand("sh", "-ec",
                    "while true; do redis-server --requirepass local-test-only --appendonly yes "
                            + "--appendfsync always --maxmemory 8mb --maxmemory-policy noeviction & "
                            + "child=$!; wait \"$child\" || true; done");
    @DynamicPropertySource static void configure(DynamicPropertyRegistry registry) {
        registry.add("app.security-redis.host", isolated::getHost);
        registry.add("app.security-redis.port", () -> isolated.getMappedPort(6379));
        registry.add("app.security-redis.password", () -> "local-test-only");
        registry.add("app.security-redis.required", () -> true);
    }
    @Autowired StringRedisTemplate cache;
    @Autowired @Qualifier("securityRedisTemplate") StringRedisTemplate security;
    @Autowired JwtService jwt;
    @Autowired TokenRevocations revocations;
    @Autowired TestRestTemplate rest;

    @Test void cacheAndSecurityStateUseDifferentInstances() {
        cache.opsForValue().set("isolation:cache", "cache");
        security.opsForValue().set("isolation:security", "security", Duration.ofMinutes(1));
        assertThat(security.hasKey("isolation:cache")).isFalse();
        assertThat(cache.hasKey("isolation:security")).isFalse();
    }

    @Test void logoutRevokesOnlyThatTokenAndCrossOriginLogoutIsRejected() {
        String first = jwt.issue("admin", "ADMIN"), second = jwt.issue("admin", "ADMIN");
        assertThat(first).isNotEqualTo(second);
        HttpHeaders headers = new HttpHeaders();
        headers.add("Cookie", "jw_token=" + first);
        headers.add("Origin", "https://attacker.invalid");
        assertThat(rest.exchange("/api/auth/logout", HttpMethod.POST, new HttpEntity<>(null, headers), String.class)
                .getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(revocations.isRevoked(first)).isFalse();
        headers.remove("Origin");
        // Even an origin-less cookie request must identify a non-browser client.
        assertThat(rest.exchange("/api/auth/logout", HttpMethod.POST, new HttpEntity<>(null, headers), String.class)
                .getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        headers.add("X-Jaywiki-Request", "server");
        assertThat(rest.exchange("/api/auth/logout", HttpMethod.POST, new HttpEntity<>(null, headers), String.class)
                .getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(revocations.isRevoked(first)).isTrue();
        assertThat(revocations.isRevoked(second)).isFalse();
        var me = rest.exchange("/api/auth/me", HttpMethod.GET, new HttpEntity<>(headers), Map.class);
        assertThat(me.getBody().get("authenticated")).isEqualTo(false);
    }

    @Test void memoryPressureDoesNotEvictSecurityState() {
        security.opsForValue().set("pressure:protected", "1", Duration.ofMinutes(1));
        boolean rejected = false;
        try {
            for (int i = 0; i < 24; i++) security.opsForValue().set("pressure:fill:" + i, "x".repeat(1024 * 1024));
        } catch (org.springframework.dao.DataAccessException expected) {
            assertThat(expected.getMostSpecificCause().getMessage()).contains("OOM");
            rejected = true;
        }
        try {
            assertThat(rejected).isTrue();
            assertThat(security.opsForValue().get("pressure:protected")).isEqualTo("1");
        } finally {
            for (int i = 0; i < 24; i++) security.delete("pressure:fill:" + i);
            security.delete("pressure:protected");
        }
    }

    @Test void revokedTokenSurvivesRedisRestartAndAnOutageRejectsAuthentication() throws Exception {
        String token = jwt.issue("admin", "ADMIN");
        revocations.revoke(token, jwt.parse(token));
        // Restart the Redis process while retaining the container's listening
        // address. Docker on Linux can reassign an ephemeral host port when the
        // whole container restarts, unlike the stable Service address in k3s.
        String before = isolated.execInContainer("redis-cli", "-a", "local-test-only", "INFO", "server").getStdout();
        assertThat(isolated.execInContainer("redis-cli", "-a", "local-test-only", "SHUTDOWN", "SAVE").getExitCode()).isZero();
        boolean recovered = false;
        long deadline = System.nanoTime() + Duration.ofSeconds(30).toNanos();
        while (System.nanoTime() < deadline) {
            try {
                String after = isolated.execInContainer("redis-cli", "-a", "local-test-only", "INFO", "server").getStdout();
                String oldRunId = before.lines().filter(line -> line.startsWith("run_id:")).findFirst().orElseThrow();
                boolean restarted = after.lines().anyMatch(line -> line.startsWith("run_id:") && !line.equals(oldRunId));
                recovered = restarted && revocations.isRevoked(token);
                if (recovered) break;
            }
            catch (org.springframework.dao.DataAccessException reconnecting) { /* wait for Redis */ }
            Thread.sleep(100);
        }
        assertThat(recovered).isTrue();
        isolated.getDockerClient().pauseContainerCmd(isolated.getContainerId()).exec();
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.add("Cookie", "jw_token=" + token);
            assertThat(rest.exchange("/api/auth/me", HttpMethod.GET, new HttpEntity<>(headers), String.class)
                    .getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        } finally {
            isolated.getDockerClient().unpauseContainerCmd(isolated.getContainerId()).exec();
        }
    }
}
