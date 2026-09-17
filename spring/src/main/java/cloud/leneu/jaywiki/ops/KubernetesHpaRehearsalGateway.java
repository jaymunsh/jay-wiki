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
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class KubernetesHpaRehearsalGateway implements HpaRehearsalGateway {
    private static final Path TOKEN_PATH = Path.of("/var/run/secrets/kubernetes.io/serviceaccount/token");
    private static final Path CA_PATH = Path.of("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt");
    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final String LOAD_NAMESPACE = "rehearsal";
    private final ObjectMapper mapper;
    private final Optional<ClusterAccess> cluster;

    public KubernetesHpaRehearsalGateway(ObjectMapper mapper) {
        this.mapper = mapper;
        this.cluster = ClusterAccess.load();
    }

    /**
     * 워커는 요청마다 「HTTP 코드 + 소요 시간」을 한 줄씩 남기고, awk 가 그것을 합쳐
     * JAYWIKI_LOAD 한 줄로 찍는다. 10초마다 한 번씩 찍으므로 실행 중에도 읽을 수 있다.
     */
    private static final String LOAD_SCRIPT = """
            end=$(( $(date +%s) + 180 ))
            i=0
            while [ $i -lt __WORKERS__ ]; do : > /tmp/w$i; i=$((i+1)); done
            report() { awk -v w=__WORKERS__ '{ n++; if ($1 != 200) { f++ } else { s += $2; if ($2 + 0 > m) m = $2 + 0 } } END { printf "JAYWIKI_LOAD workers=%d requests=%d failed=%d avgMs=%d maxMs=%d\\n", w, n, f, (n - f > 0 ? s / (n - f) * 1000 : 0), m * 1000 }' /tmp/w*; }
            work() { while [ $(date +%s) -lt $end ]; do curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' 'http://jaywiki.backend.svc.cluster.local:8080/api/board/search?q=%EC%83%98%ED%94%8C' >> $1 || true; done; }
            i=0
            while [ $i -lt __WORKERS__ ]; do work /tmp/w$i & i=$((i+1)); done
            while [ $(date +%s) -lt $end ]; do sleep 10; report; done
            wait
            report
            """;

    @Override
    public void start(String runId, int workers) {
        String jobName = jobName(runId);
        String script = LOAD_SCRIPT.replace("__WORKERS__", Integer.toString(workers));
        String body = """
                {"apiVersion":"batch/v1","kind":"Job","metadata":{"name":"%s","namespace":"rehearsal","labels":{"app":"jaywiki-hpa-load","jaywiki-run":"%s"}},"spec":{"activeDeadlineSeconds":210,"ttlSecondsAfterFinished":300,"backoffLimit":0,"template":{"metadata":{"labels":{"app":"jaywiki-hpa-load","jaywiki-run":"%s"}},"spec":{"restartPolicy":"Never","automountServiceAccountToken":false,"securityContext":{"runAsNonRoot":true,"runAsUser":10001,"seccompProfile":{"type":"RuntimeDefault"}},"containers":[{"name":"load","securityContext":{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]}},"image":"curlimages/curl:8.11.1","command":["/bin/sh","-c"],"args":[%s],"resources":{"requests":{"cpu":"20m","memory":"16Mi"},"limits":{"cpu":"500m","memory":"64Mi"}}}]}}}}
                """.formatted(jobName, runId, runId, jsonString(script));
        send(request("/apis/batch/v1/namespaces/" + LOAD_NAMESPACE + "/jobs")
                .header("content-type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build(), false);
    }

    @Override
    public void cancel(String runId) {
        HttpRequest request = request("/apis/batch/v1/namespaces/" + LOAD_NAMESPACE + "/jobs/" + enc(jobName(runId))
                + "?propagationPolicy=Background").DELETE().build();
        send(request, true);
    }

    @Override
    public HpaRuntimeSnapshot read(String runId) {
        if (cluster.isEmpty()) return HpaRuntimeSnapshot.unavailable();
        JsonNode hpa = get("/apis/autoscaling/v2/namespaces/backend/horizontalpodautoscalers/jaywiki", false);
        JsonNode deployment = get("/apis/apps/v1/namespaces/backend/deployments/jaywiki", false);
        JsonNode pods = get("/api/v1/namespaces/backend/pods?labelSelector=app%3Djaywiki", false);
        JsonNode metrics = get("/apis/metrics.k8s.io/v1beta1/namespaces/backend/pods?labelSelector=app%3Djaywiki", true);
        JsonNode job = runId == null || runId.isBlank() ? null
                : get("/apis/batch/v1/namespaces/" + LOAD_NAMESPACE + "/jobs/" + enc(jobName(runId)), true);

        Integer cpu = null;
        JsonNode current = hpa.path("status").path("currentMetrics");
        if (current.isArray() && !current.isEmpty()) {
            JsonNode value = current.get(0).path("resource").path("current").path("averageUtilization");
            if (value.isNumber()) cpu = value.asInt();
        }
        int targetCpu = hpa.path("spec").path("metrics").path(0).path("resource")
                .path("target").path("averageUtilization").asInt(60);
        int desired = deployment.path("spec").path("replicas").asInt(0);
        int ready = deployment.path("status").path("readyReplicas").asInt(0);
        Map<String, Usage> usage = usage(metrics);
        List<HpaRuntimeSnapshot.Pod> podViews = new ArrayList<>();
        for (JsonNode pod : pods.path("items")) {
            String name = pod.path("metadata").path("name").asText();
            JsonNode statuses = pod.path("status").path("containerStatuses");
            boolean podReady = false;
            int restarts = 0;
            String image = "";
            for (JsonNode status : statuses) {
                podReady |= status.path("ready").asBoolean(false);
                restarts += status.path("restartCount").asInt(0);
                if (image.isBlank()) image = shortImage(status.path("imageID").asText(status.path("image").asText("")));
            }
            Usage podUsage = usage.getOrDefault(name, new Usage(null, null));
            podViews.add(new HpaRuntimeSnapshot.Pod(name, pod.path("status").path("phase").asText("Unknown"),
                    podReady, restarts, parseTime(pod.path("status").path("startTime").asText(null)),
                    podUsage.cpuMilli(), podUsage.memoryMi(), image));
        }
        podViews.sort(java.util.Comparator.comparing(HpaRuntimeSnapshot.Pod::startedAt,
                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())));
        return new HpaRuntimeSnapshot(true, cpu, targetCpu, desired, ready, jobState(job),
                List.copyOf(podViews), job == null ? null : loadStats(runId));
    }

    /**
     * 부하 Job 의 파드 로그에서 마지막 JAYWIKI_LOAD 줄을 읽는다.
     * Job 이 TTL 로 사라지면 더는 못 읽으므로, 보존은 호출하는 쪽이 맡는다.
     */
    private HpaRuntimeSnapshot.Load loadStats(String runId) {
        JsonNode pods = get("/api/v1/namespaces/" + LOAD_NAMESPACE + "/pods?labelSelector="
                + enc("jaywiki-run=" + runId), true);
        if (pods == null) return null;
        String pod = pods.path("items").path(0).path("metadata").path("name").asText("");
        if (pod.isBlank()) return null;
        HttpResponse<String> response = send(request("/api/v1/namespaces/" + LOAD_NAMESPACE + "/pods/"
                + enc(pod) + "/log?tailLines=40").GET().build(), true);
        if (response.statusCode() == 404) return null;
        return parseLoad(response.body());
    }

    static HpaRuntimeSnapshot.Load parseLoad(String log) {
        if (log == null) return null;
        String line = null;
        for (String candidate : log.split("\n")) {
            if (candidate.startsWith("JAYWIKI_LOAD ")) line = candidate;
        }
        if (line == null) return null;
        Map<String, Long> fields = new HashMap<>();
        for (String token : line.trim().split(" +")) {
            int equals = token.indexOf('=');
            if (equals <= 0) continue;
            try {
                fields.put(token.substring(0, equals), Long.parseLong(token.substring(equals + 1)));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        if (!fields.keySet().containsAll(List.of("workers", "requests", "failed", "avgMs", "maxMs"))) return null;
        return new HpaRuntimeSnapshot.Load(fields.get("workers").intValue(), fields.get("requests"),
                fields.get("failed"), fields.get("avgMs"), fields.get("maxMs"));
    }

    private String jsonString(String value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (IOException e) {
            throw new KubernetesControlException("Load script could not be encoded", e);
        }
    }

    private Map<String, Usage> usage(JsonNode root) {
        Map<String, Usage> result = new HashMap<>();
        if (root == null) return result;
        for (JsonNode item : root.path("items")) {
            long cpu = 0;
            long memory = 0;
            for (JsonNode container : item.path("containers")) {
                cpu += cpuMilli(container.path("usage").path("cpu").asText("0"));
                memory += memoryMi(container.path("usage").path("memory").asText("0"));
            }
            result.put(item.path("metadata").path("name").asText(), new Usage(cpu, memory));
        }
        return result;
    }

    private JsonNode get(String path, boolean allowMissing) {
        HttpResponse<String> response = send(request(path).GET().build(), allowMissing);
        if (response.statusCode() == 404 && allowMissing) return null;
        try {
            return mapper.readTree(response.body());
        } catch (IOException e) {
            throw new KubernetesControlException("Kubernetes API returned invalid JSON", e);
        }
    }

    private HttpRequest.Builder request(String path) {
        ClusterAccess access = cluster.orElseThrow(() ->
                new KubernetesControlException("Kubernetes service account is not available in this runtime"));
        return HttpRequest.newBuilder(access.uri(path)).timeout(TIMEOUT)
                .header("accept", "application/json")
                .header("authorization", "Bearer " + access.token());
    }

    private HttpResponse<String> send(HttpRequest request, boolean allowMissing) {
        ClusterAccess access = cluster.orElseThrow(() ->
                new KubernetesControlException("Kubernetes service account is not available in this runtime"));
        try {
            HttpResponse<String> response = access.client().send(request, HttpResponse.BodyHandlers.ofString());
            if ((response.statusCode() < 200 || response.statusCode() >= 300)
                    && !(allowMissing && response.statusCode() == 404)) {
                throw new KubernetesControlException("Kubernetes API returned HTTP " + response.statusCode());
            }
            return response;
        } catch (IOException e) {
            throw new KubernetesControlException("Kubernetes API request failed", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new KubernetesControlException("Kubernetes API request was interrupted", e);
        }
    }

    private static HpaRuntimeSnapshot.JobState jobState(JsonNode job) {
        if (job == null) return HpaRuntimeSnapshot.JobState.NONE;
        if (job.path("status").path("failed").asInt(0) > 0) return HpaRuntimeSnapshot.JobState.FAILED;
        if (job.path("status").path("succeeded").asInt(0) > 0) return HpaRuntimeSnapshot.JobState.SUCCEEDED;
        return job.path("status").path("active").asInt(0) > 0
                ? HpaRuntimeSnapshot.JobState.ACTIVE : HpaRuntimeSnapshot.JobState.NONE;
    }

    private static long cpuMilli(String value) {
        if (value.endsWith("n")) return Long.parseLong(value.substring(0, value.length() - 1)) / 1_000_000;
        if (value.endsWith("u")) return Long.parseLong(value.substring(0, value.length() - 1)) / 1_000;
        if (value.endsWith("m")) return Long.parseLong(value.substring(0, value.length() - 1));
        return Long.parseLong(value) * 1_000;
    }

    private static long memoryMi(String value) {
        if (value.endsWith("Ki")) return Long.parseLong(value.substring(0, value.length() - 2)) / 1024;
        if (value.endsWith("Mi")) return Long.parseLong(value.substring(0, value.length() - 2));
        if (value.endsWith("Gi")) return Long.parseLong(value.substring(0, value.length() - 2)) * 1024;
        return Long.parseLong(value) / 1024 / 1024;
    }

    private static String jobName(String runId) {
        String compact = runId.replace("-", "");
        return "jaywiki-hpa-load-" + compact.substring(0, Math.min(12, compact.length()));
    }

    private static String shortImage(String image) {
        int sha = image.indexOf("sha256:");
        if (sha >= 0) return image.substring(sha + 7, Math.min(image.length(), sha + 19));
        int slash = image.lastIndexOf('/');
        return slash >= 0 ? image.substring(slash + 1) : image;
    }

    private static OffsetDateTime parseTime(String value) {
        return value == null || value.isBlank() ? null : OffsetDateTime.parse(value);
    }

    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private record Usage(Long cpuMilli, Long memoryMi) {}

    private record ClusterAccess(String host, String port, String token, HttpClient client) {
        static Optional<ClusterAccess> load() {
            String host = System.getenv("KUBERNETES_SERVICE_HOST");
            String port = System.getenv("KUBERNETES_SERVICE_PORT");
            if (host == null || port == null || !Files.isRegularFile(TOKEN_PATH)) return Optional.empty();
            try {
                return Optional.of(new ClusterAccess(host, port,
                        Files.readString(TOKEN_PATH, StandardCharsets.UTF_8).trim(),
                        HttpClient.newBuilder().connectTimeout(TIMEOUT).sslContext(sslContext()).build()));
            } catch (IOException | GeneralSecurityException e) {
                throw new KubernetesControlException("Kubernetes service account could not be loaded", e);
            }
        }

        URI uri(String path) {
            return URI.create("https://%s:%s%s".formatted(host, port, path));
        }

        private static SSLContext sslContext() throws GeneralSecurityException, IOException {
            if (!Files.isRegularFile(CA_PATH)) return SSLContext.getDefault();
            CertificateFactory factory = CertificateFactory.getInstance("X.509");
            X509Certificate certificate;
            try (InputStream stream = Files.newInputStream(CA_PATH)) {
                certificate = (X509Certificate) factory.generateCertificate(stream);
            }
            KeyStore store = KeyStore.getInstance(KeyStore.getDefaultType());
            store.load(null, null);
            store.setCertificateEntry("kubernetes", certificate);
            TrustManagerFactory trust = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            trust.init(store);
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, trust.getTrustManagers(), null);
            return context;
        }
    }
}
