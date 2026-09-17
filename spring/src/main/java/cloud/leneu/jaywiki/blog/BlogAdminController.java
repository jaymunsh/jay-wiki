package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogAdminPostDto;
import cloud.leneu.jaywiki.blog.dto.BlogPostSaveRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 블로그 글 관리. SecurityConfig 가 /api/admin/blog/** 를 ADMIN 으로 묶는다.
 * 그 규칙은 GET /api/** 공개 규칙보다 앞에 있어야 한다 — 뒤에 두면 draft 가 샌다.
 */
@RestController
@RequestMapping("/api/admin/blog")
@RequiredArgsConstructor
public class BlogAdminController {

    private final BlogPostService postService;

    @GetMapping("/posts")
    public List<BlogAdminPostDto> posts() {
        return postService.adminList();
    }

    @GetMapping("/posts/{id}")
    public BlogAdminPostDto post(@PathVariable Long id) {
        return postService.adminGet(id);
    }

    @PostMapping("/posts")
    public BlogAdminPostDto create(@RequestBody BlogPostSaveRequest body) {
        return postService.create(body);
    }

    @PutMapping("/posts/{id}")
    public BlogAdminPostDto update(@PathVariable Long id, @RequestBody BlogPostSaveRequest body) {
        return postService.update(id, body);
    }

    @DeleteMapping("/posts/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        postService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
