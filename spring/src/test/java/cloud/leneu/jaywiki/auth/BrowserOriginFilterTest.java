package cloud.leneu.jaywiki.auth;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.assertj.core.api.Assertions.assertThat;

class BrowserOriginFilterTest {
    @Test void nodeFetchMetadataRequiresExplicitServerMarker() {
        var request = new MockHttpServletRequest();
        request.setCookies(new jakarta.servlet.http.Cookie("jw_token", "test"));
        request.addHeader("Sec-Fetch-Mode", "cors");
        assertThat(BrowserOriginFilter.allowed(request)).isFalse();
        request.addHeader("X-Jaywiki-Request", "server");
        assertThat(BrowserOriginFilter.allowed(request)).isTrue();
        request.addHeader("Sec-Fetch-Site", "cross-site");
        assertThat(BrowserOriginFilter.allowed(request)).isFalse();
    }
    @Test void usesTheWrappedTargetAfterSpringConsumesForwardedHeaders() throws Exception {
        var request = new MockHttpServletRequest();
        request.setServerName("backend.internal");
        request.setServerPort(8080);
        request.addHeader("X-Forwarded-Host", "blog.example.test:3000");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("Origin", "https://blog.example.test:3000");
        new org.springframework.web.filter.ForwardedHeaderFilter().doFilter(request,
                new org.springframework.mock.web.MockHttpServletResponse(), (wrapped, response) -> {
                    var http = (jakarta.servlet.http.HttpServletRequest) wrapped;
                    assertThat(http.getHeader("X-Forwarded-Host")).isNull();
                    assertThat(BrowserOriginFilter.allowed(http)).isTrue();
                });
    }
    @Test void comparesSchemeHostAndPortBehindProxy() {
        var request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-Host", "blog.example.test");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("Origin", "https://blog.example.test");
        assertThat(BrowserOriginFilter.allowed(request)).isTrue();
        for (String origin : new String[]{"http://blog.example.test", "https://example.test", "null",
                "https://blog.example.test:444", "https://blog.example.test/path"}) {
            request.removeHeader("Origin"); request.addHeader("Origin", origin);
            assertThat(BrowserOriginFilter.allowed(request)).isFalse();
        }
    }
    @Test void missingOriginWithBrowserMetadataIsNotATrustedServerCall() {
        var request = new MockHttpServletRequest();
        request.addHeader("Sec-Fetch-Site", "same-origin");
        request.addHeader("X-Jaywiki-Request", "server");
        assertThat(BrowserOriginFilter.allowed(request)).isFalse();
    }
}
