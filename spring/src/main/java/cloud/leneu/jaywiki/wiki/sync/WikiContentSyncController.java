package cloud.leneu.jaywiki.wiki.sync;

import cloud.leneu.jaywiki.wiki.ArticleService;
import cloud.leneu.jaywiki.wiki.TabService;
import cloud.leneu.jaywiki.wiki.WikiFeaturedController;
import cloud.leneu.jaywiki.wiki.WikiFeaturedService;
import cloud.leneu.jaywiki.wiki.dto.ArticleDto;
import cloud.leneu.jaywiki.wiki.dto.ArticleSaveRequest;
import cloud.leneu.jaywiki.wiki.dto.TabDto;
import cloud.leneu.jaywiki.wiki.dto.TabSaveRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/content-sync")
@RequiredArgsConstructor
public class WikiContentSyncController {

    static final String TOKEN_HEADER = "X-Content-Sync-Token";

    private final ContentSyncAuthorizer authorizer;
    private final TabService tabs;
    private final ArticleService articles;
    private final WikiFeaturedService featured;

    @GetMapping("/ready")
    public ResponseEntity<Void> ready(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token
    ) {
        authorizer.requireValid(token);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/tabs")
    public TabDto saveTab(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @Valid @RequestBody TabSaveRequest request
    ) {
        authorizer.requireValid(token);
        return TabDto.of(tabs.save(request), java.util.List.of());
    }

    /** 빈 탭 삭제. 글이 든 탭은 TabService 가 409 로 거부한다(세는 쪽이 서버여야 한다). */
    @DeleteMapping("/tabs/{tabId}")
    public ResponseEntity<Void> deleteTab(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @PathVariable String tabId
    ) {
        authorizer.requireValid(token);
        tabs.delete(tabId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/articles")
    public ArticleDto saveArticle(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @Valid @RequestBody ArticleSaveRequest request
    ) {
        authorizer.requireValid(token);
        return ArticleDto.from(articles.save(request));
    }

    /**
     * 첫 화면 대표 문서. 저장소의 시드가 정본이 된다 -- 위키 본문과 같은 규칙이다.
     * 개수 제한·중복·없는 slug 검사는 전부 WikiFeaturedService.replace 가 이미 한다.
     *
     * 글보다 먼저 부르면 안 된다. 새로 생기는 글을 대표로 걸면 그 글이 아직 없어서 400 이다.
     * 시드가 글을 다 쓴 뒤 마지막에 부른다.
     */
    @PutMapping("/featured")
    public ResponseEntity<Void> replaceFeatured(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @RequestBody WikiFeaturedController.ReplaceRequest request
    ) {
        authorizer.requireValid(token);
        featured.replace(request.slugs());
        return ResponseEntity.noContent().build();
    }
}
