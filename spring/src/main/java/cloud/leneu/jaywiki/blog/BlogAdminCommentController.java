package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogAdminCommentDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 댓글 관리. 관리자는 암호 없이 지우고, 휴지통에서 되살린다. */
@RestController
@RequestMapping("/api/admin/blog/comments")
@RequiredArgsConstructor
public class BlogAdminCommentController {

    private final BlogCommentService service;

    @GetMapping
    public List<BlogAdminCommentDto> list(@RequestParam(defaultValue = "false") boolean deleted) {
        return service.adminList(deleted);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.adminDelete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<Void> restore(@PathVariable Long id) {
        service.restore(id);
        return ResponseEntity.noContent().build();
    }
}
