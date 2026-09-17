package cloud.leneu.jaywiki.stats;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/** 쿠키 값은 방문자가 고칠 수 있다. 믿지 않고 길이만 걸러 넘긴다. */
class EntrySourceCookieTest {

    private MockHttpServletRequest requestWith(Cookie... cookies) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(cookies);
        return request;
    }

    @Test
    void 쿠키가_없으면_null_이다() {
        assertThat(EntrySourceCookie.read(new MockHttpServletRequest())).isNull();
    }

    @Test
    void 유입_호스트를_꺼낸다() {
        assertThat(EntrySourceCookie.read(requestWith(
                new Cookie("jw_token", "x"), new Cookie("jw_src", "www.google.com"))))
                .isEqualTo("www.google.com");
    }

    @Test
    void 빈_값과_지나치게_긴_값은_버린다() {
        assertThat(EntrySourceCookie.read(requestWith(new Cookie("jw_src", "")))).isNull();
        assertThat(EntrySourceCookie.read(requestWith(new Cookie("jw_src", "a".repeat(254))))).isNull();
    }

    @Test
    void 꺼낸_값이_분류를_거치면_소스가_된다() {
        String host = EntrySourceCookie.read(requestWith(new Cookie("jw_src", "x.com")));
        assertThat(Referrer.ofHost(host).source()).isEqualTo("sns:x");
    }
}
