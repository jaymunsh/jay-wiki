package cloud.leneu.jaywiki.ops;

import java.time.Instant;
import java.util.List;

/**
 * 알림 드릴 화면이 받는 값. 실행은 ADMIN 만 하지만 이 조회는 공개다 —
 * 방문자가 "마지막으로 언제 돌았고 어떤 알림이 울렸어야 하는가"를 볼 수 있어야
 * 시연이 성립한다. HPA 리허설과 같은 경계다.
 */
public record AlertDrillView(
        List<Drill> drills,
        Recent recent,
        /** 실행 버튼을 그릴지. 관리자가 아니면 화면은 설명만 보여준다. */
        boolean canRun
) {
    public record Drill(String kind, String label, String detail, String alerts, int repeats) {}

    /** 마지막 실행 기록. 아무도 안 돌렸으면 null 이다. */
    public record Recent(String kind, String label, Instant at, int count) {}
}
