package cloud.leneu.jaywiki.blog.dto;

/**
 * 목록 한 페이지의 크기. 자유로운 정수를 받지 않는 이유는 하나다 --
 * `?size=100000` 이면 페이징이 통째로 무력해진다. 전체를 한 번에 안 주려고 넣은 장치인데
 * 크기를 열어 두면 그 문을 다시 여는 셈이다.
 *
 * 화면의 '10개씩 / 30개씩 / 50개씩 보기' 선택지와 서버의 허용값이 여기 한 자리에서 온다.
 * 선택지를 늘릴 때 고칠 곳도 여기뿐이다.
 */
public enum BlogPageSize {
    TEN(10),
    THIRTY(30),
    FIFTY(50);

    /** 화면이 크기를 안 보내던 시절과 같은 값. 기본이 바뀌면 페이저가 그려지는 지점도 바뀐다. */
    public static final BlogPageSize DEFAULT = THIRTY;

    private final int value;

    BlogPageSize(int value) {
        this.value = value;
    }

    public int value() {
        return value;
    }

    /**
     * 허용 목록에 없는 값은 기본값으로 떨어뜨린다. 400 을 내지 않는 이유는,
     * 주소창의 size 를 손으로 고친 방문자에게 오류 화면을 보여 줄 이유가 없어서다.
     */
    public static BlogPageSize of(Integer raw) {
        if (raw == null) return DEFAULT;
        for (BlogPageSize candidate : values()) {
            if (candidate.value == raw) return candidate;
        }
        return DEFAULT;
    }
}
