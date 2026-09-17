package cloud.leneu.jaywiki.search;

import com.sun.net.httpserver.HttpsConfigurator;
import com.sun.net.httpserver.HttpsServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;

class OpenSearchTransportTest {
    @TempDir Path directory;

    private OpenSearchProperties props(String url, String user, String password, String ca, boolean required) {
        return new OpenSearchProperties(true, URI.create(url), "board", "wiki", user, password, ca, required);
    }

    @Test
    void refusesPlaintextCredentialsAndMissingCredentials() {
        assertThatThrownBy(() -> OpenSearchTransport.create(props("http://localhost:9200", "app", "secret", "", false)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("HTTPS");
        assertThatThrownBy(() -> OpenSearchTransport.create(props("https://localhost:9200", "", "", "", true)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("credentials required");
        assertThatThrownBy(() -> OpenSearchTransport.create(props("https://localhost:9200", "app", "", "", false)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(props("https://localhost:9200", "app", "secret", "", true).toString()).doesNotContain("secret");
    }

    @Test
    void refusesCredentialsInUrlAndMissingCaFile() {
        assertThatThrownBy(() -> OpenSearchTransport.create(props("https://app:secret@localhost:9200", "", "", "", false)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OpenSearchTransport.create(props("https://localhost:9200", "app", "secret", directory.resolve("missing.pem").toString(), true)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void verifiesCertificateTrustAndHostnameAgainstRealTlsServer() throws Exception {
        Path store = directory.resolve("server.p12");
        Path certificate = directory.resolve("ca.pem");
        keytool("-genkeypair", "-alias", "server", "-keyalg", "RSA", "-keysize", "2048",
                "-dname", "CN=localhost", "-ext", "SAN=dns:localhost", "-validity", "2",
                "-keystore", store.toString(), "-storetype", "PKCS12", "-storepass", "test-only-password");
        keytool("-exportcert", "-rfc", "-alias", "server", "-keystore", store.toString(),
                "-storepass", "test-only-password", "-file", certificate.toString());
        var keys = KeyStore.getInstance("PKCS12");
        try (var input = Files.newInputStream(store)) { keys.load(input, "test-only-password".toCharArray()); }
        var managers = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        managers.init(keys, "test-only-password".toCharArray());
        var tls = SSLContext.getInstance("TLS");
        tls.init(managers.getKeyManagers(), null, null);
        var server = HttpsServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.setHttpsConfigurator(new HttpsConfigurator(tls));
        server.createContext("/", exchange -> { exchange.sendResponseHeaders(200, 2); exchange.getResponseBody().write("{}".getBytes()); exchange.close(); });
        server.start();
        try {
            String url = "https://localhost:" + server.getAddress().getPort();
            var request = HttpRequest.newBuilder(URI.create(url)).GET().build();
            try (var trusted = OpenSearchTransport.create(props(url, "", "", certificate.toString(), false))) {
                assertThat(trusted.send(request, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(200);
                var wrongHost = HttpRequest.newBuilder(URI.create(url.replace("localhost", "127.0.0.1"))).GET().build();
                assertThatThrownBy(() -> trusted.send(wrongHost, HttpResponse.BodyHandlers.ofString())).isInstanceOf(javax.net.ssl.SSLHandshakeException.class);
            }
            try (var untrusted = OpenSearchTransport.create(props(url, "", "", "", false))) {
                assertThatThrownBy(() -> untrusted.send(request, HttpResponse.BodyHandlers.ofString())).isInstanceOf(javax.net.ssl.SSLHandshakeException.class);
            }
        } finally { server.stop(0); }
    }

    private void keytool(String... arguments) throws Exception {
        var command = new java.util.ArrayList<String>();
        command.add(Path.of(System.getProperty("java.home"), "bin", "keytool").toString());
        command.addAll(java.util.List.of(arguments));
        var process = new ProcessBuilder(command).redirectErrorStream(true).redirectOutput(directory.resolve("keytool.log").toFile()).start();
        if (!process.waitFor(30, TimeUnit.SECONDS)) { process.destroyForcibly(); fail("keytool timed out"); }
        assertThat(process.exitValue()).isZero();
    }
}
