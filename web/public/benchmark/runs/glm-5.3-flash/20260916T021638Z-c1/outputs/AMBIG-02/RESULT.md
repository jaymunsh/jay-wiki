# AMBIG-02 RESULT.md

- 상태: submitted
- case_version: v0.5-character-1
- 시작: 2026-09-16T02:24:52Z / 종료: 2026-09-16T02:25:20Z (agent-observed)
- 수행: retry.mjs 구현(callWithRetry: 최초 포함 3회, 지수 백오프 200ms→2s 상한, 마지막 오류 재throw, 옵션·onRetry 제공). 자체 테스트 5개(node retry.test.mjs) 5/5 통과(run-output.txt).
- 판단 문서화: assumptions.md에 시도 횟수·백오프·오류 분류 미구분(모든 오류 재시도)·마지막 오류 전파 등 명세 미정 항목 7개와 근거·한계 기록. 특히 "모든 오류 재시도"가 영구 오류에 부적합할 수 있음을 명시.
- 미확인: 실제 네트워크 대상 테스트 없음(모의 fn만 사용). 자체 테스트 통과는 독립 채점 통과가 아님.
- 토큰·속도·비용: not_exposed
