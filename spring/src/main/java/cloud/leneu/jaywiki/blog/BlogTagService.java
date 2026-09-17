package cloud.leneu.jaywiki.blog;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

/**
 * 태그는 정규화한다. 위키의 콤마 문자열로는 태그별 글 수와 태그 페이지를 만들 수 없다.
 */
@Service
@RequiredArgsConstructor
public class BlogTagService {

    private final BlogTagRepository tags;
    private final BlogPostTagRepository postTags;

    public record TagCount(String name, long count) {
    }

    /** 글의 태그를 주어진 목록으로 맞춘다. 없는 태그는 만들고, 빠진 연결은 지운다. */
    @Transactional
    public void attach(Long postId, List<String> names) {
        postTags.deleteByPostId(postId);
        names.stream().map(String::strip).filter(n -> !n.isEmpty()).distinct().forEach(name -> {
            BlogTag tag = tags.findByName(name).orElseGet(() -> {
                BlogTag created = new BlogTag();
                created.setName(name);
                return tags.save(created);
            });
            BlogPostTag link = new BlogPostTag();
            link.setPostId(postId);
            link.setTagId(tag.getId());
            postTags.save(link);
        });
    }

    @Transactional(readOnly = true)
    public List<String> namesOf(Long postId) {
        List<Long> tagIds = postTags.findByPostId(postId).stream().map(BlogPostTag::getTagId).toList();
        if (tagIds.isEmpty()) return List.of();
        return tags.findByIdIn(tagIds).stream()
                .map(BlogTag::getName)
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Long> postIdsOf(String tagName) {
        return tags.findByName(tagName)
                .map(tag -> postTags.findByTagId(tag.getId()).stream().map(BlogPostTag::getPostId).toList())
                .orElse(List.of());
    }

    @Transactional(readOnly = true)
    public List<TagCount> counts() {
        return postTags.countByTag().stream()
                .map(row -> new TagCount((String) row[0], ((Number) row[1]).longValue()))
                .toList();
    }
}
