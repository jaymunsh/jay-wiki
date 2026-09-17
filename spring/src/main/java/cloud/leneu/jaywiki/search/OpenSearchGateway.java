package cloud.leneu.jaywiki.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Component
class OpenSearchGateway {

    private final OpenSearchProperties props;
    private final ObjectMapper objectMapper;
    private final HttpClient http;

    OpenSearchGateway(OpenSearchProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.objectMapper = objectMapper;
        this.http = OpenSearchTransport.create(props);
    }

    void ensureIndex(String index, String body) {
        HttpResponse<String> head = send("HEAD", "/" + index, "");
        if (head.statusCode() == 200) {
            return;
        }
        if (head.statusCode() != 404) {
            throw new IllegalStateException("index check failed: HTTP " + head.statusCode());
        }
        HttpResponse<String> created = send("PUT", "/" + index, body);
        if (created.statusCode() / 100 != 2) {
            throw new IllegalStateException("index create failed: HTTP " + created.statusCode());
        }
    }

    JsonNode sendJson(String method, String path, String body) {
        HttpResponse<String> response = send(method, path, body);
        if (response.statusCode() / 100 != 2) {
            throw new IllegalStateException(method + " " + path + " failed: HTTP " + response.statusCode());
        }
        try {
            return body.isBlank() ? objectMapper.createObjectNode() : objectMapper.readTree(response.body());
        } catch (IOException e) {
            throw new IllegalStateException("invalid OpenSearch JSON response", e);
        }
    }

    String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (IOException e) {
            throw new IllegalStateException("OpenSearch JSON serialize failed", e);
        }
    }

    private HttpResponse<String> send(String method, String path, String body) {
        HttpRequest.BodyPublisher publisher = body.isBlank()
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(body);
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri(path))
                .timeout(Duration.ofSeconds(10))
                .method(method, publisher)
                .header("Content-Type", path.endsWith("_bulk") ? "application/x-ndjson" : "application/json");
        if (OpenSearchTransport.present(props.username())) {
            builder.header("Authorization", "Basic " + Base64.getEncoder().encodeToString(
                    (props.username() + ":" + props.password()).getBytes(StandardCharsets.UTF_8)));
        }
        HttpRequest request = builder.build();
        try {
            return http.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new IllegalStateException("request failed: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("request interrupted", e);
        }
    }

    private URI uri(String path) {
        String base = props.url().toString().replaceAll("/+$", "");
        return URI.create(base + path);
    }
}
