package cloud.leneu.jaywiki.saga;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;

@ConfigurationProperties(prefix = "app.payment-service")
public record PaymentServiceProperties(URI url) {
}
