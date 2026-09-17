package cloud.leneu.jaywiki.domainlab;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class PartnerApiConfiguration {
    @Bean
    PartnerApiClient partnerApiClient(
            @Value("${app.partner-simulator.url:http://127.0.0.1:8010}") String baseUrl,
            @Value("${app.partner-simulator.callback-url:http://127.0.0.1:8080/api/domain-scenarios/partner-api/callbacks}")
            String callbackUrl) {
        PartnerWebClientFactory factory = new PartnerWebClientFactory(Duration.ofMillis(700));
        return new PartnerApiClient(factory.create(baseUrl), callbackUrl);
    }
}
