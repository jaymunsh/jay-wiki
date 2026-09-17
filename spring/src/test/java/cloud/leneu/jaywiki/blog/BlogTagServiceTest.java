package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.TestcontainersConfiguration;
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

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BlogTagServiceTest {

    @Autowired BlogTagService tags;
    @Autowired BlogPostRepository posts;
    @Autowired BlogPostTagRepository postTags;
    @Autowired BlogCategoryRepository categories;
    @Autowired BlogPostService postService;
    @Autowired JdbcTemplate jdbc;

    private Long postId;

    @BeforeEach
    void setUp() {
        postTags.deleteAll();
        posts.deleteAll();
        BlogPost post = new BlogPost();
        post.setSlug("tagged");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("태그 붙은 글");
        post.setBody("본문");
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.parse("2026-08-01T00:00:00Z"));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        postId = posts.save(post).getId();
    }

    // 공유 DB(Testcontainers 컨테이너 재사용)에 다른 테스트 클래스가 남을 수 있으므로
    // BlogCategoryServiceTest 의 관례를 따라 명시적으로 지운다.
    // 연결(tb_blog_post_tag) → 태그(tb_blog_tag) → 글(tb_blog_post) 순서로 지운다.
    @AfterEach
    void 만든_연결과_태그와_글을_지운다() {
        jdbc.update("delete from public.tb_blog_post_tag");
        jdbc.update("delete from public.tb_blog_tag where name in (?, ?, ?, ?, ?, ?, ?)",
                "swift", "macos", "iokit", "pwa", "kotlin", "draft-only", "both");
        jdbc.update("delete from public.tb_blog_post where slug in (?, ?)", "tagged", "draft-tagged");
    }

    @Test
    void 없는_태그는_만들고_이름순으로_돌려준다() {
        tags.attach(postId, List.of("swift", "macos", "iokit"));

        assertThat(tags.namesOf(postId)).containsExactly("iokit", "macos", "swift");
    }

    @Test
    void 다시_붙이면_빠진_태그의_연결이_사라진다() {
        tags.attach(postId, List.of("swift", "macos"));

        tags.attach(postId, List.of("swift"));

        assertThat(tags.namesOf(postId)).containsExactly("swift");
    }

    @Test
    void 같은_태그를_두_글에_붙여도_태그_행은_하나다() {
        tags.attach(postId, List.of("pwa"));

        assertThat(tags.postIdsOf("pwa")).containsExactly(postId);
        assertThat(tags.counts()).anySatisfy(c -> {
            assertThat(c.name()).isEqualTo("pwa");
            assertThat(c.count()).isEqualTo(1L);
        });
    }

    @Test
    void 단건_조회에_태그가_담긴다() {
        tags.attach(postId, List.of("swift", "macos"));

        assertThat(postService.get(postId).tags()).containsExactly("macos", "swift");
    }

    @Test
    void 초안에만_붙은_태그는_counts에서_아예_빠지고_같이_붙은_태그는_발행_글만_센다() {
        BlogPost draft = new BlogPost();
        draft.setSlug("draft-tagged");
        draft.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        draft.setTitle("초안");
        draft.setBody("본문");
        draft.setStatus("draft");
        draft.setPublishedAt(null);
        draft.setCreatedAt(OffsetDateTime.now());
        draft.setUpdatedAt(OffsetDateTime.now());
        Long draftId = posts.save(draft).getId();

        // postId 는 setUp 에서 만든 published 글이다.
        tags.attach(postId, List.of("kotlin", "both"));
        tags.attach(draftId, List.of("draft-only", "both"));

        List<BlogTagService.TagCount> counts = tags.counts();

        // 발행 글에만 붙은 태그는 정상적으로 개수가 잡힌다.
        assertThat(counts).filteredOn(c -> c.name().equals("kotlin"))
                .singleElement()
                .satisfies(c -> assertThat(c.count()).isEqualTo(1L));

        // 초안에만 붙은 태그는 count=0 으로 보고되는 게 아니라 결과에서 아예 빠진다.
        assertThat(counts).extracting(BlogTagService.TagCount::name).doesNotContain("draft-only");

        // 발행 글과 초안 양쪽에 붙은 태그는 발행 글만 센다.
        assertThat(counts).filteredOn(c -> c.name().equals("both"))
                .singleElement()
                .satisfies(c -> assertThat(c.count()).isEqualTo(1L));
    }
}
