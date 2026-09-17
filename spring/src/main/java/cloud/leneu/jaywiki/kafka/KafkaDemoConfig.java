package cloud.leneu.jaywiki.kafka;

import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.TopicPartition;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
@EnableConfigurationProperties(KafkaDemoProperties.class)
public class KafkaDemoConfig {

    @Bean
    @ConditionalOnProperty(prefix = "app.kafka-demo", name = "enabled", havingValue = "true")
    NewTopic kafkaDemoOrderTopic(KafkaDemoProperties properties) {
        return TopicBuilder.name(properties.orderTopic())
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    @ConditionalOnProperty(prefix = "app.kafka-demo", name = "enabled", havingValue = "true")
    NewTopic kafkaDemoDlqTopic(KafkaDemoProperties properties) {
        return TopicBuilder.name(properties.dlqTopic())
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    @ConditionalOnProperty(prefix = "app.kafka-demo", name = "enabled", havingValue = "true")
    ConcurrentKafkaListenerContainerFactory<String, String> kafkaDemoListenerContainerFactory(
            ConsumerFactory<String, String> consumerFactory,
            KafkaTemplate<String, String> kafkaTemplate,
            KafkaDemoProperties properties) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                kafkaTemplate,
                (record, exception) -> new TopicPartition(properties.dlqTopic(), record.partition()));
        factory.setCommonErrorHandler(new DefaultErrorHandler(
                recoverer,
                new FixedBackOff(500L, properties.maxRetries())));
        return factory;
    }
}
