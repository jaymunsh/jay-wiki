package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.wiki.ArticleService;
import cloud.leneu.jaywiki.wiki.dto.ArticleSaveRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class WikiViewCountTest {
    @Autowired ArticleService service;
    @Autowired JdbcTemplate jdbc;
    private ArticleSaveRequest req(String title) {
        return new ArticleSaveRequest("viewcount-v2", "data", title, "요약", "본문", "wiki", "published", "redis", null, 0, "admin");
    }
    @Test void readEndpointsDoNotCountAndEditsPreserveExistingCounts() {
        service.save(req("제목"));
        jdbc.update("update public.tb_article set view_count=7 where slug='viewcount-v2'");
        service.get("viewcount-v2");
        service.view("viewcount-v2", "203.0.113.1", null, null);
        assertThat(service.get("viewcount-v2").getViewCount()).isEqualTo(7);
        service.save(req("수정"));
        assertThat(service.get("viewcount-v2").getViewCount()).isEqualTo(7);
    }
}
