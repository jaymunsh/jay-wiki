package cloud.leneu.jaywiki.blog;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(BlogCommentProperties.class)
class BlogConfig {
}
