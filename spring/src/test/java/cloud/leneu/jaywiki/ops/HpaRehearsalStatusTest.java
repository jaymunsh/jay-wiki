package cloud.leneu.jaywiki.ops;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class HpaRehearsalStatusTest {
    @Test
    void job이_끝나도_scaleOut을_관측하지_못하면_성공으로_기록하지_않는다() {
        assertThat(HpaRehearsalService.derive("LOADING", snapshot(1, 1,
                HpaRuntimeSnapshot.JobState.SUCCEEDED))).isEqualTo("NO_SCALE");
    }

    @Test
    void scaleOut_이력이_있으면_job이_ttl로_삭제된_뒤에도_완료한다() {
        assertThat(HpaRehearsalService.derive("STABILIZING", snapshot(1, 1,
                HpaRuntimeSnapshot.JobState.NONE))).isEqualTo("COMPLETED");
    }

    @Test
    void 워커_수는_1과_16_사이로_가둔다() {
        assertThat(HpaRehearsalService.clampWorkers(0)).isEqualTo(1);
        assertThat(HpaRehearsalService.clampWorkers(64)).isEqualTo(16);
        assertThat(HpaRehearsalService.clampWorkers(8)).isEqualTo(8);
    }

    @Test
    void 부하_로그는_마지막_집계_줄을_읽는다() {
        String log = """
                JAYWIKI_LOAD workers=8 requests=100 failed=0 avgMs=30 maxMs=90
                JAYWIKI_LOAD workers=8 requests=2400 failed=3 avgMs=41 maxMs=820
                """;
        HpaRuntimeSnapshot.Load load = KubernetesHpaRehearsalGateway.parseLoad(log);

        assertThat(load).isEqualTo(new HpaRuntimeSnapshot.Load(8, 2400, 3, 41, 820));
    }

    @Test
    void 집계_줄이_아직_없으면_부하_통계가_없다() {
        assertThat(KubernetesHpaRehearsalGateway.parseLoad("starting up\n")).isNull();
        assertThat(KubernetesHpaRehearsalGateway.parseLoad(null)).isNull();
    }

    @Test
    void 부하_중_replica가_잠시_줄어도_scaleOut_이력을_잃지_않는다() {
        assertThat(HpaRehearsalService.derive("SCALED_OUT", snapshot(1, 1,
                HpaRuntimeSnapshot.JobState.ACTIVE))).isEqualTo("SCALED_OUT");
    }

    private static HpaRuntimeSnapshot snapshot(
            int desired,
            int ready,
            HpaRuntimeSnapshot.JobState jobState) {
        return new HpaRuntimeSnapshot(true, 55, 60, desired, ready, jobState, List.of(), null);
    }
}
