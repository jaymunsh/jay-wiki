package cloud.leneu.jaywiki.blog;

import cloud.leneu.jaywiki.blog.dto.BlogCategoryDto;
import cloud.leneu.jaywiki.common.BadRequestException;
import cloud.leneu.jaywiki.common.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 카테고리는 최대 2단이다. 깊이를 DB CHECK 로 표현하기 어려워 여기서 강제한다.
 * 규칙이 코드에 있어야 왜 거부됐는지 메시지로 설명할 수 있다.
 */
@Service
@RequiredArgsConstructor
public class BlogCategoryService {

    private final BlogCategoryRepository repo;
    private final BlogPostRepository posts;

    @Transactional(readOnly = true)
    public BlogCategory bySlug(String slug) {
        return repo.findBySlug(slug)
                .orElseThrow(() -> new NotFoundException("blog category not found: " + slug));
    }

    @Transactional
    public BlogCategory create(String slug, String name, String description, Long parentId, int sortOrder) {
        if (parentId != null) {
            BlogCategory parent = repo.findById(parentId)
                    .orElseThrow(() -> new NotFoundException("parent category not found: " + parentId));
            if (parent.getParentId() != null) {
                throw new BadRequestException("카테고리는 2단까지만 만들 수 있다: " + parent.getSlug());
            }
        }
        BlogCategory category = new BlogCategory();
        category.setSlug(slug);
        category.setName(name);
        category.setDescription(description);
        category.setParentId(parentId);
        category.setSortOrder(sortOrder);
        category.setCreatedAt(OffsetDateTime.now());
        return repo.save(category);
    }

    @Transactional
    public BlogCategory rename(Long id, String name, String description) {
        BlogCategory category = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("blog category not found: " + id));
        if (name == null || name.isBlank()) {
            throw new BadRequestException("name is required");
        }
        category.setName(name.trim());
        category.setDescription(description);
        return repo.save(category);
    }

    /** 받은 순서대로 sort_order 를 0부터 다시 매긴다. 형제 안에서만 쓴다. */
    @Transactional
    public void reorder(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new BadRequestException("ids is required");
        }
        for (int i = 0; i < ids.size(); i++) {
            Long id = ids.get(i);
            BlogCategory category = repo.findById(id)
                    .orElseThrow(() -> new NotFoundException("blog category not found: " + id));
            category.setSortOrder(i);
            repo.save(category);
        }
    }

    @Transactional
    public void delete(Long id) {
        BlogCategory category = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("blog category not found: " + id));
        long postCount = posts.countByCategoryId(id);
        if (postCount > 0) {
            // on delete restrict 가 어차피 막지만, DB 오류 메시지를 그대로 내보내지 않는다.
            throw new BadRequestException(
                    "글 " + postCount + "편이 있어 지울 수 없습니다. 먼저 글을 옮겨 주세요.");
        }
        if (repo.findAllByOrderBySortOrderAsc().stream().anyMatch(c -> id.equals(c.getParentId()))) {
            throw new BadRequestException("하위 카테고리가 있어 지울 수 없습니다.");
        }
        repo.delete(category);
    }

    @Transactional(readOnly = true)
    public List<BlogCategoryDto> tree() {
        List<BlogCategory> all = repo.findAllByOrderBySortOrderAsc();
        Map<Long, Long> counts = publishedCounts();
        return all.stream()
                .filter(c -> c.getParentId() == null)
                .map(parent -> toDto(parent, all, counts))
                .toList();
    }

    private BlogCategoryDto toDto(BlogCategory parent, List<BlogCategory> all, Map<Long, Long> counts) {
        List<BlogCategoryDto> children = all.stream()
                .filter(c -> parent.getId().equals(c.getParentId()))
                .map(c -> new BlogCategoryDto(
                        c.getId(), c.getSlug(), c.getName(), c.getDescription(),
                        c.getSortOrder(), counts.getOrDefault(c.getId(), 0L), List.of()))
                .toList();
        return new BlogCategoryDto(
                parent.getId(), parent.getSlug(), parent.getName(), parent.getDescription(),
                parent.getSortOrder(), counts.getOrDefault(parent.getId(), 0L), children);
    }

    /** 카테고리별 published 글 수를 카테고리 수와 무관하게 쿼리 한 번으로 센다. */
    private Map<Long, Long> publishedCounts() {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : posts.countPublishedGroupByCategory()) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return counts;
    }
}
