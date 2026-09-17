package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogAdminPostDto;
import cloud.leneu.jaywiki.blog.dto.BlogPostSaveRequest;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;
import java.util.Optional;
import org.springframework.web.server.ResponseStatusException;

/**
 * 견주는 규칙만 고정한다. 여기가 틀리면 두 방향으로 다 샌다 --
 * 너무 엄하면 배포마다 18편의 updatedAt 이 튀고, 너무 무르면 고친 글이 안 나간다.
 */
class BlogContentSyncServiceTest {

    @Test
    void previewNeverWritesAndOnlyReturnsABaselineForIdenticalContent() {
        BlogPostRepository posts = mock(BlogPostRepository.class);
        BlogPostService service = mock(BlogPostService.class);
        BlogPost row = new BlogPost();
        row.setId(7L);
        row.setSlug("a-slug");
        when(posts.findBySlugForUpdate("a-slug")).thenReturn(Optional.empty());
        var sync = new BlogContentSyncService(posts, service);
        assertThat(sync.preview(request("본문", List.of("a"), true)).action()).isEqualTo("missing");
        when(posts.findBySlugForUpdate("a-slug")).thenReturn(Optional.of(row));
        when(service.adminGet(7L)).thenReturn(current("본문", List.of("a")));
        assertThat(sync.preview(request("다른 본문", List.of("a"), true)).syncHash()).isNull();
        assertThat(sync.preview(request("본문", List.of("a"), true)).syncHash()).hasSize(64);
        verify(service, never()).create(any());
        verify(service, never()).update(anyLong(), any());
    }

    @Test
    void refusesStaleAndMissingBaselinesWithoutUpdatingThePost() {
        BlogPostRepository posts = mock(BlogPostRepository.class);
        BlogPostService service = mock(BlogPostService.class);
        BlogPost row = new BlogPost();
        row.setId(7L);
        row.setSlug("a-slug");
        when(posts.findBySlugForUpdate("a-slug")).thenReturn(Optional.of(row));
        when(service.adminGet(7L)).thenReturn(current("운영에서 고친 본문", List.of("a")));
        BlogContentSyncService sync = new BlogContentSyncService(posts, service);
        assertThatThrownBy(() -> sync.sync(request("초안", List.of("a"), true), null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("409");
        assertThatThrownBy(() -> sync.sync(request("초안", List.of("a"), true), "stale"))
                .isInstanceOf(ResponseStatusException.class);
        verify(service, never()).update(anyLong(), any());
    }

    @Test
    void permitsMatchingBaselineAndReturnsTheNewFingerprint() {
        BlogPostRepository posts = mock(BlogPostRepository.class);
        BlogPostService service = mock(BlogPostService.class);
        BlogPost row = new BlogPost();
        row.setId(7L);
        row.setSlug("a-slug");
        var before = current("이전 본문", List.of("a"));
        var after = current("수정 본문", List.of("a"));
        when(posts.findBySlugForUpdate("a-slug")).thenReturn(Optional.of(row));
        when(service.adminGet(7L)).thenReturn(before);
        when(service.update(eq(7L), any())).thenReturn(after);
        var result = new BlogContentSyncService(posts, service).sync(
                request("수정 본문", List.of("a"), true), BlogContentSyncService.fingerprint(before));
        assertThat(result.changed()).isTrue();
        assertThat(result.syncHash()).isEqualTo(BlogContentSyncService.fingerprint(after));
        assertThat(result.syncHash()).isNotEqualTo(BlogContentSyncService.fingerprint(before));
    }

    @Test
    void unchangedContentCanInitializeItsBaselineWithoutWriting() {
        BlogPostRepository posts = mock(BlogPostRepository.class);
        BlogPostService service = mock(BlogPostService.class);
        BlogPost row = new BlogPost();
        row.setId(7L);
        row.setSlug("a-slug");
        when(posts.findBySlugForUpdate("a-slug")).thenReturn(Optional.of(row));
        when(service.adminGet(7L)).thenReturn(current("본문", List.of("a")));
        var result = new BlogContentSyncService(posts, service).sync(request("본문", List.of("a"), true), null);
        assertThat(result.changed()).isFalse();
        assertThat(result.syncHash()).hasSize(64);
        verify(service, never()).update(anyLong(), any());
    }

    private static BlogAdminPostDto current(String body, List<String> tags) {
        return new BlogAdminPostDto(
                7L, "a-slug", "제목", "요약", body, 3L, "tech-lab", "기술 실험",
                "cover-1", "published", OffsetDateTime.parse("2026-08-01T00:00:00Z"),
                OffsetDateTime.parse("2026-08-02T00:00:00Z"), 12, true, tags, null, null);
    }

    private static BlogPostSaveRequest request(String body, List<String> tags, Boolean toc) {
        return new BlogPostSaveRequest("a-slug", "제목", "요약", body, 3L, "cover-1",
                "published", OffsetDateTime.parse("2026-08-01T00:00:00Z"), toc, tags, null, null, null);
    }

    @Test
    void treatsLineEndingAndTrailingSpaceAsSame() {
        assertThat(BlogContentSyncService.same(
                current("첫 줄\n둘째 줄", List.of("a")),
                request("첫 줄  \r\n둘째 줄\n", List.of("a"), true))).isTrue();
    }

    @Test
    void seesRealBodyChange() {
        assertThat(BlogContentSyncService.same(
                current("첫 줄", List.of("a")),
                request("첫 줄 하나 더", List.of("a"), true))).isFalse();
    }

    @Test
    void ignoresTagOrder() {
        assertThat(BlogContentSyncService.same(
                current("본문", List.of("b", "a")),
                request("본문", List.of("a", "b"), true))).isTrue();
    }

    @Test
    void seesTagChange() {
        assertThat(BlogContentSyncService.same(
                current("본문", List.of("a")),
                request("본문", List.of("a", "c"), true))).isFalse();
    }

    @Test
    void seesPublishedAtChange() {
        BlogPostSaveRequest movedDate = new BlogPostSaveRequest("a-slug", "제목", "요약", "첫 줄", 3L, "cover-1",
                "published", OffsetDateTime.parse("2026-07-20T00:00:00Z"), true, List.of("a"), null, null, null);
        assertThat(BlogContentSyncService.same(current("첫 줄", List.of("a")), movedDate)).isFalse();
    }

    @Test
    void treatsMissingTocAsUnchanged() {
        assertThat(BlogContentSyncService.same(
                current("본문", List.of("a")),
                request("본문", List.of("a"), null))).isTrue();
    }

    @Test
    void seesTocTurnedOff() {
        assertThat(BlogContentSyncService.same(
                current("본문", List.of("a")),
                request("본문", List.of("a"), false))).isFalse();
    }
}
