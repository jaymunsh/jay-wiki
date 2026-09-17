package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.auth.AuthController;
import cloud.leneu.jaywiki.auth.JwtCookieFactory;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AuthControllerLogoutTest {

    @Test
    void logout은_jwt와_세션을_함께_끝낸다() {
        // Given
        AuthController controller = new AuthController(null, null, null, new JwtCookieFactory(true), null, null);
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpSession session = new MockHttpSession();
        request.setSession(session);

        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(
                "member1",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        SecurityContextHolder.setContext(context);

        MockHttpServletResponse response = new MockHttpServletResponse();
        try {
            // When
            var result = controller.logout(request, response);

            // Then
            assertThat(result.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(session.isInvalid()).isTrue();
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
            assertThat(response.getHeaders(HttpHeaders.SET_COOKIE))
                    .anySatisfy(cookie -> assertThat(cookie)
                            .contains("jw_token=", "Max-Age=0", "Secure", "HttpOnly", "SameSite=Lax"))
                    .anySatisfy(cookie -> assertThat(cookie)
                            .contains("JSESSIONID=", "Max-Age=0", "Secure", "HttpOnly", "SameSite=Lax"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
