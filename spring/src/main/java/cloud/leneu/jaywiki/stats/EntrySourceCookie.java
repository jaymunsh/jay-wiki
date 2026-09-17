package cloud.leneu.jaywiki.stats;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Arrays;

/**
 * 방문 첫 순간의 유입 호스트를 담아 두는 세션 쿠키.
 *
 * <p>왜 쿠키가 필요한가. 댓글 POST 의 Referer 는 그 글 자신이라, 그 시점엔 애초 어디서
 * 들어왔는지가 이미 사라져 있다. 그래서 첫 요청 때 호스트만 담아 두고 댓글을 쓸 때 꺼낸다.
 *
 * <p>담는 것은 호스트 문자열 하나뿐이다. 개인을 가리키는 식별자를 만들지 않으므로 방문
 * 경로를 이어 붙이거나 사람을 다시 알아보는 데 쓸 수 없다. 만료를 주지 않아 브라우저를
 * 닫으면 사라진다.
 *
 * <p>굽는 쪽은 Next 미들웨어({@code web/src/middleware.ts})다. 거기서 분류하지 않고
 * 호스트만 담는 이유는, 분류 규칙을 TypeScript 로 한 벌 더 두면 반드시 갈라지기 때문이다.
 * 분류는 이 패키지의 {@link Referrer} 만 한다.
 */
public final class EntrySourceCookie {

    /** 미들웨어와 이름을 맞춰야 한다. 한쪽만 바꾸면 값이 조용히 안 실린다. */
    public static final String NAME = "jw_src";

    /** 호스트 이름의 상한. 넘으면 우리가 심은 값이 아니므로 버린다. */
    private static final int MAX_LENGTH = 253;

    /**
     * Referer 가 아예 없었다는 표시(미들웨어의 NO_REFERER). 빈 값을 쓰지 않는 이유는
     * 쿠키가 있는지 없는지와 구별되지 않기 때문이다 -- 구별하지 못하면 직접 들어온 방문자가
     * 다음 화면으로 넘어갈 때 자기 호스트로 덮여 internal 로 잘못 남는다.
     */
    private static final String NO_REFERER = "-";

    private EntrySourceCookie() {
    }

    /**
     * 쿠키에 담긴 유입 호스트. 없으면 null 이고, 그때 {@link Referrer#ofHost} 는 direct 로 본다.
     *
     * <p>값은 방문자가 고칠 수 있으므로 믿지 않는다. 길이만 걸러 넘기고, 아는 도메인이
     * 아니면 어차피 other 로 떨어진다.
     */
    public static String read(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        return Arrays.stream(cookies)
                .filter(c -> NAME.equals(c.getName()))
                .map(Cookie::getValue)
                .filter(v -> v != null && !v.isBlank() && v.length() <= MAX_LENGTH)
                .filter(v -> !NO_REFERER.equals(v))
                .findFirst()
                .orElse(null);
    }
}
