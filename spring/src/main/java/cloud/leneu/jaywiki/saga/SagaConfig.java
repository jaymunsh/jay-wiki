package cloud.leneu.jaywiki.saga;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({PaymentServiceProperties.class, ShippingServiceProperties.class})
public class SagaConfig {
}
