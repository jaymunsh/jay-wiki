package cloud.leneu.jaywiki.search;

import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 검색 API.
 *  GET /api/search?q=키워드
 *  - q 가 비면 @NotBlank 위반 → 400 problem+json (GlobalExceptionHandler)
 *  - 응답 헤더 X-Cache: HIT|MISS (Redis 캐시 적중 여부, 데모용)
 *  - @Validated 가 있어야 @RequestParam 의 @NotBlank 가 동작
 */
@RestController
@Validated
@RequiredArgsConstructor
public class SearchController {

    private final SearchService service;

    @GetMapping("/api/search")
    public ResponseEntity<List<SearchHit>> search(@RequestParam @NotBlank String q) {
        SearchService.Result result = service.search(q);
        return ResponseEntity.ok()
                .header("X-Cache", result.cacheHit() ? "HIT" : "MISS")
                .header("X-Search-Engine", result.engine())
                .body(result.hits());
    }
}
