package cloud.leneu.jaywiki.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.net.URI;
import java.util.Set;

/** Browser writes must match the trusted proxy target. Non-browser cookie clients use a custom header. */
public class BrowserOriginFilter extends OncePerRequestFilter {
    private static final Set<String> SAFE = Set.of("GET", "HEAD", "OPTIONS");

    @Override protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (!SAFE.contains(req.getMethod()) && req.getRequestURI().startsWith("/api/")) {
            if (!allowed(req)) { res.sendError(403, "Request origin rejected"); return; }
        }
        chain.doFilter(req, res);
    }

    static boolean allowed(HttpServletRequest req) {
        if ("cross-site".equals(req.getHeader("Sec-Fetch-Site"))) return false;
        String origin = req.getHeader("Origin");
        if (origin == null) {
            if (req.getHeader("Sec-Fetch-Site") != null) return false;
            // Node fetch adds Sec-Fetch-Mode: cors even for server-to-server calls.
            // Browsers cannot add this custom marker in a simple cross-origin request.
            boolean server = "server".equals(req.getHeader("X-Jaywiki-Request"));
            String mode = req.getHeader("Sec-Fetch-Mode");
            if (mode != null && !(server && "cors".equals(mode))) return false;
            boolean authCookie = JwtCookieFilter.extract(req) != null;
            if (req.getCookies() != null) for (var cookie : req.getCookies()) {
                if ("JSESSIONID".equals(cookie.getName())) authCookie = true;
            }
            return !authCookie || server;
        }
        try {
            String host = req.getHeader("X-Forwarded-Host");
            // ForwardedHeaderFilter removes forwarded headers after wrapping serverName/port.
            if (host == null) {
                String name = req.getServerName();
                if (name.contains(":") && !name.startsWith("[")) name = "[" + name + "]";
                host = name + ":" + req.getServerPort();
            }
            String scheme = req.getHeader("X-Forwarded-Proto");
            if (scheme == null) scheme = req.getScheme();
            URI actual = URI.create(origin), expected = URI.create(scheme + "://" + host);
            if (!Set.of("http", "https").contains(actual.getScheme()) || actual.getHost() == null) return false;
            if (actual.getUserInfo() != null || actual.getRawQuery() != null || actual.getRawFragment() != null
                    || !actual.getPath().isEmpty()) return false;
            return actual.getScheme().equals(expected.getScheme()) && actual.getHost().equalsIgnoreCase(expected.getHost())
                    && port(actual) == port(expected);
        } catch (RuntimeException invalid) { return false; }
    }
    private static int port(URI uri) { return uri.getPort() >= 0 ? uri.getPort() : "https".equals(uri.getScheme()) ? 443 : 80; }
}
