package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogAdminPostDto;
import cloud.leneu.jaywiki.blog.dto.BlogPostSaveRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;

/**
 * 저장소의 초안을 운영 블로그에 맞춘다. slug 로 찾아 없으면 만들고, 있으면 다른 것만 고친다.
 *
 * 왜 "다른 것만"을 서버가 판단하나: 매 배포마다 18편을 다시 쓰면 안 바뀐 글의 updatedAt 이
 * 계속 튄다. 그렇다고 클라이언트가 비교하려면 운영 본문을 읽어야 하는데, 공개 API 로 읽으면
 * 그 순간 조회수가 오른다(BlogController.post 가 recordView 를 부른다). 배포마다 가짜 조회가
 * 18건씩 쌓이는 셈이다. 본문을 이미 들고 있는 쪽이 비교하는 게 맞다.
 *
 * 발행일과 대표 이미지는 요청이 비었으면 지금 것을 그대로 쓴다. BlogPostService.save 는
 * 비어 온 발행일에 '지금'을 넣고 coverAssetId 를 null 로 덮으므로, 여기서 채워 주지 않으면
 * 초안을 다시 올릴 때마다 발행일이 오늘로 밀리고 대표 이미지가 사라진다.
 */
@Service
@RequiredArgsConstructor
public class BlogContentSyncService {

    private final BlogPostRepository posts;
    private final BlogPostService postService;

    public record SyncResult(String slug, Long id, boolean changed, String action, String syncHash) {
    }

    /** Content fingerprint excludes views; each field is length-prefixed to avoid ambiguous joins. */
    static String fingerprint(BlogAdminPostDto post) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            for (Object value : new Object[]{post.slug(), post.title(), post.summary(), post.body(),
                    post.categoryId(), post.coverAssetId(), post.status(),
                    post.publishedAt() == null ? null : post.publishedAt().toInstant().truncatedTo(ChronoUnit.MILLIS),
                    post.tocEnabled(), post.prevPostId(), post.nextPostId()}) {
                hashField(digest, value == null ? null : value.toString());
            }
            post.tags().stream().sorted().forEach(tag -> hashField(digest, tag));
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void hashField(MessageDigest digest, String value) {
        String text = value == null ? "-1:" : value.length() + ":" + value;
        digest.update(text.getBytes(StandardCharsets.UTF_8));
    }

    /** 줄끝과 끝 공백만 고른다. 옮기는 경로가 만드는 차이지 사람이 쓴 차이가 아니다. */
    /**
     * 같은 순간인지만 본다. DB 는 마이크로초까지 저장하는데 메모리의 값은 나노초를 들고 있어서,
     * 방금 저장한 글을 다시 견주면 같은 값이 다르게 보인다. 발행일에 밀리초 미만의 차이는
     * 의미가 없다 -- 사람과 스크립트가 정하는 값이다.
     */
    static boolean sameMoment(OffsetDateTime a, OffsetDateTime b) {
        if (a == null || b == null) return a == b;
        return a.toInstant().truncatedTo(ChronoUnit.MILLIS)
                .equals(b.toInstant().truncatedTo(ChronoUnit.MILLIS));
    }

    static String normalize(String text) {
        return text == null ? "" : text.replace("\r\n", "\n").replaceAll("[ \t]+(?=\n)", "").trim();
    }

    @Transactional
    public SyncResult sync(BlogPostSaveRequest request, String expectedHash) {
        return compare(request, expectedHash, false);
    }

    /** Compare under the same lock, but never create or update a post. */
    @Transactional
    public SyncResult preview(BlogPostSaveRequest request) {
        return compare(request, null, true);
    }

    private SyncResult compare(BlogPostSaveRequest request, String expectedHash, boolean preview) {
        BlogPost current = posts.findBySlugForUpdate(request.slug()).orElse(null);
        if (current == null) {
            if (preview) return new SyncResult(request.slug(), null, false, "missing", null);
            if (expectedHash != null && !expectedHash.isBlank()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Previously synced post no longer exists");
            }
            var created = postService.create(request);
            return new SyncResult(created.slug(), created.id(), true, "created", fingerprint(created));
        }

        BlogPostSaveRequest filled = new BlogPostSaveRequest(
                request.slug(),
                request.title(),
                request.summary(),
                request.body(),
                request.categoryId(),
                request.coverAssetId() == null ? current.getCoverAssetId() : request.coverAssetId(),
                request.status(),
                request.publishedAt() == null ? current.getPublishedAt() : request.publishedAt(),
                request.tocEnabled(),
                request.tags(),
                // 발행 스크립트는 시리즈 연결을 안 보낸다. 현재 값을 채워 주지 않으면
                // 초안을 다시 올릴 때마다 관리 화면에서 이어 둔 연결이 끊긴다.
                request.prevPostId() == null ? current.getPrevPostId() : request.prevPostId(),
                request.nextPostId() == null ? current.getNextPostId() : request.nextPostId(),
                request.updatedAt());

        var before = postService.adminGet(current.getId());
        String currentHash = fingerprint(before);
        if (same(before, filled) && Objects.equals(before.status(), filled.status())) {
            return new SyncResult(current.getSlug(), current.getId(), false, "unchanged", currentHash);
        }
        if (preview) return new SyncResult(current.getSlug(), current.getId(), false, "conflict", null);
        if (!currentHash.equals(expectedHash)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Blog content changed or syncHash is missing; compare the production copy before publishing");
        }
        var updated = postService.update(current.getId(), filled);
        return new SyncResult(updated.slug(), updated.id(), true, "updated", fingerprint(updated));
    }

    /** 관리 DTO 로 견준다. 태그·목차까지 이미 담겨 있어 저장소를 따로 뒤질 이유가 없다. */
    static boolean same(BlogAdminPostDto current, BlogPostSaveRequest request) {
        List<String> currentTags = current.tags().stream().sorted().toList();
        List<String> requestTags = (request.tags() == null ? List.<String>of() : request.tags()).stream()
                .sorted()
                .toList();
        return normalize(current.title()).equals(normalize(request.title()))
                && normalize(current.summary()).equals(normalize(request.summary()))
                && normalize(current.body()).equals(normalize(request.body()))
                && Objects.equals(current.categoryId(), request.categoryId())
                && Objects.equals(current.coverAssetId(), request.coverAssetId())
                && (request.tocEnabled() == null || request.tocEnabled() == current.tocEnabled())
                && Objects.equals(current.prevPostId(), request.prevPostId())
                && Objects.equals(current.nextPostId(), request.nextPostId())
                // 발행일도 본다. 안 보면 본문이 같은 글은 날짜만 달라도 「변경 없음」이 되어
                // 저장소에 새긴 날짜가 운영에 영영 안 닿는다. updatedAt 을 뺀 것과는 다르다 --
                // 그건 저장할 때마다 바뀌는 값이라 넣으면 매번 다시 저장하게 된다.
                // 안 보낸 발행일은 견주지 않는다. 관리 화면 수정은 이 값을 안 실어 보내고,
                // 그걸 「다르다」로 보면 고친 게 없어도 매번 저장되어 수정일이 튄다.
                // 싱크 경로는 위에서 현재 값을 채워 넣으므로 항상 견준다.
                && (request.publishedAt() == null || sameMoment(current.publishedAt(), request.publishedAt()))
                && currentTags.equals(requestTags);
    }
}
