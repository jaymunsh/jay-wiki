package cloud.leneu.jaywiki.wiki.asset;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * 같은 그림을 두 번 올려도 자산은 하나여야 한다. 발행 스크립트가 재시도되거나 두 글이 같은
 * 그림을 쓰면, 그렇지 않을 때 창고에 같은 바이트가 쌓이고 아무도 안 쓰는 자산이 남는다.
 *
 * 창고는 가짜로 둔다. 검사하려는 것은 「두 번째는 이미 있는 것을 돌려준다」는 판단이지 MinIO 가
 * 아니다. 진짜 MinIO 를 쓰면 CI 에 컨테이너가 없어서 실패하고, 로컬에는 떠 있어서 통과한다 --
 * 2026-09-01 배포가 실제로 그렇게 멈췄다.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class WikiAssetUploadIdempotencyTest {

    @Autowired WikiAssetService service;
    @MockitoBean WikiAssetObjectStorage storage;

    private static final byte[] PNG = {
            (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03, 0x04
    };

    @Test
    void 같은_내용을_두_번_올리면_같은_자산을_돌려준다() {
        WikiAssetUploadResponse first = service.upload(
                WikiAssetFile.parse("first.png", "image/png", PNG), "content-sync");
        WikiAssetUploadResponse second = service.upload(
                WikiAssetFile.parse("이름만-다른.png", "image/png", PNG), "content-sync");

        assertThat(second.id()).isEqualTo(first.id());
        assertThat(second.url()).isEqualTo(first.url());
        // 두 번째는 창고에 아예 안 넣는다. 같은 바이트가 두 벌 쌓이지 않는 이유가 이것이다.
        verify(storage, times(1)).put(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
    }
}
