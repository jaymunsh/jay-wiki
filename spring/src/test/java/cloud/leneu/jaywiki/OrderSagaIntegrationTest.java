package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.saga.SagaInstance;
import cloud.leneu.jaywiki.saga.SagaInstanceRepository;
import com.sun.net.httpserver.HttpExchange;
import io.micrometer.core.instrument.MeterRegistry;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static java.util.Map.entry;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"app.opensearch.enabled=false"})
@Import(TestcontainersConfiguration.class)
class OrderSagaIntegrationTest {

    private static final PaymentParticipantFake PAYMENT_FAKE = PaymentParticipantFake.start();
    private static final ShippingParticipantFake SHIPPING_FAKE = ShippingParticipantFake.start();
    private static final ParameterizedTypeReference<Map<String, Object>> MAP =
            new ParameterizedTypeReference<>() {};

    @Autowired
    TestRestTemplate rest;

    @Autowired
    MeterRegistry meterRegistry;

    @Autowired
    SagaInstanceRepository sagaRepo;

    @DynamicPropertySource
    static void participantProperties(DynamicPropertyRegistry registry) {
        registry.add("app.payment-service.url", PAYMENT_FAKE::baseUrl);
        registry.add("app.shipping-service.url", SHIPPING_FAKE::baseUrl);
    }

    @BeforeEach
    void resetFake() {
        PAYMENT_FAKE.reset();
        SHIPPING_FAKE.reset();
    }

    @AfterAll
    static void stopFake() {
        PAYMENT_FAKE.stop();
        SHIPPING_FAKE.stop();
    }

    @Test
    void 성공하면_FastAPI_결제참여자를_호출하고_주문을_확정한다() {
        ResponseEntity<Map<String, Object>> response = runSaga("NONE", uniqueKey("success"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(body.get("status")).isEqualTo("CONFIRMED");
        assertThat(stepNames(body)).containsExactly(
                "ORDER_CREATED",
                "INVENTORY_RESERVED",
                "PAYMENT_AUTHORIZED",
                "SHIPPING_REQUESTED",
                "ORDER_CONFIRMED");
        assertThat(PAYMENT_FAKE.authorizeCalls()).isEqualTo(1);
        assertThat(PAYMENT_FAKE.cancelCalls()).isZero();
        // 배송도 원격 호출이 됐다(5단계). 전에는 여기가 로컬 row 하나였다.
        assertThat(SHIPPING_FAKE.requestCalls()).isEqualTo(1);
    }

    @Test
    void 배송실패는_결제취소와_재고보상을_실행한다() {
        ResponseEntity<Map<String, Object>> response = runSaga("SHIPPING_REQUEST", uniqueKey("shipping-fail"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(body.get("status")).isEqualTo("FAILED");
        assertThat(stepNames(body)).containsExactly(
                "ORDER_CREATED",
                "INVENTORY_RESERVED",
                "PAYMENT_AUTHORIZED",
                "SHIPPING_REQUESTED",
                "PAYMENT_CANCELLED",
                "INVENTORY_RELEASED",
                "ORDER_FAILED");
        assertThat(PAYMENT_FAKE.authorizeCalls()).isEqualTo(1);
        assertThat(PAYMENT_FAKE.cancelCalls()).isEqualTo(1);
        // 실패 주입은 shipping-api 가 409 로 낸다. 모놀리스가 자기 안에서 판단하지 않는다.
        assertThat(SHIPPING_FAKE.requestCalls()).isEqualTo(1);
        // 참여자가 처리한 단계에는 그쪽 파드가 적힌다. 거절한 단계(409)도 마찬가지다.
        assertThat(stepActors(body)).containsExactly(
                entry("ORDER_CREATED", "spring@local"),
                entry("INVENTORY_RESERVED", "spring@local"),
                entry("PAYMENT_AUTHORIZED", "payment-api@fake"),
                entry("SHIPPING_REQUESTED", "shipping-api@fake"),
                entry("PAYMENT_CANCELLED", "payment-api@fake"),
                entry("INVENTORY_RELEASED", "spring@local"),
                entry("ORDER_FAILED", "spring@local"));
    }

    @Test
    void 결제실패는_재고보상만_실행하고_결제취소는_호출하지_않는다() {
        ResponseEntity<Map<String, Object>> response = runSaga("PAYMENT_AUTHORIZE", uniqueKey("payment-fail"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(body.get("status")).isEqualTo("FAILED");
        assertThat(stepNames(body)).containsExactly(
                "ORDER_CREATED",
                "INVENTORY_RESERVED",
                "PAYMENT_AUTHORIZED",
                "INVENTORY_RELEASED",
                "ORDER_FAILED");
        assertThat(PAYMENT_FAKE.authorizeCalls()).isEqualTo(1);
        assertThat(PAYMENT_FAKE.cancelCalls()).isZero();
        // 결제에서 끝났으니 배송은 아예 안 부른다.
        assertThat(SHIPPING_FAKE.requestCalls()).isZero();
    }

    @Test
    void 같은_idempotency_key는_동일한_Saga를_반환한다() {
        String idempotencyKey = uniqueKey("idem");

        ResponseEntity<Map<String, Object>> first = runSaga("NONE", idempotencyKey);
        ResponseEntity<Map<String, Object>> second = runSaga("NONE", idempotencyKey);

        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(second.getBody().get("sagaId")).isEqualTo(first.getBody().get("sagaId"));
        assertThat(second.getBody().get("orderId")).isEqualTo(first.getBody().get("orderId"));
        assertThat(PAYMENT_FAKE.authorizeCalls()).isEqualTo(1);
    }

    private String uniqueKey(String prefix) {
        return "test-" + prefix + "-" + UUID.randomUUID();
    }

    @Test
    void 구매자를_붙이면_주문에_이름과_등급이_따라온다() {
        ResponseEntity<Map<String, Object>> response = runSagaAs("cus_bora", "NONE", uniqueKey("with-customer"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = response.getBody();
        assertThat(body).isNotNull();
        @SuppressWarnings("unchecked")
        Map<String, Object> customer = (Map<String, Object>) body.get("customer");
        assertThat(customer).containsEntry("id", "cus_bora").containsEntry("grade", "SILVER");
        // 이름은 모놀리스가 붙인다. 분리 뒤에도 결제·배송은 id 만 알아서 이 조립이 계속 여기 남는다.
        assertThat(customer).containsKey("name");
    }

    @Test
    void 구매자를_안_보내면_구매자_없이_주문이_만들어진다() {
        ResponseEntity<Map<String, Object>> response = runSaga("NONE", uniqueKey("no-customer"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("customer")).isNull();
    }

    @Test
    void 없는_구매자를_보내면_조용히_넘기지_않고_404_를_낸다() {
        ResponseEntity<Map<String, Object>> response = runSagaAs("cus_nope", "NONE", uniqueKey("bad-customer"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void 구매자_목록은_시드된_다섯_명이다() {
        ResponseEntity<List<Map<String, Object>>> response = rest.exchange(
                "/api/saga/customers", HttpMethod.GET, null,
                new ParameterizedTypeReference<List<Map<String, Object>>>() {});

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(5);
    }

    @Test
    void 결제서비스에_못_닿으면_503_을_내고_재고를_되돌린다() {
        PAYMENT_FAKE.goDown();

        ResponseEntity<Map<String, Object>> response = runSaga("NONE", uniqueKey("payment-down"));

        // 거절(409)은 200 + FAILED 뷰지만, 서비스 다운은 인프라 장애라 503 이다.
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        // 접수됐는지는 몰라도 이 주문이 완료되지 않은 것은 확실하니 재고는 풀려야 한다.
        assertThat(reservedNow()).isZero();

        Map<String, Object> saga = newestSaga();
        assertThat(saga.get("status")).isEqualTo("FAILED");
        assertThat(stepNames(saga)).containsExactly(
                "ORDER_CREATED",
                "INVENTORY_RESERVED",
                "PAYMENT_AUTHORIZED",
                "INVENTORY_RELEASED",
                "ORDER_FAILED");
        // 결제에서 끊겼으니 배송은 안 부른다.
        assertThat(SHIPPING_FAKE.requestCalls()).isZero();
    }

    @Test
    void 배송서비스에_못_닿으면_결제를_취소하고_재고를_되돌린다() {
        SHIPPING_FAKE.goDown();

        ResponseEntity<Map<String, Object>> response = runSaga("NONE", uniqueKey("shipping-down"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(reservedNow()).isZero();
        // 배송 접수 여부는 몰라도 결제가 잡힌 것은 확실하다. 그건 되돌린다.
        assertThat(PAYMENT_FAKE.cancelCalls()).isEqualTo(1);

        assertThat(stepNames(newestSaga())).containsExactly(
                "ORDER_CREATED",
                "INVENTORY_RESERVED",
                "PAYMENT_AUTHORIZED",
                "SHIPPING_REQUESTED",
                "INVENTORY_RELEASED",
                "ORDER_FAILED");
    }

    @Test
    void 보상중_결제취소까지_실패해도_재고는_되돌린다() {
        // 배송만 내린다. 결제 승인은 받아야 그 뒤의 취소 경로를 지난다.
        SHIPPING_FAKE.goDown();

        ResponseEntity<Map<String, Object>> response = rest.exchange(
                "/api/saga/orders",
                HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "productCode", "JAY-HOODIE",
                        "quantity", 1,
                        "failAt", "NONE",
                        "idempotencyKey", uniqueKey("both-down"))),
                MAP);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        // 결제 취소가 되든 안 되든 재고는 풀린다 -- 되돌릴 수 있는 것마저 안 되돌리면 안 된다.
        assertThat(reservedNow()).isZero();
    }

    /**
     * 보상이 끝난 뒤의 예약 재고. 사가 뷰가 그대로 들고 있어서 따로 엔드포인트를 안 만든다.
     * 사가가 끝났으면(확정이든 보상이든) 이 값은 0 이어야 한다 -- 그게 이 테스트들이 지키는 불변식이다.
     */
    @SuppressWarnings("unchecked")
    private int reservedNow() {
        Map<String, Object> inventory =
                (Map<String, Object>) newestSaga().get("inventory");
        return (int) inventory.get("reserved");
    }

    private Map<String, Object> newestSaga() {
        ResponseEntity<List<Map<String, Object>>> response = rest.exchange(
                "/api/saga/orders?size=1",
                HttpMethod.GET,
                null,
                new ParameterizedTypeReference<>() {});
        return response.getBody().get(0);
    }

    private ResponseEntity<Map<String, Object>> runSagaAs(String customerId, String failAt, String idempotencyKey) {
        return rest.exchange(
                "/api/saga/orders",
                HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "customerId", customerId,
                        "productCode", "JAY-HOODIE",
                        "quantity", 1,
                        "failAt", failAt,
                        "idempotencyKey", idempotencyKey)),
                MAP);
    }

    private ResponseEntity<Map<String, Object>> runSaga(String failAt, String idempotencyKey) {
        return rest.exchange(
                "/api/saga/orders",
                HttpMethod.POST,
                new HttpEntity<>(Map.of(
                        "productCode", "JAY-HOODIE",
                        "quantity", 1,
                        "failAt", failAt,
                        "idempotencyKey", idempotencyKey)),
                MAP);
    }

    /**
     * 이어받지 못한 사가를 세는 게이지. 오래된 STARTED 만 세고 방금 것은 안 센다 --
     * 그 경계가 무너지면 정상 사가가 도는 동안 알림이 울린다.
     */
    @Test
    void countsOnlyStaleStartedSagas() {
        double before = orphanedGauge();

        sagaRepo.save(startedSagaCreatedAt(OffsetDateTime.now()));
        assertThat(orphanedGauge()).isEqualTo(before);

        sagaRepo.save(startedSagaCreatedAt(OffsetDateTime.now().minusMinutes(11)));
        assertThat(orphanedGauge()).isEqualTo(before + 1);
    }

    private double orphanedGauge() {
        return meterRegistry.get("jaywiki.saga.orphaned").gauge().value();
    }

    private SagaInstance startedSagaCreatedAt(OffsetDateTime createdAt) {
        SagaInstance saga = new SagaInstance();
        saga.setId("saga_" + UUID.randomUUID().toString().replace("-", ""));
        saga.setOrderId("ord_" + UUID.randomUUID().toString().replace("-", ""));
        saga.setStatus("STARTED");
        saga.setCurrentStep("ORDER_CREATED");
        saga.setFailAt("NONE");
        saga.setCreatedAt(createdAt);
        return saga;
    }

    @SuppressWarnings("unchecked")
    private List<Map.Entry<String, String>> stepActors(Map<String, Object> body) {
        List<Map<String, Object>> steps = (List<Map<String, Object>>) body.get("steps");
        return steps.stream()
                .map(step -> entry((String) step.get("name"), (String) step.get("actor")))
                .toList();
    }

    @SuppressWarnings("unchecked")
    private List<String> stepNames(Map<String, Object> body) {
        List<Map<String, Object>> steps = (List<Map<String, Object>>) body.get("steps");
        return steps.stream().map(step -> (String) step.get("name")).toList();
    }

    /** payment 쪽과 같은 모양의 가짜다. 취소가 없는 것만 다르다 -- 배송은 사가의 마지막 단계다. */
    private static final class ShippingParticipantFake {
        private static final String SERVED_BY = "shipping-api@fake";
        private final HttpServer server;
        private final AtomicInteger requestCalls = new AtomicInteger();
        private final AtomicBoolean down = new AtomicBoolean();

        private ShippingParticipantFake(HttpServer server) {
            this.server = server;
        }

        static ShippingParticipantFake start() {
            try {
                HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
                ShippingParticipantFake fake = new ShippingParticipantFake(server);
                server.createContext("/shipments/request", fake::request);
                server.start();
                return fake;
            } catch (IOException e) {
                throw new IllegalStateException("shipping fake server failed to start", e);
            }
        }

        String baseUrl() {
            return "http://127.0.0.1:" + server.getAddress().getPort();
        }

        int requestCalls() {
            return requestCalls.get();
        }

        void reset() {
            requestCalls.set(0);
            down.set(false);
        }

        void goDown() {
            down.set(true);
        }

        void stop() {
            server.stop(0);
        }

        private void request(HttpExchange exchange) throws IOException {
            requestCalls.incrementAndGet();
            if (down.get()) {
                writeJson(exchange, 503, """
                        {"detail":"shipping service unavailable"}
                        """);
                return;
            }
            String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            if (requestBody.contains("\"fail\":true")) {
                writeJson(exchange, 409, """
                        {"detail":"shipping request failed"}
                        """);
                return;
            }
            writeJson(exchange, 200, """
                    {"shipmentId":"ship_test","status":"REQUESTED"}
                    """);
        }

        private void writeJson(HttpExchange exchange, int status, String body) throws IOException {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("content-type", "application/json");
            // 실물 참여자가 붙이는 헤더다. 사가는 이 값을 단계의 actor 로 적는다.
            exchange.getResponseHeaders().set("X-Served-By", SERVED_BY);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        }
    }

    private static final class PaymentParticipantFake {
        private static final String SERVED_BY = "payment-api@fake";
        private final HttpServer server;
        private final AtomicInteger authorizeCalls = new AtomicInteger();
        private final AtomicInteger cancelCalls = new AtomicInteger();
        /** 서비스 자체가 안 뜬 상태. 409(거절)와 달리 503 이 나가고 사가는 다른 길로 간다. */
        private final AtomicBoolean down = new AtomicBoolean();

        private PaymentParticipantFake(HttpServer server) {
            this.server = server;
        }

        static PaymentParticipantFake start() {
            try {
                HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
                PaymentParticipantFake fake = new PaymentParticipantFake(server);
                server.createContext("/payments/authorize", fake::authorize);
                server.createContext("/payments/pay_test/cancel", fake::cancel);
                server.start();
                return fake;
            } catch (IOException e) {
                throw new IllegalStateException("payment fake server failed to start", e);
            }
        }

        String baseUrl() {
            return "http://127.0.0.1:" + server.getAddress().getPort();
        }

        int authorizeCalls() {
            return authorizeCalls.get();
        }

        int cancelCalls() {
            return cancelCalls.get();
        }

        void reset() {
            authorizeCalls.set(0);
            cancelCalls.set(0);
            down.set(false);
        }

        void goDown() {
            down.set(true);
        }

        void stop() {
            server.stop(0);
        }

        private void authorize(HttpExchange exchange) throws IOException {
            authorizeCalls.incrementAndGet();
            if (down.get()) {
                writeJson(exchange, 503, """
                        {"detail":"payment service unavailable"}
                        """);
                return;
            }
            String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            if (requestBody.contains("\"fail\":true")) {
                writeJson(exchange, 409, """
                        {"detail":"payment authorization failed"}
                        """);
                return;
            }
            writeJson(exchange, 200, """
                    {"paymentId":"pay_test","status":"AUTHORIZED"}
                    """);
        }

        private void cancel(HttpExchange exchange) throws IOException {
            cancelCalls.incrementAndGet();
            if (down.get()) {
                writeJson(exchange, 503, """
                        {"detail":"payment service unavailable"}
                        """);
                return;
            }
            writeJson(exchange, 200, """
                    {"paymentId":"pay_test","status":"CANCELLED"}
                    """);
        }

        private void writeJson(HttpExchange exchange, int status, String body) throws IOException {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("content-type", "application/json");
            // 실물 참여자가 붙이는 헤더다. 사가는 이 값을 단계의 actor 로 적는다.
            exchange.getResponseHeaders().set("X-Served-By", SERVED_BY);
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        }
    }
}
