package cloud.leneu.jaywiki.domainlab;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class PartnerApiClientTest {
    private HttpServer server;
    private String baseUrl;

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void execute_returns_approved_when_partner_responds_normally() {
        server.createContext("/partner/approve", exchange -> respond(exchange, 200,
                "{\"correlationId\":\"corr-normal\",\"status\":\"APPROVED\"}"));
        PartnerApiClient client = client();

        PartnerApiClient.Result result = client.execute("corr-normal", "NORMAL");

        assertThat(result.status()).isEqualTo(PartnerApiClient.Status.APPROVED);
        assertThat(result.attempts()).isEqualTo(1);
        assertThat(result.httpStatus()).isEqualTo(200);
    }

    @Test
    void execute_retries_once_when_partner_returns_rate_limit() {
        AtomicInteger attempts = new AtomicInteger();
        server.createContext("/partner/approve", exchange -> {
            if (attempts.incrementAndGet() == 1) {
                exchange.getResponseHeaders().add("Retry-After", "0");
                respond(exchange, 429, "{\"detail\":\"rate limited\"}");
                return;
            }
            respond(exchange, 200,
                    "{\"correlationId\":\"corr-rate\",\"status\":\"APPROVED\"}");
        });
        PartnerApiClient client = client();

        PartnerApiClient.Result result = client.execute("corr-rate", "RATE_LIMIT");

        assertThat(result.status()).isEqualTo(PartnerApiClient.Status.APPROVED_AFTER_RETRY);
        assertThat(result.attempts()).isEqualTo(2);
        assertThat(attempts).hasValue(2);
    }

    @Test
    void execute_stops_after_bounded_retries_when_partner_returns_500() {
        AtomicInteger attempts = new AtomicInteger();
        server.createContext("/partner/approve", exchange -> {
            attempts.incrementAndGet();
            respond(exchange, 500, "{\"detail\":\"server error\"}");
        });
        PartnerApiClient client = client();

        PartnerApiClient.Result result = client.execute("corr-server", "SERVER_ERROR");

        assertThat(result.status()).isEqualTo(PartnerApiClient.Status.RETRY_EXHAUSTED);
        assertThat(result.attempts()).isEqualTo(3);
        assertThat(attempts).hasValue(3);
    }

    private PartnerApiClient client() {
        PartnerWebClientFactory factory = new PartnerWebClientFactory(Duration.ofMillis(300));
        return new PartnerApiClient(factory.create(baseUrl), baseUrl + "/callback");
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] payload = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("content-type", "application/json");
        exchange.sendResponseHeaders(status, payload.length);
        exchange.getResponseBody().write(payload);
        exchange.close();
    }
}
