package cloud.leneu.jaywiki.common;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cloudflare Tunnel 뒤라서 remoteAddr 는 프록시 주소다.
 * cf-connecting-ip 를 먼저 보지 않으면 모든 요청이 같은 IP 로 보인다.
 */
class ClientIpResolverTest {

    @Test
    void cf_connecting_ip_가_가장_우선이다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("cf-connecting-ip", "121.135.1.2");
        request.addHeader("x-forwarded-for", "10.0.0.1, 10.0.0.2");
        request.setRemoteAddr("172.16.0.1");

        assertThat(ClientIpResolver.resolve(request)).isEqualTo("121.135.1.2");
    }

    @Test
    void cf_헤더가_없으면_x_forwarded_for_의_첫_값을_쓴다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("x-forwarded-for", "203.0.113.7, 10.0.0.2");
        request.setRemoteAddr("172.16.0.1");

        assertThat(ClientIpResolver.resolve(request)).isEqualTo("203.0.113.7");
    }

    @Test
    void 헤더가_없으면_remoteAddr_로_떨어진다() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("172.16.0.1");

        assertThat(ClientIpResolver.resolve(request)).isEqualTo("172.16.0.1");
    }

    @Test
    void 표시용_앞자리는_IPv4_는_두_옥텟_IPv6_는_두_그룹이다() {
        assertThat(ClientIpResolver.prefix("121.135.1.2")).isEqualTo("121.135");
        assertThat(ClientIpResolver.prefix("2001:0db8:85a3::8a2e")).isEqualTo("2001:0db8");
        assertThat(ClientIpResolver.prefix("unknown")).isEqualTo("unknown");
    }

    @Test
    void 루프백_IPv6_는_콜론만_남기지_않고_원본을_그대로_돌려준다() {
        assertThat(ClientIpResolver.prefix("::1")).isEqualTo("::1");
    }
}
