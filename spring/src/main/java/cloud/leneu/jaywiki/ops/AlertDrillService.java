package cloud.leneu.jaywiki.ops;

import cloud.leneu.jaywiki.kafka.KafkaDemoCreateOrderRequest;
import cloud.leneu.jaywiki.kafka.KafkaDemoFailMode;
import cloud.leneu.jaywiki.kafka.KafkaDemoOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 알림 체계가 도는지 확인하려고 오류를 일부러 낸다.
 *
 * 왜 필요한가 — 규칙을 쓰고 문구를 다듬어도 그것이 실제로 휴대폰까지 가는지는
 * 사고가 한 번 나기 전까지 알 수 없다. 실제로 500 이 났는데 알림이 안 온 적이 있고
 * (silent-500-alert-gap), 그때는 사고가 알려 줬다. 사고가 알려 주기 전에 알아야 한다.
 *
 * 왜 ADMIN 인가 — 부하 때문이 아니다. 예외 하나 던지는 것이라 제일 가볍다.
 * 알림은 되돌릴 수 없고 사람을 깨우며, 5xx 지표는 운영 판단에 쓰는 숫자다.
 * 둘 다 아무나 건드리면 안 되는 것이고 부하와는 다른 축이다.
 *
 * ponytail: 마지막 실행 기록을 메모리에 든다. 파드가 하나이고 재시작하면 사라져도
 * 곤란하지 않은 값이라 표를 만들지 않았다. 파드가 늘면 그때 옮긴다.
 */
@Service
@RequiredArgsConstructor
public class AlertDrillService {
    /** 느린 응답 드릴이 잡아 두는 시간. p95 문턱(500ms)보다 넉넉히 위여야 한다. */
    private static final long SLOW_MILLIS = 1_500;

    /** Kafka 데모는 꺼 둘 수 있다(app.kafka-demo.enabled). 없으면 이 드릴만 못 돈다. */
    private final Optional<KafkaDemoOrderService> kafkaDemo;
    private final AtomicReference<AlertDrillView.Recent> recent = new AtomicReference<>();

    public AlertDrillView view(boolean isAdmin) {
        List<AlertDrillView.Drill> drills = Arrays.stream(AlertDrillKind.values())
                .map(kind -> new AlertDrillView.Drill(
                        kind.name(), kind.label(), kind.detail(), kind.alerts(), kind.repeats()))
                .toList();
        return new AlertDrillView(drills, recent.get(), isAdmin);
    }

    /**
     * 드릴 하나를 돌린다. 세 종류는 예외로 끝나므로 기록을 먼저 남긴다 —
     * 나중에 남기면 실제로 돈 드릴이 기록에 안 남는다.
     */
    public AlertDrillView run(AlertDrillKind kind, boolean isAdmin) {
        record(kind);
        switch (kind) {
            // IllegalStateException 을 쓰면 안 된다. 전역 핸들러가 그것을 409 로 매핑해서
            // 5xx 규칙에 안 걸린다. 아무 핸들러도 안 잡는 예외여야 500 으로 떨어진다.
            case ERROR -> throw new DrillFailure("알림 드릴이 일부러 낸 오류");
            case BAD_REQUEST -> throw unreadableBody();
            case FORBIDDEN -> throw new AccessDeniedException("알림 드릴이 일부러 낸 거절");
            case SLOW -> sleep();
            case DLQ -> sendToDlq();
        }
        return view(isAdmin);
    }

    private void record(AlertDrillKind kind) {
        recent.updateAndGet(previous -> {
            int count = previous != null && previous.kind().equals(kind.name()) ? previous.count() + 1 : 1;
            return new AlertDrillView.Recent(kind.name(), kind.label(), Instant.now(), count);
        });
    }

    private void sleep() {
        try {
            Thread.sleep(SLOW_MILLIS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void sendToDlq() {
        KafkaDemoOrderService service = kafkaDemo.orElseThrow(
                () -> new DrillUnavailable("Kafka 데모가 꺼져 있어 DLQ 드릴을 돌릴 수 없습니다."));
        // 새로 만들지 않는다. 데모에 이미 '계속 실패시켜 DLQ 로 보내는' 옵션이 있다.
        service.create(new KafkaDemoCreateOrderRequest("DRILL-DLQ", 1, KafkaDemoFailMode.NOTIFICATION_ALWAYS_FAIL));
    }

    /**
     * 본문 파싱 실패를 그대로 흉내 낸다. 전역 핸들러가 이 예외에서만
     * "unreadable request body status=400" 한 줄을 찍고, Loki 규칙이 그 줄을 읽는다.
     * 다른 400(BadRequestException)으로 내면 지표는 올라도 로그 알림이 안 붙는다.
     */
    private static HttpMessageNotReadableException unreadableBody() {
        HttpInputMessage empty = new HttpInputMessage() {
            @Override
            public InputStream getBody() {
                return InputStream.nullInputStream();
            }

            @Override
            public HttpHeaders getHeaders() {
                return new HttpHeaders();
            }
        };
        return new HttpMessageNotReadableException("알림 드릴이 일부러 만든 읽을 수 없는 본문", empty);
    }

    /** 어떤 핸들러도 안 잡는 예외. 전역 핸들러의 마지막 갈래로 떨어져 500 이 된다. */
    public static class DrillFailure extends RuntimeException {
        public DrillFailure(String message) {
            super(message);
        }
    }

    /** 드릴을 돌릴 수 없는 상태. 이건 사고가 아니라 설정이라 500 으로 내지 않는다. */
    public static class DrillUnavailable extends RuntimeException {
        public DrillUnavailable(String message) {
            super(message);
        }
    }
}
