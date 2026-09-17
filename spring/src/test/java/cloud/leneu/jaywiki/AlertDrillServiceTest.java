package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.common.BadRequestException;
import cloud.leneu.jaywiki.ops.AlertDrillKind;
import cloud.leneu.jaywiki.ops.AlertDrillService;
import cloud.leneu.jaywiki.ops.AlertDrillView;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 드릴이 내는 예외의 '종류'를 고정한다. 종류가 바뀌면 알림이 조용히 안 울린다 —
 * 예를 들어 500 드릴이 IllegalStateException 을 던지면 전역 핸들러가 409 로 매핑해
 * 5xx 규칙에 안 걸린다. 화면은 성공한 것처럼 보이고 알림만 안 온다.
 */
class AlertDrillServiceTest {
    private final AlertDrillService service = new AlertDrillService(Optional.empty());

    @Test
    void 오류_드릴은_어떤_핸들러도_안_잡는_예외를_던진다() {
        assertThatThrownBy(() -> service.run(AlertDrillKind.ERROR, true))
                .isInstanceOf(AlertDrillService.DrillFailure.class);
    }

    @Test
    void 잘못된_요청_드릴은_본문_파싱_실패로_낸다() {
        // 이 예외에서만 전역 핸들러가 로그 규칙이 읽는 줄을 찍는다.
        assertThatThrownBy(() -> service.run(AlertDrillKind.BAD_REQUEST, true))
                .isInstanceOf(HttpMessageNotReadableException.class);
    }

    @Test
    void 거절_드릴은_인가_거절로_낸다() {
        assertThatThrownBy(() -> service.run(AlertDrillKind.FORBIDDEN, true))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void kafka_데모가_꺼져_있으면_dlq_드릴은_사고가_아니라_설정으로_거절한다() {
        assertThatThrownBy(() -> service.run(AlertDrillKind.DLQ, true))
                .isInstanceOf(AlertDrillService.DrillUnavailable.class);
    }

    @Test
    void 예외로_끝나는_드릴도_기록에_남는다() {
        assertThatThrownBy(() -> service.run(AlertDrillKind.ERROR, true))
                .isInstanceOf(AlertDrillService.DrillFailure.class);

        AlertDrillView.Recent recent = service.view(false).recent();
        assertThat(recent).isNotNull();
        assertThat(recent.kind()).isEqualTo("ERROR");
        assertThat(recent.count()).isEqualTo(1);
    }

    @Test
    void 같은_드릴을_이어_돌리면_횟수가_쌓인다() {
        // 403 과 p95 는 여러 번 돌려야 울린다. 몇 번째인지 화면이 보여 줘야 한다.
        for (int i = 0; i < 3; i++) {
            assertThatThrownBy(() -> service.run(AlertDrillKind.FORBIDDEN, true))
                    .isInstanceOf(AccessDeniedException.class);
        }
        assertThat(service.view(false).recent().count()).isEqualTo(3);
    }

    @Test
    void 조회는_실행_권한을_그대로_싣는다() {
        assertThat(service.view(false).canRun()).isFalse();
        assertThat(service.view(true).canRun()).isTrue();
        assertThat(service.view(false).drills()).hasSize(AlertDrillKind.values().length);
    }

    @Test
    void 모르는_이름은_400_이다() {
        // 500 으로 떨어지면 오타 하나가 진짜 알림을 울린다.
        assertThatThrownBy(() -> AlertDrillKind.parse("nope"))
                .isInstanceOf(BadRequestException.class);
        assertThat(AlertDrillKind.parse("error")).isEqualTo(AlertDrillKind.ERROR);
    }
}
