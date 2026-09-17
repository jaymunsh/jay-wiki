package cloud.leneu.jaywiki.ops;

import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.SequencedCollection;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ServiceControlService {

    private static final List<ServiceControlTarget> TARGETS = List.of(
            new ServiceControlTarget(
                    "opensearch",
                    "OpenSearch",
                    "data",
                    WorkloadKind.STATEFUL_SET,
                    "secure-search",
                    0,
                    1,
                    "검색 비교 Phase2용 워크로드. 평소에는 0으로 내려 메모리를 아낀다."
            )
    );

    private final KubernetesScaleGateway scaleGateway;
    private final Map<String, ServiceControlTarget> targets;

    public ServiceControlService(KubernetesScaleGateway scaleGateway) {
        this.scaleGateway = scaleGateway;
        this.targets = TARGETS.stream()
                .collect(Collectors.toUnmodifiableMap(ServiceControlTarget::key, Function.identity()));
    }

    public SequencedCollection<ServiceStatusDto> list() {
        return TARGETS.stream()
                .sorted(Comparator.comparing(ServiceControlTarget::key))
                .map(this::status)
                .toList();
    }

    public ServiceStatusDto scale(String key, int replicas) {
        ServiceControlTarget target = target(key);
        if (!target.accepts(replicas)) {
            throw new IllegalStateException(
                    "%s replicas must be between %d and %d".formatted(
                            target.key(), target.minReplicas(), target.maxReplicas()));
        }
        return toDto(target, scaleGateway.scale(target, replicas));
    }

    private ServiceStatusDto status(ServiceControlTarget target) {
        return toDto(target, scaleGateway.read(target));
    }

    private ServiceControlTarget target(String key) {
        ServiceControlTarget target = targets.get(key);
        if (target == null) {
            throw new IllegalStateException("unknown service target: " + key);
        }
        return target;
    }

    private ServiceStatusDto toDto(ServiceControlTarget target, ScaleView view) {
        return new ServiceStatusDto(
                target.key(),
                target.title(),
                target.namespace(),
                target.kind().displayName(),
                target.name(),
                view.desiredReplicas(),
                view.currentReplicas(),
                target.minReplicas(),
                target.maxReplicas(),
                view.currentReplicas() >= view.desiredReplicas(),
                target.description()
        );
    }
}
