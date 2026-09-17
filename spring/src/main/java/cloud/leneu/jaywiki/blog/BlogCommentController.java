package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogCommentCreateRequest;
import cloud.leneu.jaywiki.blog.dto.BlogCommentDto;
import cloud.leneu.jaywiki.common.ClientIpResolver;
import cloud.leneu.jaywiki.stats.EntrySourceCookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/blog")
@RequiredArgsConstructor
public class BlogCommentController {

    private final BlogCommentService service;

    /** 삭제 요청 본문. DELETE 는 본문을 싣기 애매해 POST 로 받는다. */
    public record DeleteRequest(String password) {
    }

    @GetMapping("/posts/{id}/comments")
    public List<BlogCommentDto> list(@PathVariable Long id) {
        return service.list(id);
    }

    @PostMapping("/posts/{id}/comments")
    public BlogCommentDto create(@PathVariable Long id,
                                 @RequestBody BlogCommentCreateRequest body,
                                 HttpServletRequest request) {
        return service.create(id, body, ClientIpResolver.resolve(request),
                EntrySourceCookie.read(request));
    }

    @PostMapping("/comments/{id}/delete")
    public ResponseEntity<Void> delete(@PathVariable Long id, @RequestBody DeleteRequest body) {
        service.delete(id, body.password());
        return ResponseEntity.noContent().build();
    }
}
