package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
import cloud.leneu.jaywiki.blog.dto.BlogPostSaveRequest;
import cloud.leneu.jaywiki.common.BadRequestException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 시리즈 연결(V31)의 규칙을 고정한다. 여기서 지키려는 것은 하나다 --
 * 한쪽에만 적힌 연결은 없다. 어느 글에서 적든 상대 글도 같은 관계를 말해야 한다.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlogSeriesLinkTest {

    @Autowired BlogPostService postService;
    @Autowired BlogPostRepository posts;
    @Autowired BlogCategoryRepository categories;
    @Autowired JdbcTemplate jdbc;

    private Long categoryId;

    @BeforeEach
    void setUp() {
        clean();
        categoryId = categories.findBySlug("tech-lab").orElseThrow().getId();
    }

    @AfterEach
    void tearDown() {
        clean();
    }

    private void clean() {
        // 연결이 남아 있으면 외래키가 삭제를 막는다. 먼저 풀고 지운다.
        jdbc.update("update public.tb_blog_post set prev_post_id = null, next_post_id = null "
                + "where slug like 'series-%'");
        jdbc.update("delete from public.tb_blog_post where slug like 'series-%'");
    }

    private Long create(String slug) {
        return postService.create(request(slug, null, null)).id();
    }

    private BlogPostSaveRequest request(String slug, Long prev, Long next) {
        return new BlogPostSaveRequest(slug, "제목 " + slug, "요약", "본문", categoryId, null,
                "published", OffsetDateTime.parse("2026-08-01T00:00:00Z"), true, List.of(), prev, next, null);
    }

    private BlogPost reload(Long id) {
        return posts.findById(id).orElseThrow();
    }

    @Test
    void writesTheOppositeSideToo() {
        Long first = create("series-first");
        Long second = create("series-second");

        postService.update(second, request("series-second", first, null));

        assertThat(reload(second).getPrevPostId()).isEqualTo(first);
        assertThat(reload(first).getNextPostId()).isEqualTo(second);
    }

    @Test
    void clearsBothSidesWhenLinkRemoved() {
        Long first = create("series-first");
        Long second = create("series-second");
        postService.update(second, request("series-second", first, null));

        postService.update(second, request("series-second", null, null));

        assertThat(reload(second).getPrevPostId()).isNull();
        assertThat(reload(first).getNextPostId()).isNull();
    }

    @Test
    void releasesThirdPostWhenItIsDisplaced() {
        Long first = create("series-first");
        Long second = create("series-second");
        Long third = create("series-third");
        postService.update(second, request("series-second", first, null));

        // 3번이 1번의 뒤를 차지한다. 밀려난 2번의 '앞선 글'도 함께 풀려야 한다.
        postService.update(third, request("series-third", first, null));

        assertThat(reload(first).getNextPostId()).isEqualTo(third);
        assertThat(reload(third).getPrevPostId()).isEqualTo(first);
        assertThat(reload(second).getPrevPostId()).isNull();
    }

    @Test
    void rejectsSelfLink() {
        Long only = create("series-first");
        assertThatThrownBy(() -> postService.update(only, request("series-first", only, null)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsSamePostOnBothSides() {
        Long first = create("series-first");
        Long second = create("series-second");
        assertThatThrownBy(() -> postService.update(second, request("series-second", first, first)))
                .isInstanceOf(BadRequestException.class);
    }

    /** 링크만 바꾼 저장은 unchanged 로 걸러지면 안 된다. 걸러지면 화면에서 고쳐도 안 먹는다. */
    @Test
    void doesNotSkipSaveWhenOnlyLinkChanged() {
        Long first = create("series-first");
        Long second = create("series-second");

        postService.update(second, request("series-second", first, null));

        assertThat(reload(second).getPrevPostId()).isEqualTo(first);
    }

    /** 발행 전 글로 이어 두면 화면은 그 칸을 안 그린다. 링크 자체는 남는다. */
    @Test
    void hidesLinkToUnpublishedPost() {
        Long first = create("series-first");
        Long second = create("series-second");
        postService.update(second, request("series-second", first, null));

        jdbc.update("update public.tb_blog_post set status = 'draft' where id = ?", first);

        assertThat(postService.get(second).prevPost()).isNull();
        assertThat(reload(second).getPrevPostId()).isEqualTo(first);
    }
}
