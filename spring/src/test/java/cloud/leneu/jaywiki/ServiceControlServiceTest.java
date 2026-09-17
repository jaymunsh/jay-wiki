package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.ops.KubernetesScaleGateway;
import cloud.leneu.jaywiki.ops.ScaleView;
import cloud.leneu.jaywiki.ops.ServiceControlService;
import cloud.leneu.jaywiki.ops.ServiceControlTarget;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ServiceControlServiceTest {

    @Test
    void 화이트리스트_대상만_스케일한다() {
        FakeScaleGateway gateway = new FakeScaleGateway();
        ServiceControlService service = new ServiceControlService(gateway);

        assertThat(service.list())
                .extracting("key")
                .containsExactly("opensearch");

        assertThat(service.scale("opensearch", 1).desiredReplicas()).isEqualTo(1);
        assertThat(gateway.replicas).isEqualTo(1);
    }

    @Test
    void 허용범위_밖의_replica는_거부한다() {
        ServiceControlService service = new ServiceControlService(new FakeScaleGateway());

        assertThatThrownBy(() -> service.scale("opensearch", 2))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("between 0 and 1");
    }

    @Test
    void 알수없는_key는_거부한다() {
        ServiceControlService service = new ServiceControlService(new FakeScaleGateway());

        assertThatThrownBy(() -> service.scale("backend", 0))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("unknown service target");
    }

    private static final class FakeScaleGateway implements KubernetesScaleGateway {
        private int replicas;

        @Override
        public ScaleView read(ServiceControlTarget target) {
            return new ScaleView(replicas, replicas);
        }

        @Override
        public ScaleView scale(ServiceControlTarget target, int replicas) {
            this.replicas = replicas;
            return new ScaleView(replicas, replicas);
        }
    }
}
