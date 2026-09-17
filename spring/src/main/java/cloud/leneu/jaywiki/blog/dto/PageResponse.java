package cloud.leneu.jaywiki.blog.dto;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * 페이지 응답의 껍데기. 목록과 검색이 담는 항목의 타입은 다르지만(요약 / 스니펫이 붙은 검색 결과)
 * 페이지 정보를 전하는 모양은 같아서 하나로 둔다.
 *
 * total 을 함께 주는 이유는 화면이 '전체 35편' 을 그리기 때문이다. 항목 배열만 주면
 * 배열 길이로 세던 자리가 페이지 길이로 바뀌어 조용히 틀린 숫자를 보여 준다.
 *
 * @param page 1 부터 센다. Spring Data 의 0 기반과 다르므로 경계에서 한 번 변환한다.
 */
public record PageResponse<T>(
        List<T> items,
        int page,
        int size,
        long total,
        int totalPages
) {
    public static <E, T> PageResponse<T> of(Page<E> found, BlogPageSize size, Function<E, T> mapper) {
        return new PageResponse<>(
                found.getContent().stream().map(mapper).toList(),
                found.getNumber() + 1,
                size.value(),
                found.getTotalElements(),
                // 글이 하나도 없어도 1 페이지는 있다. 화면이 '0 페이지' 를 그리지 않도록 여기서 막는다.
                Math.max(1, found.getTotalPages()));
    }
}
