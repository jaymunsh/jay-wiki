package cloud.leneu.jaywiki.search;

import cloud.leneu.jaywiki.wiki.WikiArticleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

/**
 * 검색 서비스 — Redis 캐시(cache-aside) + PG 조회.
 *
 * - @Cacheable 대신 Redis 를 '수동' 으로 다룬다:
 *   X-Cache: HIT/MISS 헤더를 주려면 hit 여부를 직접 알아야 하고, Redis 사용을 명시적으로 보여주려고.
 * - 캐시 키: cache:search:<소문자 q>, TTL 60초.
 * - lombok @RequiredArgsConstructor 로 final 필드 3개 생성자 자동.
 */
@Service
@RequiredArgsConstructor
public class SearchService {

    private final WikiArticleRepository repo;
    private final WikiOpenSearchService openSearch;
    private final StringRedisTemplate redis;   // 문자열 값 전용 RedisTemplate (Spring Boot 자동 구성)
    private final ObjectMapper om;             // JSON 직렬화 (Spring Boot 자동 구성)

    /** 결과 + 캐시 적중 여부(컨트롤러가 X-Cache 헤더로 사용). */
    public record Result(List<SearchHit> hits, boolean cacheHit, String engine) {}

    private record CachedResult(List<SearchHit> hits, String engine) {}

    public Result search(String q) {
        String key = "cache:wiki-search:v2:" + q.toLowerCase();

        // 1) 캐시 조회
        String cached = redis.opsForValue().get(key);
        if (cached != null) {
            CachedResult result = read(cached);
            return new Result(result.hits(), true, result.engine());
        }

        WikiOpenSearchService.SearchResult indexed = openSearch.search(q);
        String engine = indexed.available() ? "OPENSEARCH_NORI" : "POSTGRESQL_LIKE";
        List<SearchHit> hits = indexed.available()
                ? indexed.hits()
                : repo.search(q).stream().map(SearchHit::from).toList();
        redis.opsForValue().set(key, write(new CachedResult(hits, engine)), Duration.ofSeconds(60));
        return new Result(hits, false, engine);
    }

    // --- JSON <-> List<SearchHit> 변환 ---
    private String write(CachedResult result) {
        try {
            return om.writeValueAsString(result);
        } catch (Exception e) {
            throw new RuntimeException("검색 결과 직렬화 실패", e);
        }
    }

    private CachedResult read(String json) {
        try {
            return om.readValue(json, CachedResult.class);
        } catch (Exception e) {
            throw new RuntimeException("검색 결과 역직렬화 실패", e);
        }
    }
}
