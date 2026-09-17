package cloud.leneu.jaywiki.saga;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;

@Component
public class PaymentClient {
    private final RestClient restClient;
    private final MeterRegistry meterRegistry;

    public PaymentClient(PaymentServiceProperties properties, MeterRegistry meterRegistry, RestClient.Builder restClientBuilder) {
        // Saga 순방향의 동기 결제 호출 — payment-api가 멈추면 요청 스레드가 잡히므로 타임아웃 필수
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(2));
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        this.restClient = restClientBuilder
                .baseUrl(properties.url().toString())
                .requestFactory(requestFactory)
                .build();
        this.meterRegistry = meterRegistry;
    }

    PaymentAuthorizeResponse authorize(PaymentAuthorizeRequest request) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String result = "error";
        try {
            PaymentAuthorizeResponse response = authorizeRemote(request);
            result = "authorized";
            return response;
        } catch (PaymentAuthorizationFailedException e) {
            result = "failed";
            throw e;
        } finally {
            sample.stop(Timer.builder("jaywiki.payment.client.request")
                    .tag("operation", "authorize")
                    .tag("result", result)
                    .register(meterRegistry));
        }
    }

    PaymentCancelResponse cancel(String paymentId) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String result = "error";
        try {
            PaymentCancelResponse response = cancelRemote(paymentId);
            result = "cancelled";
            return response;
        } finally {
            sample.stop(Timer.builder("jaywiki.payment.client.request")
                    .tag("operation", "cancel")
                    .tag("result", result)
                    .register(meterRegistry));
        }
    }

    private PaymentAuthorizeResponse authorizeRemote(PaymentAuthorizeRequest request) {
        try {
            ResponseEntity<PaymentAuthorizeResponse> entity = restClient.post()
                    .uri("/payments/authorize")
                    .body(request)
                    .retrieve()
                    .toEntity(PaymentAuthorizeResponse.class);
            PaymentAuthorizeResponse response = withServedBy(entity);
            meterRegistry.counter("jaywiki.payment.client.requests",
                    "operation", "authorize", "result", "authorized").increment();
            return response;
        } catch (HttpClientErrorException.Conflict e) {
            meterRegistry.counter("jaywiki.payment.client.requests",
                    "operation", "authorize", "result", "failed").increment();
            throw new PaymentAuthorizationFailedException(servedBy(e));
        } catch (RestClientException e) {
            meterRegistry.counter("jaywiki.payment.client.requests",
                    "operation", "authorize", "result", "error").increment();
            throw new PaymentServiceUnavailableException("payment service unavailable", e);
        }
    }

    private PaymentCancelResponse cancelRemote(String paymentId) {
        try {
            ResponseEntity<PaymentCancelResponse> entity = restClient.post()
                    .uri("/payments/{paymentId}/cancel", paymentId)
                    .retrieve()
                    .toEntity(PaymentCancelResponse.class);
            PaymentCancelResponse body = entity.getBody();
            PaymentCancelResponse response = body == null ? null
                    : new PaymentCancelResponse(body.paymentId(), body.status(), servedBy(entity));
            meterRegistry.counter("jaywiki.payment.client.requests",
                    "operation", "cancel", "result", "cancelled").increment();
            return response;
        } catch (RestClientException e) {
            meterRegistry.counter("jaywiki.payment.client.requests",
                    "operation", "cancel", "result", "error").increment();
            throw new PaymentServiceUnavailableException("payment cancellation unavailable", e);
        }
    }

    public record PaymentAuthorizeRequest(
            @JsonProperty("orderId") String orderId,
            @JsonProperty("amountCents") int amountCents,
            @JsonProperty("idempotencyKey") String idempotencyKey,
            @JsonProperty("fail") boolean fail
    ) {
    }

    /**
     * servedBy 는 응답 본문이 아니라 X-Served-By 헤더에서 온다. 엔드포인트마다 응답 모델을
     * 고치지 않으려고 헤더에 뒀고, 그래서 역직렬화에서는 항상 null 로 들어온다.
     */
    public record PaymentAuthorizeResponse(String paymentId, String status, String servedBy) {
    }

    public record PaymentCancelResponse(String paymentId, String status, String servedBy) {
    }

    private static PaymentAuthorizeResponse withServedBy(ResponseEntity<PaymentAuthorizeResponse> entity) {
        PaymentAuthorizeResponse body = entity.getBody();
        return body == null ? null
                : new PaymentAuthorizeResponse(body.paymentId(), body.status(), servedBy(entity));
    }

    private static String servedBy(ResponseEntity<?> entity) {
        return entity.getHeaders().getFirst("X-Served-By");
    }

    private static String servedBy(HttpClientErrorException e) {
        return e.getResponseHeaders() == null ? null : e.getResponseHeaders().getFirst("X-Served-By");
    }
}
