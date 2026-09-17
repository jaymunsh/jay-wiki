package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogAdminCommentDto;
import cloud.leneu.jaywiki.blog.dto.BlogCommentCreateRequest;
import cloud.leneu.jaywiki.blog.dto.BlogCommentDto;
import cloud.leneu.jaywiki.common.BadRequestException;
import cloud.leneu.jaywiki.common.ClientIpResolver;
import cloud.leneu.jaywiki.common.NotFoundException;
import cloud.leneu.jaywiki.stats.Referrer;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 로그인 없이 쓰는 댓글.
 * 원본 IP 는 저장하지 않는다. 표시용 앞 2옥텟과 차단용 salted hash 만 남긴다.
 * 식별 가능한 형태로 보관하지 않는 것이 목적이다.
 */
@Service
@RequiredArgsConstructor
public class BlogCommentService {

    private static final int MAX_NAME = 30;
    private static final int MAX_BODY = 1000;

    private final BlogCommentRepository comments;
    private final BlogPostRepository posts;
    private final BlogCommentProperties properties;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<BlogCommentDto> list(Long postId) {
        return comments.findByPostIdAndDeletedAtIsNullOrderByCreatedAtAsc(postId).stream()
                .map(c -> new BlogCommentDto(
                        c.getId(), c.getAuthorName(), c.getIpPrefix(), c.getBody(), c.getCreatedAt()))
                .toList();
    }

    @Transactional
    public BlogCommentDto create(Long postId, BlogCommentCreateRequest request,
                                 String clientIp, String entryHost) {
        posts.findByIdAndStatus(postId, "published")
                .orElseThrow(() -> new NotFoundException("blog post not found: " + postId));
        require(request.authorName(), "이름을 입력해 주세요.");
        require(request.password(), "암호를 입력해 주세요.");
        require(request.body(), "내용을 입력해 주세요.");

        BlogComment comment = new BlogComment();
        comment.setPostId(postId);
        comment.setAuthorName(trim(request.authorName(), MAX_NAME));
        comment.setPasswordHash(passwordEncoder.encode(request.password()));
        comment.setBody(trim(request.body(), MAX_BODY));
        comment.setIpPrefix(ClientIpResolver.prefix(clientIp));
        comment.setIpHash(hash(clientIp));
        comment.setSource(Referrer.ofHost(entryHost).source());
        comment.setCreatedAt(OffsetDateTime.now());
        BlogComment saved = comments.save(comment);
        return new BlogCommentDto(
                saved.getId(), saved.getAuthorName(), saved.getIpPrefix(), saved.getBody(), saved.getCreatedAt());
    }

    @Transactional
    public void delete(Long commentId, String password) {
        BlogComment comment = comments.findById(commentId)
                .orElseThrow(() -> new NotFoundException("blog comment not found: " + commentId));
        if (comment.getDeletedAt() != null) {
            throw new NotFoundException("blog comment not found: " + commentId);
        }
        if (password == null || !passwordEncoder.matches(password, comment.getPasswordHash())) {
            throw new BadRequestException("암호가 맞지 않습니다.");
        }
        comment.setDeletedAt(OffsetDateTime.now());
    }

    /** 관리 목록. deleted=true 면 휴지통이다. */
    @Transactional(readOnly = true)
    public List<BlogAdminCommentDto> adminList(boolean deleted) {
        List<BlogComment> found = deleted
                ? comments.findByDeletedAtIsNotNullOrderByDeletedAtDesc()
                : comments.findByDeletedAtIsNullOrderByCreatedAtDesc();
        Map<Long, String> titles = posts.findAll().stream()
                .collect(Collectors.toMap(BlogPost::getId, BlogPost::getTitle));
        return found.stream()
                .map(c -> new BlogAdminCommentDto(
                        c.getId(), c.getPostId(), titles.get(c.getPostId()),
                        c.getAuthorName(), c.getIpPrefix(), c.getBody(),
                        c.getCreatedAt(), c.getDeletedAt()))
                .toList();
    }

    /** 관리자 삭제. 암호를 묻지 않는다. soft delete 라 휴지통에서 되살릴 수 있다. */
    @Transactional
    public void adminDelete(Long commentId) {
        BlogComment comment = comments.findById(commentId)
                .orElseThrow(() -> new NotFoundException("blog comment not found: " + commentId));
        comment.setDeletedAt(OffsetDateTime.now());
    }

    @Transactional
    public void restore(Long commentId) {
        BlogComment comment = comments.findById(commentId)
                .orElseThrow(() -> new NotFoundException("blog comment not found: " + commentId));
        comment.setDeletedAt(null);
    }

    private static void require(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(message);
        }
    }

    private static String trim(String value, int max) {
        String stripped = value.strip();
        return stripped.length() <= max ? stripped : stripped.substring(0, max);
    }

    private String hash(String clientIp) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] out = digest.digest((properties.ipSalt() + "|" + clientIp).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(out);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
