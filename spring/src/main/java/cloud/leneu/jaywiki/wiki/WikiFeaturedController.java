package cloud.leneu.jaywiki.wiki;

import cloud.leneu.jaywiki.wiki.dto.ArticleSummaryDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 첫 화면 '핵심 위키' 목록 API.
 *  GET /api/wiki/featured   전시 목록(공개). 화면이 탭을 누를 때 부른다
 *  PUT /api/wiki/featured   목록 전체 교체(ADMIN)
 *
 * 트리(/api/tabs)에 얹지 않은 이유는 첫 화면이 늘 지고 다니는 값이 아니라서다.
 * 탭을 누른 사람만 이 요청을 보낸다.
 *
 * GET 은 SecurityConfig 의 'GET /api/** 공개' 에, PUT 은 그 아래 '나머지는 ADMIN' 에 걸린다.
 */
@RestController
@RequestMapping("/api/wiki/featured")
@RequiredArgsConstructor
public class WikiFeaturedController {

    private final WikiFeaturedService service;

    @GetMapping
    public List<ArticleSummaryDto> list() {
        return service.list();
    }

    public record ReplaceRequest(List<String> slugs) {}

    @PutMapping
    public ResponseEntity<Void> replace(@RequestBody ReplaceRequest req) {
        service.replace(req.slugs());
        return ResponseEntity.noContent().build();
    }
}
