package cloud.leneu.jaywiki.domainlab;

import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

public class PartnerApiClient {
    private final WebClient webClient;
    private final String callbackUrl;

    public PartnerApiClient(WebClient webClient, String callbackUrl) {
        this.webClient = webClient;
        this.callbackUrl = callbackUrl;
    }

    public Result execute(String correlationId, String mode) {
        long startedAt = System.nanoTime();
        AtomicInteger attempts = new AtomicInteger();
        int maximumAttempts = "SERVER_ERROR".equals(mode) ? 3 : "RATE_LIMIT".equals(mode) ? 2 : 1;
        Response response = null;
        for (int attempt = 1; attempt <= maximumAttempts; attempt++) {
            attempts.incrementAndGet();
            response = invoke(correlationId, mode).block(Duration.ofSeconds(4));
            if (response == null || response.statusCode() < 400) break;
            if (response.statusCode() != 429 && response.statusCode() < 500) break;
            if (response.statusCode() == 429) pause(response.retryAfterMs());
        }
        long elapsedMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
        if (response == null || response.timeout()) {
            return new Result(Status.TIMEOUT, attempts.get(), 0, elapsedMs);
        }
        if (response.statusCode() == 200) {
            Status status = attempts.get() > 1 ? Status.APPROVED_AFTER_RETRY : Status.APPROVED;
            return new Result(status, attempts.get(), 200, elapsedMs);
        }
        return new Result(Status.RETRY_EXHAUSTED, attempts.get(), response.statusCode(), elapsedMs);
    }

    private Mono<Response> invoke(String correlationId, String mode) {
        ApprovalRequest request = new ApprovalRequest(correlationId, callbackUrl);
        return webClient.post()
                .uri(builder -> builder.path("/partner/approve").queryParam("mode", mode).build())
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Correlation-ID", correlationId)
                .bodyValue(request)
                .exchangeToMono(response -> {
                    String retryAfter = response.headers().asHttpHeaders().getFirst("Retry-After");
                    long retryAfterMs = retryAfter == null ? 0 : Long.parseLong(retryAfter) * 1_000;
                    return response.releaseBody()
                            .thenReturn(new Response(response.statusCode().value(), false, retryAfterMs));
                })
                .onErrorResume(error -> Mono.just(new Response(0, true, 0)));
    }

    private void pause(long delayMs) {
        if (delayMs <= 0) return;
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        }
    }

    public enum Status {
        APPROVED,
        APPROVED_AFTER_RETRY,
        TIMEOUT,
        RETRY_EXHAUSTED
    }

    public record Result(Status status, int attempts, int httpStatus, long elapsedMs) {
    }

    private record ApprovalRequest(String correlationId, String callbackUrl) {
    }

    private record Response(int statusCode, boolean timeout, long retryAfterMs) {
    }
}
