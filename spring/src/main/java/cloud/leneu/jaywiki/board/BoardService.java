package cloud.leneu.jaywiki.board;

import cloud.leneu.jaywiki.account.AccountUser;
import cloud.leneu.jaywiki.account.AccountUserRepository;
import cloud.leneu.jaywiki.board.dto.*;
import cloud.leneu.jaywiki.common.NotFoundException;
import cloud.leneu.jaywiki.search.BoardOpenSearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.List;
import java.util.function.Supplier;

/**
 * 게시판 로직 — 대량 페이징 + 익명 작성 + 조회수(Redis).
 *
 * 조회수 설계:
 *  - 상세를 열 때마다 Redis 카운터를 INCR (빠르고 DB 부하 없음).
 *  - 화면 표시값 = post.views(누적 기저) + Redis 증가분.
 *  - 실제 운영에선 배치(stats 스키마)가 주기적으로 Redis→PG 로 flush (워크북 09 이후).
 */
@Service
@RequiredArgsConstructor
public class BoardService {

    private final CommunityPostRepository postRepo;
    private final CommunityCommentRepository commentRepo;
    private final StringRedisTemplate redis;
    private final PasswordEncoder encoder;
    private final BoardOpenSearchService openSearch;
    private final AccountUserRepository users;

    private static final int MAX_SIZE = 100;

    private static String viewKey(Long id) {
        return "board:post:views:" + id;
    }

    /** 최신순(id desc) 페이지. size 는 1~100 로 제한. */
    @Transactional(readOnly = true)
    public PageResponse<PostSummaryDto> list(int page, int size) {
        int p = Math.max(page, 0);
        int s = Math.min(Math.max(size, 1), MAX_SIZE);
        Page<CommunityPost> found = postRepo.findAllByOrderByIdDesc(PageRequest.of(p, s));
        List<PostSummaryDto> content = found.getContent().stream().map(PostSummaryDto::from).toList();
        return PageResponse.of(found, content);
    }

    /** 상세 조회 — 조회수 Redis INCR 후 합산 표시. */
    @Transactional(readOnly = true)
    public PostDto get(Long id) {
        CommunityPost post = postRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("post not found: " + id));
        Long delta = redis.opsForValue().increment(viewKey(id));
        long views = post.getViews() + (delta == null ? 0 : delta);
        return PostDto.from(post, views);
    }

    @Transactional
    public CommunityPost create(PostCreateRequest req, Authentication auth) {
        AuthorIdentity author = author(auth, req.authorName());
        CommunityPost post = new CommunityPost();
        post.setTitle(req.title().trim());
        post.setContent(req.content());
        post.setAuthorType(author.type());
        post.setAuthorName(author.name());
        post.setPasswordHash(author.authenticated() || isBlank(req.password()) ? null : encoder.encode(req.password()));
        post.setViews(0);
        post.setCommentCount(0);
        post.setCreatedAt(OffsetDateTime.now());
        return postRepo.save(post);
    }

    public List<CommentDto> comments(Long postId) {
        if (!postRepo.existsById(postId)) {
            throw new NotFoundException("post not found: " + postId);
        }
        return commentRepo.findByPostIdOrderByIdAsc(postId).stream().map(CommentDto::from).toList();
    }

    /** 댓글 추가 + 글의 comment_count 증가(같은 트랜잭션, 더티체킹으로 UPDATE). */
    @Transactional
    public CommunityComment addComment(Long postId, CommentCreateRequest req, Authentication auth) {
        CommunityPost post = postRepo.findById(postId)
                .orElseThrow(() -> new NotFoundException("post not found: " + postId));
        AuthorIdentity author = author(auth, req.authorName());

        CommunityComment c = new CommunityComment();
        c.setPostId(postId);
        c.setContent(req.content());
        c.setAuthorType(author.type());
        c.setAuthorName(author.name());
        c.setCreatedAt(OffsetDateTime.now());
        commentRepo.save(c);

        post.setCommentCount(post.getCommentCount() + 1);
        return c;
    }

    /** 익명 본인 삭제 — 작성 시 비밀번호 확인. 불일치/미설정 시 409. */
    @Transactional
    public void deleteByPassword(Long id, String password) {
        CommunityPost post = postRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("post not found: " + id));
        if (post.getPasswordHash() == null) {
            throw new IllegalStateException("비밀번호가 없는 글입니다. 관리자만 삭제할 수 있습니다.");
        }
        if (isBlank(password) || !encoder.matches(password, post.getPasswordHash())) {
            throw new IllegalStateException("비밀번호가 일치하지 않습니다.");
        }
        postRepo.delete(post);   // 댓글은 FK on delete cascade 로 함께 삭제
    }

    /** 관리자 삭제(모더레이션) — 비밀번호 무관. 보안설정에서 ADMIN 만 도달. */
    @Transactional
    public void deleteByAdmin(Long id) {
        if (!postRepo.existsById(id)) {
            throw new NotFoundException("post not found: " + id);
        }
        postRepo.deleteById(id);
    }

    /**
     * 검색 방식 비교(03B Phase1) — 같은 검색어를 LIKE / tsvector 두 방식으로 조회하고
     * 각 소요시간을 잰다. 10만 건 위에서 "순차 스캔 vs GIN 전문검색" 차이를 보여주는 데모.
     */
    public SearchCompareResult compare(String q) {
        if (isBlank(q)) {
            return new SearchCompareResult("", List.of());
        }
        String query = q.trim();
        SearchCompareResult.MethodResult like = timed(
                "LIKE (순차 스캔)", "인덱스 없음 · ILIKE '%q%'", query, () -> postRepo.searchLike(query));
        SearchCompareResult.MethodResult fts = timed(
                "tsvector (GIN)", "전문검색 · plainto_tsquery", query, () -> postRepo.searchFts(query));
        SearchCompareResult.MethodResult os = openSearch.search(query);
        return new SearchCompareResult(query, List.of(like, fts, os));
    }

    public List<String> suggest(String q) {
        if (isBlank(q)) {
            return List.of();
        }
        String query = q.trim();
        List<String> openSearchTitles = openSearch.suggest(query);
        if (!openSearchTitles.isEmpty()) {
            return openSearchTitles;
        }
        return postRepo.suggestTitlePrefix(query).stream()
                .map(CommunityPost::getTitle)
                .distinct()
                .toList();
    }

    private SearchCompareResult.MethodResult timed(String method, String note,
                                                   String searchText,
                                                   Supplier<List<CommunityPost>> query) {
        long t0 = System.nanoTime();
        List<CommunityPost> rows = query.get();
        double ms = Math.round((System.nanoTime() - t0) / 1_000_000.0 * 100) / 100.0;
        List<SearchHitDto> hits = rows.stream()
                .map(row -> SearchHitDto.from(row, snippet(row.getContent(), searchText)))
                .toList();
        return new SearchCompareResult.MethodResult(method, note, ms, hits.size(), hits);
    }

    private static String snippet(String content, String query) {
        if (content == null || content.isBlank()) {
            return "";
        }
        String text = content.replaceAll("\\s+", " ").trim();
        String needle = query.toLowerCase(Locale.ROOT);
        String haystack = text.toLowerCase(Locale.ROOT);
        int found = haystack.indexOf(needle);
        if (found < 0) {
            return text.length() <= 96 ? text : text.substring(0, 96) + "...";
        }
        int start = Math.max(0, found - 36);
        int end = Math.min(text.length(), found + query.length() + 54);
        String prefix = start > 0 ? "..." : "";
        String suffix = end < text.length() ? "..." : "";
        String before = text.substring(start, found);
        String marked = text.substring(found, found + query.length());
        String after = text.substring(found + query.length(), end);
        return prefix + before + "[[" + marked + "]]" + after + suffix;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String blankTo(String s, String fallback) {
        return isBlank(s) ? fallback : s.trim();
    }

    private AuthorIdentity author(Authentication auth, String fallbackName) {
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return AuthorIdentity.anonymous(blankTo(fallbackName, "익명"));
        }
        AccountUser user = users.findByUsername(auth.getName()).orElse(null);
        if (user == null) {
            return AuthorIdentity.anonymous(blankTo(fallbackName, "익명"));
        }
        String name = blankTo(user.getNickname(), user.getUsername());
        return new AuthorIdentity("user", name, true);
    }

    private record AuthorIdentity(String type, String name, boolean authenticated) {
        static AuthorIdentity anonymous(String name) {
            return new AuthorIdentity("anonymous", name, false);
        }
    }
}
