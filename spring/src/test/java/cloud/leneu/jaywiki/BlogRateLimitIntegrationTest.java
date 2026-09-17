package cloud.leneu.jaywiki;

import cloud.leneu.jaywiki.blog.BlogCategoryRepository;
import cloud.leneu.jaywiki.blog.BlogPost;
import cloud.leneu.jaywiki.blog.BlogPostRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 블로그 댓글 작성도 로그인 없이 되므로 게시판과 동일한 anonymous rate limit 을 받아야 한다.
 * BoardWebConfig 가 /api/blog/** 를 인터셉터 대상에서 빼먹으면, shouldLimit() 의 블로그 분기가
 * 죽은 코드가 되어 이 테스트가 실패로 잡아낸다. BoardRateLimitIntegrationTest 와 같은 구성을 따른다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "app.board.rate-limit.enabled=true",
                "app.board.rate-limit.capacity=2",
                "app.board.rate-limit.window=1m"
        })
@Import(TestcontainersConfiguration.class)
class BlogRateLimitIntegrationTest {

    @Autowired
    TestRestTemplate rest;

    @Autowired
    BlogPostRepository posts;

    @Autowired
    BlogCategoryRepository categories;

    @Autowired
    StringRedisTemplate redis;

    private static final ParameterizedTypeReference<Map<String, Object>> MAP =
            new ParameterizedTypeReference<>() {};

    private Long postId;

    @BeforeEach
    void setUp() {
        // BoardRateLimitIntegrationTest 와 동일한 @SpringBootTest 프로퍼티를 쓰므로 Spring 이
        // 컨텍스트(따라서 같은 Testcontainers Redis)를 재사용할 수 있다. 인터셉터의 rate-limit
        // 키는 board/blog 구분 없이 "board:write:rate:<ip>" 하나를 공유하므로, 남은 카운트가
        // 있으면 이 테스트도 저 테스트도 서로의 예산을 갉아먹는다. 시작 전에 비운다.
        clearRateLimitKeys();
        BlogPost post = new BlogPost();
        post.setSlug("rate-limit-post");
        post.setCategoryId(categories.findBySlug("tech-lab").orElseThrow().getId());
        post.setTitle("레이트리밋 테스트");
        post.setSummary("요약");
        post.setBody("본문");
        post.setStatus("published");
        post.setPublishedAt(OffsetDateTime.parse("2026-08-01T00:00:00Z"));
        post.setCreatedAt(OffsetDateTime.now());
        post.setUpdatedAt(OffsetDateTime.now());
        postId = posts.save(post).getId();
    }

    @AfterEach
    void tearDown() {
        posts.deleteById(postId);
        clearRateLimitKeys();
    }

    private void clearRateLimitKeys() {
        Set<String> keys = redis.keys("board:write:rate:*");
        if (keys != null && !keys.isEmpty()) redis.delete(keys);
    }

    @Test
    void 익명_블로그_댓글_POST는_제한을_넘으면_429를_준다() {
        ResponseEntity<Map<String, Object>> first = rest.exchange(
                "/api/blog/posts/" + postId + "/comments", HttpMethod.POST,
                new HttpEntity<>(Map.of("authorName", "테스터", "password", "pw1234", "body", "첫 댓글")),
                MAP);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<Map<String, Object>> second = rest.exchange(
                "/api/blog/posts/" + postId + "/comments", HttpMethod.POST,
                new HttpEntity<>(Map.of("authorName", "테스터", "password", "pw1234", "body", "두 번째 댓글")),
                MAP);
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<String> third = rest.exchange(
                "/api/blog/posts/" + postId + "/comments", HttpMethod.POST,
                new HttpEntity<>(Map.of("authorName", "테스터", "password", "pw1234", "body", "세 번째 댓글")),
                String.class);
        assertThat(third.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(third.getBody()).contains("rate-limit");
    }
}
