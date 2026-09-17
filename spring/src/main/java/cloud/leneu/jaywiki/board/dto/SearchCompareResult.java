package cloud.leneu.jaywiki.board.dto;

import java.util.List;

/**
 * 검색 방식 비교 결과 (03B Phase1).
 * 같은 검색어를 여러 방식으로 조회해 방식별 소요시간/건수/결과를 나란히 담는다.
 */
public record SearchCompareResult(
        String query,
        List<MethodResult> methods
) {
    public record MethodResult(
            String method,        // 표시명 (예: "LIKE (순차 스캔)")
            String note,          // 짧은 설명 (인덱스 유무 등)
            double elapsedMs,     // 서버측 쿼리 소요(ms, 소수 2자리)
            int count,            // 결과 건수(limit 20 안에서)
            List<SearchHitDto> hits
    ) {}
}
