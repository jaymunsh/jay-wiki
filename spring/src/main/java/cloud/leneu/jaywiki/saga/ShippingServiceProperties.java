package cloud.leneu.jaywiki.saga;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.net.URI;

@ConfigurationProperties(prefix = "app.shipping-service")
public record ShippingServiceProperties(URI url) {
}
