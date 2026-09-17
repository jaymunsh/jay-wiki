package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogPostSaveRequest;
import cloud.leneu.jaywiki.wiki.sync.ContentSyncAuthorizer;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 블로그 콘텐츠 싱크. 위키와 같은 문(토큰 하나)을 쓰되 경로와 컨트롤러는 따로 둔다 --
 * 위키는 탭·문서, 블로그는 글이라 같이 두면 한쪽을 고칠 때 다른 쪽이 딸려 온다.
 *
 * 토큰이 틀리면 401 이 아니라 404 다. 경로의 존재 자체를 숨긴다(ContentSyncAuthorizer).
 */
@RestController
@RequestMapping("/internal/content-sync")
@RequiredArgsConstructor
public class BlogContentSyncController {

    static final String TOKEN_HEADER = "X-Content-Sync-Token";

    private final ContentSyncAuthorizer authorizer;
    private final BlogContentSyncService sync;

    @PostMapping("/blog-posts/preview")
    public BlogContentSyncService.SyncResult previewBlogPost(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @RequestBody BlogPostSaveRequest request
    ) {
        authorizer.requireValid(token);
        return sync.preview(request);
    }

    @PostMapping("/blog-posts")
    public BlogContentSyncService.SyncResult saveBlogPost(
            @RequestHeader(value = TOKEN_HEADER, required = false) String token,
            @RequestHeader(value = "X-Content-Sync-Base", required = false) String expectedHash,
            @RequestBody BlogPostSaveRequest request
    ) {
        authorizer.requireValid(token);
        return sync.sync(request, expectedHash);
    }
}
