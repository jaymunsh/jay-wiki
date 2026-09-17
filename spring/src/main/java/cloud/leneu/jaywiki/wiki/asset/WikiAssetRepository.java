package cloud.leneu.jaywiki.wiki.asset;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WikiAssetRepository extends JpaRepository<WikiAsset, String> {

    /**
     * 같은 내용의 파일이 이미 올라와 있는지 본다. 발행 스크립트가 재시도되거나 같은 그림을
     * 두 글이 쓰면 창고에 같은 바이트가 여러 벌 쌓이고, 아무도 안 쓰는 자산이 남는다.
     */
    Optional<WikiAsset> findFirstByChecksumSha256AndDeletedAtIsNull(String checksumSha256);

    List<WikiAsset> findAllByDeletedAtIsNull();
}
