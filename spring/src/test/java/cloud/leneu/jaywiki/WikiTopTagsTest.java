package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.wiki.ArticleService;
import cloud.leneu.jaywiki.wiki.dto.ArticleSaveRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 검색 화면의 추천 키워드가 쓰는 '많이 쓰인 태그'.
 * 콤마 문자열을 쪼개 세는 것, 공백을 다듬는 것, draft 를 빼는 것이 요점이다.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class WikiTopTagsTest {

    @Autowired ArticleService service;

    private ArticleSaveRequest req(String slug, String status, String tags) {
        return new ArticleSaveRequest(slug, "data", "제목 " + slug, "요약", "본문",
                "wiki", status, tags, null, 0, "admin");
    }

    @Test
    void 발행된_문서의_태그만_쪼개서_센다() {
        service.save(req("tagtest-a", "published", "redis, k3s"));
        service.save(req("tagtest-b", "published", "redis,  k3s"));
        service.save(req("tagtest-c", "published", "redis"));
        service.save(req("tagtest-d", "draft", "redis, kafka"));   // draft 는 세지 않는다
        service.save(req("tagtest-e", "published", ""));           // 빈 태그는 항목을 만들지 않는다

        List<ArticleService.TagCount> top = service.topTags(20);
        assertThat(top).extracting(ArticleService.TagCount::name).doesNotContain("", "kafka");

        // 앞뒤 공백이 다듬어져 'k3s' 하나로 뭉친다.
        assertThat(count(top, "k3s")).isEqualTo(2);
        assertThat(count(top, "redis")).isEqualTo(3);

        // 많이 쓰인 순이므로 redis 가 k3s 보다 앞에 온다.
        assertThat(indexOf(top, "redis")).isLessThan(indexOf(top, "k3s"));
    }

    @Test
    void limit_을_넘겨_요청해도_그만큼만_준다() {
        service.save(req("tagtest-f", "published", "one, two, three, four, five, six"));
        assertThat(service.topTags(5)).hasSize(5);
    }

    private long count(List<ArticleService.TagCount> top, String name) {
        return top.stream().filter(t -> t.name().equals(name)).findFirst().orElseThrow().count();
    }

    private int indexOf(List<ArticleService.TagCount> top, String name) {
        return top.stream().map(ArticleService.TagCount::name).toList().indexOf(name);
    }
}
