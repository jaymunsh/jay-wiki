package cloud.leneu.jaywiki.ops;

/**
 * 일부러 낼 수 있는 오류의 종류. 알림 규칙에서 거꾸로 뽑았다 —
 * 규칙 열셋 중 애플리케이션이 만들 수 있는 것만 여기 있다.
 * 노드 메모리·디스크·백업 Job·pod 재시작·백엔드 다운은 앱이 만드는 사고가 아니라 뺐다.
 *
 * repeats 는 그 규칙이 울리는 데 필요한 요청 수다. 1이 아닌 것이 있는 이유는
 * 단발을 무시하도록 규칙을 그렇게 썼기 때문이다 — 403 은 남이 문을 두드리는 것과
 * 구분해야 하고, p95 는 한 번 느린 것으로 판단할 값이 아니다.
 * 이 값을 화면에 실어야 "한 번 눌렀는데 왜 안 오지"가 안 생긴다.
 */
public enum AlertDrillKind {
    ERROR("500 오류", "처리하지 못한 예외를 던진다. 지표와 로그 양쪽에 남는다.",
            "JaywikiApi5xxObserved · JaywikiApiErrorLogged", 1),
    BAD_REQUEST("400 잘못된 요청", "본문을 읽을 수 없는 요청으로 취급한다. 보낸 쪽 잘못이라 5xx 가 아니다.",
            "JaywikiApi400Observed · JaywikiApiErrorLogged", 1),
    FORBIDDEN("관리자 403", "관리자 경로에서 거절당한 요청을 만든다. 단발은 규칙이 무시한다.",
            "JaywikiAdminForbiddenSustained", 10),
    SLOW("느린 응답", "응답을 일부러 늦춘다. p95 는 2분 넘게 이어져야 판단한다.",
            "JaywikiApiP95High", 20),
    DLQ("Kafka DLQ", "주문 이벤트를 계속 실패시켜 DLQ 로 보낸다. 기존 Kafka 데모를 그대로 쓴다.",
            "JaywikiKafkaDlqObserved", 1);

    /** 모르는 이름은 400 으로 낸다. 500 으로 떨어지면 오타 하나가 진짜 알림을 울린다. */
    public static AlertDrillKind parse(String raw) {
        for (AlertDrillKind kind : values()) {
            if (kind.name().equalsIgnoreCase(raw)) {
                return kind;
            }
        }
        throw new cloud.leneu.jaywiki.common.BadRequestException("알 수 없는 드릴: " + raw);
    }

    private final String label;
    private final String detail;
    private final String alerts;
    private final int repeats;

    AlertDrillKind(String label, String detail, String alerts, int repeats) {
        this.label = label;
        this.detail = detail;
        this.alerts = alerts;
        this.repeats = repeats;
    }

    public String label() {
        return label;
    }

    public String detail() {
        return detail;
    }

    /** 이 드릴이 울리는 규칙 이름. 알림을 받았을 때 어느 드릴이었는지 맞춰 보는 용도다. */
    public String alerts() {
        return alerts;
    }

    public int repeats() {
        return repeats;
    }
}
