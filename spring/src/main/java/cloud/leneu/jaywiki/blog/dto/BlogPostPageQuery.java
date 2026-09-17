package cloud.leneu.jaywiki.blog.dto;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

/**
 * 목록 조회 조건. 전체·카테고리·태그가 같은 질의의 다른 조건일 뿐이라 하나로 묶는다.
 *
 * 조건을 인자로 늘어놓지 않는 이유는, 조건이 하나 늘 때마다 서비스와 컨트롤러의 서명이
 * 함께 바뀌기 때문이다. 여기 필드를 더하면 호출부는 그대로 둘 수 있다.
 *
 * @param categorySlug null 이면 카테고리로 거르지 않는다
 * @param tagName      null 이면 태그로 거르지 않는다
 * @param page         1 부터 센다
 */
public record BlogPostPageQuery(String categorySlug, String tagName, int page, BlogPageSize size) {

    public BlogPostPageQuery {
        if (page < 1) page = 1;
        if (size == null) size = BlogPageSize.DEFAULT;
    }

    public static BlogPostPageQuery of(String categorySlug, String tagName, Integer page, Integer size) {
        return new BlogPostPageQuery(
                blankToNull(categorySlug), blankToNull(tagName),
                page == null ? 1 : page, BlogPageSize.of(size));
    }

    /** Spring Data 는 0 부터 센다. 그 차이를 여기서만 흡수한다. */
    public Pageable pageable() {
        return PageRequest.of(page - 1, size.value());
    }

    private static String blankToNull(String raw) {
        return raw == null || raw.isBlank() ? null : raw;
    }
}
