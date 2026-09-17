package cloud.leneu.jaywiki.wiki;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 위키 문서 엔티티 = public.tb_article 테이블 (V1__init.sql).
 *
 * - 본문의 SoT 는 이 테이블이다. 수정 시 직전 본문은 tb_revision 에 스냅샷으로 남는다.
 * - lombok @Getter/@Setter 로 보일러플레이트 제거.
 * - 필드명(parentId) → 컬럼(parent_id) 은 Spring Boot 기본 네이밍 전략(snake_case)이 자동 변환.
 *   그래서 @Column(name=...) 을 일일이 안 붙여도 됨.
 */
@Entity
@Table(schema = "public", name = "tb_article")
@Getter
@Setter
public class WikiArticle {

    @Id
    private String slug;          // PK. 파일명 (예: redis)

    private String parentId;      // 1차 탭/폴더 (예: data)
    private String title;
    private String summary;

    @Column(columnDefinition = "text")
    private String body;          // MD 본문 raw

    private String kind;          // wiki / note / postmortem ...
    private String status;        // published / draft / archived
    private String tags;          // 콤마 구분 (슬라이스2 단순화)
    private LocalDate lastReview;
    private OffsetDateTime syncedAt;

    // --- V2: 본문 DB SoT + 버전 ---
    private int version = 1;      // 콘텐츠 버전(내가 관리. JPA @Version 아님). 수정 시 +1
    private int sortOrder = 0;    // 탭 내 문서 정렬
    private OffsetDateTime updatedAt;  // 마지막 수정 시각

    /**
     * 문서를 처음 만든 시각. 목록 정렬에는 쓰지 않고 "언제 쓴 글인지" 표시에만 쓴다.
     * 기존 문서는 V12 에서 seed 파일의 최초 커밋 날짜로 백필했고,
     * 근거를 찾지 못한 문서는 null 로 남아 있다.
     */
    private OffsetDateTime createdAt;

    /** 목차 노출 여부 (V19). 세 줄 요약 아래에 ##/### 목차를 그린다. 기본 꺼짐. */
    private boolean tocEnabled = false;

    /**
     * 조회수 (V21). 시드가 덮지 않는다 — save 는 요청에 담긴 필드만 엔티티에 옮기므로
     * 배포가 시드를 다시 돌려도 이 값은 남는다. 그래서 운영과 로컬이 각자 자기 숫자를 갖는다.
     * 증가는 이 엔티티를 거치지 않고 UPDATE 한 문장으로 한다(WikiArticleRepository.incrementViewCount).
     */
    private long viewCount = 0;
}
