package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.wiki.WikiArticle;
import cloud.leneu.jaywiki.wiki.WikiArticleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 검색 통합 테스트 — 실제 PostgreSQL + Redis(Testcontainers)로 검증.
 *
 * - TestcontainersConfiguration (Spring Initializr 가 생성) 을 @Import 하면
 *   PG/Redis 컨테이너가 뜨고 @ServiceConnection 으로 자동 연결됨.
 * - Flyway 의 schemas:[public] 덕에 테스트 PG 에도 public.tb_article 이 생성됨.
 * - @Transactional 을 안 붙인다: seed 가 커밋돼야 RANDOM_PORT 서버 스레드가 그 데이터를 봄.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class SearchIntegrationTest {

    @Autowired
    TestRestTemplate rest;

    @Autowired
    WikiArticleRepository repo;

    @BeforeEach
    void seed() {
        repo.deleteAll();
        WikiArticle a = new WikiArticle();
        a.setSlug("redis");
        a.setParentId("data");
        a.setTitle("Redis 패턴");
        a.setSummary("캐시가 전부가 아니다");
        a.setBody("Redis 는 자료구조 서버");
        a.setKind("wiki");
        a.setStatus("published");
        a.setSyncedAt(OffsetDateTime.now());
        a.setUpdatedAt(OffsetDateTime.now());   // V2: updated_at NOT NULL
        repo.save(a);
    }

    @Test
    void 검색이_되고_두번째는_캐시히트() {
        ResponseEntity<String> first = rest.getForEntity("/api/search?q=redis", String.class);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(first.getBody()).contains("Redis 패턴");
        assertThat(first.getHeaders().getFirst("X-Cache")).isEqualTo("MISS");
        assertThat(first.getHeaders().getFirst("X-Search-Engine")).isEqualTo("POSTGRESQL_LIKE");

        ResponseEntity<String> second = rest.getForEntity("/api/search?q=redis", String.class);
        assertThat(second.getHeaders().getFirst("X-Cache")).isEqualTo("HIT");
        assertThat(second.getHeaders().getFirst("X-Search-Engine")).isEqualTo("POSTGRESQL_LIKE");
    }

    @Test
    void 빈_쿼리는_400() {
        ResponseEntity<String> r = rest.getForEntity("/api/search?q=", String.class);
        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
