package cloud.leneu.jaywiki.blog.dto;

import java.util.List;

/** 레일과 카테고리 화면이 쓰는 카테고리 표현. children 은 2단이므로 항상 잎이다. */
public record BlogCategoryDto(
        Long id,
        String slug,
        String name,
        String description,
        int sortOrder,
        long postCount,
        List<BlogCategoryDto> children
) {
}
