package cloud.leneu.jaywiki.domainlab;

import io.netty.channel.ChannelOption;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;

import java.time.Duration;

public class PartnerWebClientFactory {
    private final Duration responseTimeout;

    public PartnerWebClientFactory(Duration responseTimeout) {
        this.responseTimeout = responseTimeout;
    }

    public WebClient create(String baseUrl) {
        ConnectionProvider pool = ConnectionProvider.builder("partner-api")
                .maxConnections(20)
                .pendingAcquireTimeout(Duration.ofMillis(300))
                .maxIdleTime(Duration.ofSeconds(20))
                .build();
        HttpClient client = HttpClient.create(pool)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 300)
                .responseTimeout(responseTimeout);
        return WebClient.builder()
                .baseUrl(baseUrl)
                .clientConnector(new ReactorClientHttpConnector(client))
                .filter((request, next) -> next.exchange(
                        org.springframework.web.reactive.function.client.ClientRequest.from(request)
                                .header("X-Client", "jaywiki-webclient")
                                .build()))
                .build();
    }
}
