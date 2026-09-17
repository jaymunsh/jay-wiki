package cloud.leneu.jaywiki.board;

import cloud.leneu.jaywiki.board.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 게시판 API — /api/board.
 *  GET    /posts?page=&size=          목록(최신순 페이징)
 *  GET    /posts/{id}                 상세(+조회수 Redis INCR)
 *  POST   /posts                      익명 작성
 *  GET    /posts/{id}/comments        댓글 목록
 *  POST   /posts/{id}/comments        댓글 작성
 *  POST   /posts/{id}/delete          익명 본인 삭제(비밀번호)
 *  DELETE /posts/{id}                 관리자 삭제(ROLE_ADMIN — SecurityConfig)
 *
 * 조회/작성/댓글/본인삭제는 공개(익명 게시판). DELETE 만 관리자.
 * (SecurityConfig 에서 POST /api/board/** 를 permitAll, DELETE 는 /api/** hasRole(ADMIN))
 */
@RestController
@RequestMapping("/api/board")
@RequiredArgsConstructor
public class BoardController {

    private final BoardService service;

    @GetMapping("/posts")
    public PageResponse<PostSummaryDto> list(@RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "20") int size) {
        return service.list(page, size);
    }

    /** 검색 방식 비교(03B Phase1): 같은 q 를 LIKE/tsvector 로 조회 + 소요시간. 공개. */
    @GetMapping("/search")
    public SearchCompareResult search(@RequestParam String q) {
        return service.compare(q);
    }

    @GetMapping("/suggest")
    public List<String> suggest(@RequestParam String q) {
        return service.suggest(q);
    }

    @GetMapping("/posts/{id}")
    public PostDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping("/posts")
    public ResponseEntity<PostDto> create(@Valid @RequestBody PostCreateRequest req, Authentication auth) {
        CommunityPost saved = service.create(req, auth);
        return ResponseEntity.ok(PostDto.from(saved, saved.getViews()));
    }

    @GetMapping("/posts/{id}/comments")
    public List<CommentDto> comments(@PathVariable Long id) {
        return service.comments(id);
    }

    @PostMapping("/posts/{id}/comments")
    public ResponseEntity<CommentDto> addComment(@PathVariable Long id,
                                                 @Valid @RequestBody CommentCreateRequest req,
                                                 Authentication auth) {
        return ResponseEntity.ok(CommentDto.from(service.addComment(id, req, auth)));
    }

    /** 익명 본인 삭제 — POST(공개). 비밀번호 확인. */
    @PostMapping("/posts/{id}/delete")
    public ResponseEntity<Void> deleteByPassword(@PathVariable Long id,
                                                 @RequestBody DeleteRequest req) {
        service.deleteByPassword(id, req.password());
        return ResponseEntity.noContent().build();
    }

    /** 관리자 삭제 — DELETE(ROLE_ADMIN). */
    @DeleteMapping("/posts/{id}")
    public ResponseEntity<Void> deleteByAdmin(@PathVariable Long id) {
        service.deleteByAdmin(id);
        return ResponseEntity.noContent().build();
    }
}
