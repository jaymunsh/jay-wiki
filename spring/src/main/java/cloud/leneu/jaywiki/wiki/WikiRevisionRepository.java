package cloud.leneu.jaywiki.wiki;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WikiRevisionRepository extends JpaRepository<WikiRevision, Long> {
    boolean existsByBodyContaining(String value);

    /** 한 문서의 버전 이력(최신 버전부터) */
    List<WikiRevision> findBySlugOrderByVersionDesc(String slug);

    /** 특정 버전 1건 */
    Optional<WikiRevision> findBySlugAndVersion(String slug, int version);
}
