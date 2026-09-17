package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogCategoryDto;
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

/** 카테고리 관리. 2단 제약과 삭제 차단은 서비스가 강제한다. */
@RestController
@RequestMapping("/api/admin/blog/categories")
@RequiredArgsConstructor
public class BlogAdminCategoryController {

    private final BlogCategoryService service;

    public record CreateRequest(String slug, String name, String description, Long parentId, Integer sortOrder) {
    }

    public record RenameRequest(String name, String description) {
    }

    public record ReorderRequest(List<Long> ids) {
    }

    /** 관리 화면도 글 수가 필요하므로 공개 트리를 그대로 준다. */
    @GetMapping
    public List<BlogCategoryDto> tree() {
        return service.tree();
    }

    @PostMapping
    public BlogCategory create(@RequestBody CreateRequest body) {
        return service.create(body.slug(), body.name(), body.description(), body.parentId(),
                body.sortOrder() == null ? 0 : body.sortOrder());
    }

    @PutMapping("/{id}")
    public BlogCategory rename(@PathVariable Long id, @RequestBody RenameRequest body) {
        return service.rename(id, body.name(), body.description());
    }

    @PostMapping("/reorder")
    public ResponseEntity<Void> reorder(@RequestBody ReorderRequest body) {
        service.reorder(body.ids());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
