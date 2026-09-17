package cloud.leneu.jaywiki.board.dto;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * 페이징 응답 공통 래퍼 (web 페이지네이션 바가 쓰기 좋은 형태).
 * Spring 의 Page 를 그대로 노출하면 직렬화 포맷이 장황/불안정해서 필요한 필드만 추린다.
 */
public record PageResponse<T>(
        List<T> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
    public static <T> PageResponse<T> of(Page<?> page, List<T> content) {
        return new PageResponse<>(content, page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages());
    }
}
