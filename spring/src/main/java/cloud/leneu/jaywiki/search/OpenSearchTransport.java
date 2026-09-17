package cloud.leneu.jaywiki.search;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import java.time.Duration;

final class OpenSearchTransport {
    private OpenSearchTransport() {}

    static HttpClient create(OpenSearchProperties props) {
        boolean user = present(props.username());
        boolean password = present(props.password());
        if (user != password) throw new IllegalArgumentException("OpenSearch requires both username and password");
        if (user && props.username().contains(":")) throw new IllegalArgumentException("Invalid OpenSearch username");
        if (props.url() == null || props.url().getHost() == null || props.url().getUserInfo() != null
                || props.url().getQuery() != null || props.url().getFragment() != null
                || !("http".equals(props.url().getScheme()) || "https".equals(props.url().getScheme()))) {
            throw new IllegalArgumentException("Invalid OpenSearch endpoint");
        }
        if ((user || props.securityRequired() || present(props.caCertificate())) && !"https".equals(props.url().getScheme())) {
            throw new IllegalArgumentException("OpenSearch security requires HTTPS");
        }
        if (props.securityRequired() && !user) throw new IllegalArgumentException("OpenSearch credentials required");
        var builder = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2))
                .followRedirects(HttpClient.Redirect.NEVER);
        if (present(props.caCertificate())) {
            try (var input = Files.newInputStream(Path.of(props.caCertificate()))) {
                var certificates = CertificateFactory.getInstance("X.509").generateCertificates(input);
                if (certificates.isEmpty()) throw new IllegalArgumentException("Empty OpenSearch CA bundle");
                var trust = KeyStore.getInstance(KeyStore.getDefaultType());
                trust.load(null, null);
                int index = 0;
                for (var certificate : certificates) trust.setCertificateEntry("ca-" + index++, certificate);
                var managers = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
                managers.init(trust);
                var context = SSLContext.getInstance("TLS");
                context.init(null, managers.getTrustManagers(), null);
                builder.sslContext(context);
            } catch (Exception e) {
                throw new IllegalArgumentException("Cannot load OpenSearch trust configuration", e);
            }
        }
        // Java's hostname verification remains enabled; no permissive trust manager.
        return builder.build();
    }

    static boolean present(String value) {
        return value != null && !value.isBlank();
    }
}
