package cloud.leneu.jaywiki.wiki;

import cloud.leneu.jaywiki.common.ClientIpResolver;
import cloud.leneu.jaywiki.wiki.dto.ArticleDto;
import cloud.leneu.jaywiki.wiki.dto.ArticleSaveRequest;
import cloud.leneu.jaywiki.wiki.dto.RevisionDto;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 위키 본문 API.
 *  GET    /api/articles/{slug}                 본문 조회
 *  POST   /api/articles                        생성/수정(upsert) — 수정 시 revision 스냅샷
 *  DELETE /api/articles/{slug}                 삭제
 *  GET    /api/articles/{slug}/revisions       버전 목록
 *  GET    /api/articles/{slug}/revisions/{v}   특정 버전(본문 포함)
 *  POST   /api/articles/{slug}/revert/{v}      되돌리기
 *
 * 변경(POST/DELETE/revert)은 prod 에서 Cloudflare Access(admin) 로 보호. 로컬은 오픈.
 */
@RestController
@RequestMapping("/api/articles")
@RequiredArgsConstructor
public class ArticleController {

    private final ArticleService service;

    /**
     * view=true 일 때만 조회수를 올린다. 기본값이 false 인 이유는 이 화면이 탭을 바꿀 때도
     * 첫 글을 자동으로 불러오기 때문이다 — 그것까지 세면 각 탭의 첫 글만 부푼다.
     * 사람이 고른 것(주소로 진입, 목록에서 선택)만 view=true 로 온다.
     */
    @GetMapping("/{slug}")
    public ArticleDto get(@PathVariable String slug,
                          @RequestParam(defaultValue = "false") boolean view,
                          HttpServletRequest request) {
        return ArticleDto.from(view
                ? service.view(slug, ClientIpResolver.resolve(request),
                        request.getHeader("referer"), request.getHeader("user-agent"))
                : service.get(slug));
    }

    /** 많이 쓰인 태그 상위 n 개 — 검색 화면의 추천 키워드. */
    @GetMapping("/tags/top")
    public List<ArticleService.TagCount> topTags(@RequestParam(defaultValue = "5") int limit) {
        return service.topTags(limit);
    }

    @PostMapping
    public ResponseEntity<ArticleDto> save(@Valid @RequestBody ArticleSaveRequest req) {
        return ResponseEntity.ok(ArticleDto.from(service.save(req)));
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Void> delete(@PathVariable String slug) {
        service.delete(slug);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{slug}/revisions")
    public List<RevisionDto> revisions(@PathVariable String slug) {
        return service.revisions(slug).stream().map(RevisionDto::summary).toList();
    }

    @GetMapping("/{slug}/revisions/{version}")
    public RevisionDto revision(@PathVariable String slug, @PathVariable int version) {
        return RevisionDto.full(service.revision(slug, version));
    }

    @PostMapping("/{slug}/revert/{version}")
    public ArticleDto revert(@PathVariable String slug, @PathVariable int version,
                             @RequestParam(required = false) String editor) {
        return ArticleDto.from(service.revert(slug, version, editor));
    }
}
