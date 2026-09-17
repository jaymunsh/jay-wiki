package cloud.leneu.jaywiki.blog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 블로그 글 = public.tb_blog_post (V13).
 * id 가 URL 의 정본이고 slug 는 읽기용으로 뒤에 붙는다.
 * 위키와 달리 version 과 revision 이 없다. 원본은 이 행 하나다.
 */
@Entity
@Table(schema = "public", name = "tb_blog_post")
@Getter
@Setter
public class BlogPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String slug;
    private Long categoryId;
    private String title;
    private String summary;

    @Column(columnDefinition = "text")
    private String body;

    private String coverAssetId;
    private String status = "draft";
    private OffsetDateTime publishedAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    /** 목차 노출 여부 (V20). 위키의 tb_article.toc_enabled 와 같은 이름·같은 뜻이다. 기본 켜짐. */
    private boolean tocEnabled = true;

    /**
     * 글쓴이가 지정한 시리즈 연결 (V31). 발행일 이웃과 다르다 -- 그건 시간순이고 이건 이어서 쓴 글이다.
     * 양쪽을 다 들고 있고, 어긋나지 않게 맞추는 일은 BlogPostService.applySeriesLinks 가 한다.
     */
    private Long prevPostId;
    private Long nextPostId;

    /** 글별 누적 조회수. 게시판과 달리 Redis 에 쌓아두지 않고 바로 올린다(flush 배치가 없어 유실되던 문제를 피한다). */
    private long viewCount;
}
