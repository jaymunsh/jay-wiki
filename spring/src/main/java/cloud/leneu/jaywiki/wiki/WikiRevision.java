package cloud.leneu.jaywiki.wiki;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 문서 수정 이력 = public.tb_revision 테이블 (V2).
 * 글을 수정할 때마다 '수정 직전' 본문을 여기 스냅샷으로 남긴다.
 * → 버전 목록 / 특정 버전 보기 / diff / 되돌리기 의 근거.
 */
@Entity
@Table(schema = "public", name = "tb_revision")
@Getter
@Setter
public class WikiRevision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)   // bigserial
    private Long id;

    private String slug;       // 어떤 문서의 이력인가
    private int version;       // 그 시점 버전
    private String title;
    private String body;       // 그 시점 본문 스냅샷
    private String editor;     // 작성자
    private OffsetDateTime createdAt;
}
