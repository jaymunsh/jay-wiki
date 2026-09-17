package cloud.leneu.jaywiki.domainlab;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Component
public class PartnerCallbackRegistry {
    private final ConcurrentHashMap<String, CompletableFuture<Result>> callbacks = new ConcurrentHashMap<>();

    public void register(String correlationId) {
        callbacks.put(correlationId, new CompletableFuture<>());
    }

    public void complete(String correlationId, Result result) {
        CompletableFuture<Result> callback = callbacks.get(correlationId);
        if (callback != null) callback.complete(result);
    }

    public Optional<Result> await(String correlationId, Duration timeout) {
        CompletableFuture<Result> callback = callbacks.get(correlationId);
        if (callback == null) return Optional.empty();
        try {
            return Optional.of(callback.get(timeout.toMillis(), TimeUnit.MILLISECONDS));
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (ExecutionException | TimeoutException error) {
            return Optional.empty();
        } finally {
            callbacks.remove(correlationId);
        }
    }

    public record Result(boolean signatureValid, String status) {
    }
}
