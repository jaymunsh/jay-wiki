package cloud.leneu.jaywiki.ops;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.Optional;

@Component
public class KubernetesHttpScaleGateway implements KubernetesScaleGateway {

    private static final Path TOKEN_PATH = Path.of("/var/run/secrets/kubernetes.io/serviceaccount/token");
    private static final Path CA_PATH = Path.of("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt");
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    private final ObjectMapper mapper;
    private final Optional<ClusterAccess> cluster;

    public KubernetesHttpScaleGateway(ObjectMapper mapper) {
        this.mapper = mapper;
        this.cluster = ClusterAccess.load();
    }

    @Override
    public ScaleView read(ServiceControlTarget target) {
        HttpRequest request = requestBuilder(target)
                .GET()
                .build();
        return send(request);
    }

    @Override
    public ScaleView scale(ServiceControlTarget target, int replicas) {
        HttpRequest request = requestBuilder(target)
                .header("content-type", "application/merge-patch+json")
                .method("PATCH", HttpRequest.BodyPublishers.ofString("""
                        {"spec":{"replicas":%d}}
                        """.formatted(replicas)))
                .build();
        return send(request);
    }

    private HttpRequest.Builder requestBuilder(ServiceControlTarget target) {
        ClusterAccess access = cluster.orElseThrow(() ->
                new KubernetesControlException("Kubernetes service account is not available in this runtime"));
        return HttpRequest.newBuilder(access.scaleUri(target))
                .timeout(TIMEOUT)
                .header("accept", "application/json")
                .header("authorization", "Bearer " + access.token());
    }

    private ScaleView send(HttpRequest request) {
        ClusterAccess access = cluster.orElseThrow(() ->
                new KubernetesControlException("Kubernetes service account is not available in this runtime"));
        try {
            HttpResponse<String> response = access.client().send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new KubernetesControlException(
                        "Kubernetes scale API returned HTTP %d".formatted(response.statusCode()));
            }
            JsonNode root = mapper.readTree(response.body());
            return new ScaleView(
                    root.path("spec").path("replicas").asInt(0),
                    root.path("status").path("replicas").asInt(0)
            );
        } catch (IOException e) {
            throw new KubernetesControlException("Kubernetes scale API request failed", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new KubernetesControlException("Kubernetes scale API request was interrupted", e);
        }
    }

    private record ClusterAccess(String host, String port, String token, HttpClient client) {
        static Optional<ClusterAccess> load() {
            String host = System.getenv("KUBERNETES_SERVICE_HOST");
            String port = System.getenv("KUBERNETES_SERVICE_PORT");
            if (host == null || port == null || !Files.isRegularFile(TOKEN_PATH)) {
                return Optional.empty();
            }
            try {
                return Optional.of(new ClusterAccess(
                        host,
                        port,
                        Files.readString(TOKEN_PATH, StandardCharsets.UTF_8).trim(),
                        HttpClient.newBuilder()
                                .connectTimeout(TIMEOUT)
                                .sslContext(sslContext())
                                .build()
                ));
            } catch (IOException | GeneralSecurityException e) {
                throw new KubernetesControlException("Kubernetes service account could not be loaded", e);
            }
        }

        URI scaleUri(ServiceControlTarget target) {
            return URI.create("https://%s:%s/apis/apps/v1/namespaces/%s/%s/%s/scale".formatted(
                    host,
                    port,
                    enc(target.namespace()),
                    target.kind().apiResource(),
                    enc(target.name())
            ));
        }

        private static SSLContext sslContext() throws GeneralSecurityException, IOException {
            if (!Files.isRegularFile(CA_PATH)) {
                return SSLContext.getDefault();
            }

            CertificateFactory certificateFactory = CertificateFactory.getInstance("X.509");
            X509Certificate certificate;
            try (InputStream stream = Files.newInputStream(CA_PATH)) {
                certificate = (X509Certificate) certificateFactory.generateCertificate(stream);
            }

            KeyStore keyStore = KeyStore.getInstance(KeyStore.getDefaultType());
            keyStore.load(null, null);
            keyStore.setCertificateEntry("kubernetes", certificate);

            TrustManagerFactory trustManagerFactory =
                    TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            trustManagerFactory.init(keyStore);

            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, trustManagerFactory.getTrustManagers(), null);
            return context;
        }

        private static String enc(String value) {
            return URLEncoder.encode(value, StandardCharsets.UTF_8);
        }
    }
}
