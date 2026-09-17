package cloud.leneu.jaywiki.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;

/** The second factory is owned here, so Boot still configures the ordinary cache factory. */
@Configuration(proxyBeanMethods = false)
public class SecurityRedisConfiguration {
    @Bean
    @Primary
    StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }

    @Bean(destroyMethod = "close")
    SecurityConnection securityConnection(RedisConnectionFactory cache,
            @Value("${app.security-redis.host:}") String host,
            @Value("${app.security-redis.port:6379}") int port,
            @Value("${app.security-redis.password:}") String password,
            @Value("${app.security-redis.required:false}") boolean required) {
        if (host.isBlank()) {
            if (required) throw new IllegalStateException("A dedicated security Redis is required");
            return new SecurityConnection(cache, null);
        }
        if (password.isBlank()) throw new IllegalStateException("Security Redis requires authentication");
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration(host, port);
        config.setPassword(password);
        LettuceConnectionFactory factory = new LettuceConnectionFactory(config,
                LettuceClientConfiguration.builder().commandTimeout(Duration.ofSeconds(2)).build());
        factory.afterPropertiesSet();
        factory.start();
        return new SecurityConnection(factory, factory);
    }

    @Bean
    StringRedisTemplate securityRedisTemplate(SecurityConnection connection) {
        return new StringRedisTemplate(connection.factory());
    }

    record SecurityConnection(RedisConnectionFactory factory, LettuceConnectionFactory owned) implements AutoCloseable {
        @Override public void close() { if (owned != null) owned.destroy(); }
    }
}
