package cloud.leneu.jaywiki.kafka;

class KafkaDemoConsumerException extends RuntimeException {
    KafkaDemoConsumerException(String message) {
        super(message);
    }

    KafkaDemoConsumerException(String message, Throwable cause) {
        super(message, cause);
    }
}
