package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.wiki.WikiArticle;
import cloud.leneu.jaywiki.wiki.WikiArticleRepository;
import cloud.leneu.jaywiki.wiki.WikiFeaturedRepository;
import cloud.leneu.jaywiki.wiki.WikiFeaturedService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * '핵심 위키' 목록. 저장을 목록 단위로 받는 이유가 여기서 드러난다 —
 * 순서를 뒤집어도 중간 충돌 없이 한 번에 바뀐다.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class WikiFeaturedIntegrationTest {

    @Autowired
    WikiFeaturedService service;
    @Autowired
    WikiFeaturedRepository featuredRepository;
    @Autowired
    WikiArticleRepository articleRepository;

    /** 다른 테스트가 쓰는 탭에 픽스처를 넣지 않는다 — 'start' 에 넣었더니 탭 목록을 세는
     *  테스트가 같이 깨졌다. 픽스처는 만든 자리에서 지운다. */
    private static final String FIXTURE_TAB = "featured-fixture-tab";

    @AfterEach
    void cleanup() {
        featuredRepository.deleteAllInBatch();
        articleRepository.deleteAll(articleRepository.findByParentIdOrderBySortOrderAscCreatedAtDesc(FIXTURE_TAB));
    }

    @BeforeEach
    void seed() {
        featuredRepository.deleteAllInBatch();
        IntStream.rangeClosed(1, 6).forEach(i -> {
            String slug = "featured-fixture-" + i;
            if (!articleRepository.existsById(slug)) {
                WikiArticle a = new WikiArticle();
                a.setSlug(slug);
                a.setParentId(FIXTURE_TAB);
                a.setTitle("고정글 " + i);
                a.setBody("본문");
                a.setKind("wiki");
                a.setStatus("published");
                java.time.OffsetDateTime now = java.time.OffsetDateTime.now();
                a.setSyncedAt(now);
                a.setCreatedAt(now);
                a.setUpdatedAt(now);
                articleRepository.save(a);
            }
        });
    }

    @Test
    void 준_순서대로_전시된다() {
        service.replace(List.of("featured-fixture-3", "featured-fixture-1"));

        assertThat(service.list()).extracting("slug")
                .containsExactly("featured-fixture-3", "featured-fixture-1");
    }

    @Test
    void 순서를_뒤집어도_한_번에_바뀐다() {
        service.replace(List.of("featured-fixture-1", "featured-fixture-2"));
        service.replace(List.of("featured-fixture-2", "featured-fixture-1"));

        assertThat(service.list()).extracting("slug")
                .containsExactly("featured-fixture-2", "featured-fixture-1");
    }

    @Test
    void 정원을_넘기면_저장하지_않는다() {
        service.replace(List.of("featured-fixture-1"));

        List<String> tooMany = IntStream.rangeClosed(1, WikiFeaturedService.MAX + 1)
                .mapToObj(i -> "featured-fixture-" + i).toList();
        assertThatThrownBy(() -> service.replace(tooMany)).isInstanceOf(ResponseStatusException.class);

        // 실패한 저장이 기존 목록을 건드리지 않았다.
        assertThat(service.list()).extracting("slug").containsExactly("featured-fixture-1");
    }

    @Test
    void 없는_글이나_중복은_거절한다() {
        assertThatThrownBy(() -> service.replace(List.of("no-such-article")))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.replace(List.of("featured-fixture-1", "featured-fixture-1")))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void 빈_목록이면_전시를_끈다() {
        service.replace(List.of("featured-fixture-1"));
        service.replace(List.of());

        assertThat(service.list()).isEmpty();
    }
}
