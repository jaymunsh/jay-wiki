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

/**
 * 배송 접수를 shipping-api 에 요청한다.
 *
 * 전에는 이 자리가 row 하나를 넣는 로컬 코드였다(OrderSagaSteps.requestShipping).
 * 분리 후에는 결제와 같은 원격 호출이라 타임아웃이 필수다 — 없으면 배송이 느려질 때
 * 요청 스레드가 잡히고, 보상 코드에 아예 도달하지 못한다.
 */
@Component
public class ShippingClient {
    private final RestClient restClient;
    private final MeterRegistry meterRegistry;

    public ShippingClient(ShippingServiceProperties properties, MeterRegistry meterRegistry, RestClient.Builder restClientBuilder) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(2));
        requestFactory.setReadTimeout(Duration.ofSeconds(5));
        this.restClient = restClientBuilder
                .baseUrl(properties.url().toString())
                .requestFactory(requestFactory)
                .build();
        this.meterRegistry = meterRegistry;
    }

    ShipmentResponse request(ShipmentRequest request) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String result = "error";
        try {
            ShipmentResponse response = requestRemote(request);
            result = "requested";
            return response;
        } catch (ShippingRequestFailedException e) {
            result = "failed";
            throw e;
        } finally {
            sample.stop(Timer.builder("jaywiki.shipping.client.request")
                    .tag("operation", "request")
                    .tag("result", result)
                    .register(meterRegistry));
        }
    }

    private ShipmentResponse requestRemote(ShipmentRequest request) {
        try {
            ResponseEntity<ShipmentResponse> entity = restClient.post()
                    .uri("/shipments/request")
                    .body(request)
                    .retrieve()
                    .toEntity(ShipmentResponse.class);
            ShipmentResponse body = entity.getBody();
            ShipmentResponse response = body == null ? null
                    : new ShipmentResponse(body.shipmentId(), body.status(),
                            entity.getHeaders().getFirst("X-Served-By"));
            meterRegistry.counter("jaywiki.shipping.client.requests",
                    "operation", "request", "result", "requested").increment();
            return response;
        } catch (HttpClientErrorException.Conflict e) {
            meterRegistry.counter("jaywiki.shipping.client.requests",
                    "operation", "request", "result", "failed").increment();
            throw new ShippingRequestFailedException(
                    e.getResponseHeaders() == null ? null : e.getResponseHeaders().getFirst("X-Served-By"));
        } catch (RestClientException e) {
            meterRegistry.counter("jaywiki.shipping.client.requests",
                    "operation", "request", "result", "error").increment();
            throw new ShippingServiceUnavailableException("shipping service unavailable", e);
        }
    }

    public record ShipmentRequest(
            @JsonProperty("orderId") String orderId,
            @JsonProperty("idempotencyKey") String idempotencyKey,
            @JsonProperty("fail") boolean fail
    ) {
    }

    /** servedBy 는 본문이 아니라 X-Served-By 헤더에서 온다. 역직렬화에서는 null 로 들어온다. */
    public record ShipmentResponse(String shipmentId, String status, String servedBy) {
    }
}
